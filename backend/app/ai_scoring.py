import json
import logging
import os
import re

import httpx

from .schemas import (
    CandidateAnalysisResult,
    CandidateOverview,
    ParsedCandidateContext,
    PoolOverview,
    SkillEvidence,
    TopPick,
)
from .scoring import (
    DEFAULT_EXPERIENCE_CAP,
    DISCLAIMER,
    TIER_CREDIT,
    build_heuristic_analysis,
    build_heuristic_overview,
    compute_weighted_score,
    recommendation_for_score,
)

logger = logging.getLogger(__name__)


def _safe_float(value: str | None, default: float, minimum: float = 0.0) -> float:
    try:
        parsed = float((value or "").strip() or default)
        return max(minimum, parsed)
    except ValueError:
        return default


def _safe_int(value: str | None, default: int, minimum: int = 1, maximum: int = 20) -> int:
    try:
        parsed = int((value or "").strip() or default)
        return max(minimum, min(maximum, parsed))
    except ValueError:
        return default


def get_ai_config() -> dict:
    api_key = os.getenv("LLM_API_KEY", "").strip()
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
    if base_url.endswith("/chat/completions"):
        base_url = base_url[: -len("/chat/completions")].rstrip("/")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    timeout = _safe_float(os.getenv("LLM_TIMEOUT_SECONDS"), 60.0, minimum=1.0)
    max_concurrency = _safe_int(os.getenv("LLM_MAX_CONCURRENCY"), 8, minimum=1, maximum=20)
    reasoning_effort = os.getenv("LLM_REASONING_EFFORT", "").strip().lower()
    if reasoning_effort not in {"none", "minimal", "low", "medium", "high", "xhigh", "max"}:
        reasoning_effort = ""
    fallback = os.getenv("LLM_FALLBACK_HEURISTIC", "true").strip().lower() not in {"0", "false", "no"}
    return {
        "enabled": bool(api_key),
        "api_key": api_key,
        "base_url": base_url or "https://api.openai.com/v1",
        "model": model,
        "timeout": timeout,
        "max_concurrency": max_concurrency,
        "reasoning_effort": reasoning_effort,
        "fallback_heuristic": fallback,
    }


def _safe_exc_summary(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTPStatusError({exc.response.status_code})"
    return type(exc).__name__


def _clean_str(val, default: str = "") -> str:
    return default if val is None else str(val).strip()


def _clean_str_list(val) -> list[str]:
    if not isinstance(val, list):
        return []
    return [str(x).strip() for x in val if x is not None and str(x).strip()]


def _clean_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _strip_json_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


async def _chat_json(system_prompt: str, user_prompt: str, config: dict) -> dict:
    url = f"{config['base_url']}/chat/completions"
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config["model"],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    if config.get("reasoning_effort"):
        payload["reasoning_effort"] = config["reasoning_effort"]
    async with httpx.AsyncClient(timeout=config["timeout"]) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip():
        raise ValueError("LLM returned empty content")
    return json.loads(_strip_json_fences(content))


CANDIDATE_SYSTEM_PROMPT = """You are NEXORA's recruiter-support resume analyst.
Evaluate a candidate's resume text strictly against the provided Job Description (JD).
Never infer or score protected characteristics (age, gender, race, religion, nationality, etc.).
Ground every claim in verbatim evidence from the resume. If something is not in the resume, mark it missing/not found.

Return a single valid JSON object with this exact shape:
{
  "parsed_context": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "experience_years": 0.0,
    "education": "string",
    "skills": ["string"],
    "soft_skills": ["string"],
    "work": [
      {"title": "string", "company": "string", "date_range": "string", "skills": ["string"], "highlights": ["string"]}
    ],
    "projects": [
      {"title": "string", "description": "string", "skills": ["string"]}
    ]
  },
  "skill_evidence": [
    {
      "skill": "string",
      "category": "Technical|Tool|Framework|Domain|Soft",
      "tier": "D|E|M|I|N",
      "confidence": "High|Medium|Low",
      "evidence": "short verbatim quote from resume or 'Not found in resume'",
      "section": "Experience|Projects|Skills|Education|Certifications|Summary|Not recorded",
      "required_by_jd": "Required|Preferred|Additional",
      "match_status": "Matched|Partial|Missing|Additional"
    }
  ],
  "component_assessments": {
    "exp": {"applicable": true, "fraction": 0.0, "note": "string"},
    "edu": {"applicable": false, "fraction": 0.0, "note": "string"},
    "proj": {"applicable": true, "fraction": 0.0, "note": "string"},
    "resp": {"applicable": false, "fraction": 0.0, "note": "string"},
    "ctx": {"applicable": true, "fraction": 0.0, "note": "string"}
  },
  "overview": {
    "headline": "punchy 1-line recruiter verdict (max 14 words)",
    "summary": "short 1-2 sentence evidence-backed description (max 35 words)",
    "strengths": ["3-4 short concrete highlights (max 14 words each)"],
    "gaps": ["short missing/unverified JD items (max 14 words each)"],
    "interview_questions": ["2-3 crisp targeted questions probing gaps (max 18 words each)"]
  }
}

Skill tier definitions:
- D (full credit = 1.0): Demonstrated with concrete action/usage in Experience or Projects.
- E (full credit = 1.0): Explicitly claimed with proficiency or clear context outside a bare list.
- M (half credit = 0.5): Mentioned only in a bare skills list with no project or job usage context.
- I (credit = 0.0): Inferred from related tools/frameworks only, not explicitly stated.
- N (credit = 0.0): Not found anywhere in the resume.

Component assessment guidelines (fractions 0.0 to 1.0):
- exp: Compare relevant experience against JD experience_min (or 3 years if unspecified).
- proj: Evaluate how well the candidate's projects demonstrate skills relevant to the JD.
- ctx: Evaluate how many JD required skills are demonstrated inside dated work experience entries.
- edu: Set applicable=false if the JD specifies no education requirement.
- resp: Set applicable=false if the JD specifies no responsibilities list.

Include an entry in skill_evidence for EVERY required_skill and preferred_skill from the JD, plus notable additional skills found in the resume."""


POOL_SYSTEM_PROMPT = """You are NEXORA's recruiting intelligence synthesizer.
Given a Job Description and structured analysis summaries of all analysed candidates, produce a concise, decision-ready executive overview for the hiring team.
Never invent candidates, scores, or facts not present in the input.

Return a single valid JSON object with this exact shape:
{
  "executive_summary": "short 2-sentence recruiter brief on pool quality and standout picks (max 40 words)",
  "top_picks": [
    {"candidate_id": 1, "name": "string", "score": 85, "reason": "crisp 1-line comparative reason (max 14 words)"}
  ],
  "common_strengths": ["up to 4 short pool-wide strengths with counts"],
  "common_gaps": ["up to 4 short pool-wide gaps with counts"],
  "sourcing_signal": "1 concise sentence on interviewing top picks vs widening sourcing (max 22 words)"
}"""


def _normalize_parsed_context(raw_ctx: dict | None, candidate: dict) -> ParsedCandidateContext:
    ctx = raw_ctx if isinstance(raw_ctx, dict) else {}
    work_items = []
    for w in ctx.get("work") or []:
        if not isinstance(w, dict):
            continue
        work_items.append(
            {
                "title": _clean_str(w.get("title")),
                "company": _clean_str(w.get("company")),
                "date_range": _clean_str(w.get("date_range")),
                "skills": _clean_str_list(w.get("skills")),
                "highlights": _clean_str_list(w.get("highlights")),
            }
        )
    proj_items = []
    for p in ctx.get("projects") or []:
        if not isinstance(p, dict):
            continue
        proj_items.append(
            {
                "title": _clean_str(p.get("title")),
                "description": _clean_str(p.get("description")),
                "skills": _clean_str_list(p.get("skills")),
            }
        )

    exp_years = max(0.0, min(80.0, _clean_float(ctx.get("experience_years"), 0.0)))
    if exp_years <= 0 and candidate.get("experience_years"):
        exp_years = max(0.0, min(80.0, _clean_float(candidate.get("experience_years"), 0.0)))

    return ParsedCandidateContext.model_validate(
        {
            "name": _clean_str(ctx.get("name")) or _clean_str(candidate.get("name")) or "Unnamed Candidate",
            "email": _clean_str(ctx.get("email")) or _clean_str(candidate.get("email")),
            "phone": _clean_str(ctx.get("phone")) or _clean_str(candidate.get("phone")),
            "experience_years": exp_years,
            "education": _clean_str(ctx.get("education")) or _clean_str(candidate.get("education")),
            "skills": _clean_str_list(ctx.get("skills")),
            "soft_skills": _clean_str_list(ctx.get("soft_skills")),
            "work": work_items,
            "projects": proj_items,
        }
    )


def _build_analysis_from_llm_json(
    raw: dict,
    candidate: dict,
    job: dict,
    model_name: str,
) -> CandidateAnalysisResult:
    if not isinstance(raw, dict):
        raise ValueError("LLM response must be a JSON object")

    parsed = _normalize_parsed_context(raw.get("parsed_context"), candidate)

    evidences: list[SkillEvidence] = []
    for item in raw.get("skill_evidence") or []:
        if not isinstance(item, dict) or not _clean_str(item.get("skill")):
            continue
        try:
            evidences.append(
                SkillEvidence.model_validate(
                    {
                        "skill": _clean_str(item.get("skill")),
                        "category": _clean_str(item.get("category"), "Technical") or "Technical",
                        "tier": _clean_str(item.get("tier"), "N") or "N",
                        "confidence": _clean_str(item.get("confidence"), "Low") or "Low",
                        "evidence": _clean_str(item.get("evidence")),
                        "section": _clean_str(item.get("section"), "Not recorded") or "Not recorded",
                        "required_by_jd": _clean_str(item.get("required_by_jd"), "Required") or "Required",
                        "match_status": _clean_str(item.get("match_status"), "Missing") or "Missing",
                    }
                )
            )
        except Exception:
            continue

    required = [str(s).strip() for s in (job.get("required_skills") or []) if str(s).strip()]
    preferred = [str(s).strip() for s in (job.get("preferred_skills") or []) if str(s).strip()]
    ev_by_key = {e.skill.casefold(): e for e in evidences}

    # Ensure every JD required/preferred skill is represented
    for s in required:
        if s.casefold() not in ev_by_key:
            ev = SkillEvidence(
                skill=s,
                tier="N",
                confidence="Low",
                evidence="Not found in resume.",
                section="Not recorded",
                required_by_jd="Required",
                match_status="Missing",
            )
            evidences.append(ev)
            ev_by_key[s.casefold()] = ev
    for s in preferred:
        if s.casefold() not in ev_by_key:
            ev = SkillEvidence(
                skill=s,
                tier="N",
                confidence="Low",
                evidence="Not found in resume.",
                section="Not recorded",
                required_by_jd="Preferred",
                match_status="Missing",
            )
            evidences.append(ev)
            ev_by_key[s.casefold()] = ev

    def skill_credit(skills: list[str]) -> tuple[float, list[str], list[str]]:
        if not skills:
            return 1.0, [], []
        matched, missing = [], []
        credit = 0.0
        for s in skills:
            ev = ev_by_key.get(s.casefold())
            tier = ev.tier if ev else "N"
            c = TIER_CREDIT.get(tier, 0.0)
            credit += c
            if c > 0:
                matched.append(s)
            else:
                missing.append(s)
        return credit / len(skills), matched, missing

    req_frac, req_matched, req_missing = skill_credit(required)
    pref_frac, pref_matched, pref_missing = skill_credit(preferred)

    assessments = raw.get("component_assessments") or {}
    raw_comps: list[tuple[str, float, str]] = [
        ("req", req_frac, f"{len(req_matched)} of {len(required)} required skills supported"),
    ]
    if preferred:
        raw_comps.append(("pref", pref_frac, f"{len(pref_matched)} of {len(preferred)} preferred skills supported"))

    target_years = float(job["experience_min"]) if job.get("experience_min") is not None else DEFAULT_EXPERIENCE_CAP
    exp_node = assessments.get("exp") if isinstance(assessments.get("exp"), dict) else {}
    if target_years > 0 and exp_node.get("applicable", True):
        default_exp_frac = min(parsed.experience_years / target_years, 1.0)
        exp_frac = _clean_float(exp_node.get("fraction"), default_exp_frac)
        raw_comps.append(("exp", exp_frac, _clean_str(exp_node.get("note")) or f"{parsed.experience_years:g} yrs vs {target_years:g} yrs target"))
    else:
        exp_frac = 1.0

    for key in ("edu", "proj", "resp", "ctx"):
        node = assessments.get(key)
        if not isinstance(node, dict):
            continue
        default_applicable = key in {"proj", "ctx"}
        if node.get("applicable", default_applicable):
            raw_comps.append((key, _clean_float(node.get("fraction"), 0.0), _clean_str(node.get("note"))))

    total_score, raw_score, components = compute_weighted_score(raw_comps)
    req_cov = int(round(req_frac * 100))

    raw_ov = raw.get("overview") or {}
    rec = recommendation_for_score(total_score)
    overview = CandidateOverview(
        headline=str(raw_ov.get("headline") or f"{rec} ({total_score}%) for {job.get('title', 'this role')}"),
        summary=str(raw_ov.get("summary") or ""),
        strengths=[str(x) for x in (raw_ov.get("strengths") or []) if str(x).strip()][:6],
        gaps=[str(x) for x in (raw_ov.get("gaps") or []) if str(x).strip()][:6],
        interview_questions=[str(x) for x in (raw_ov.get("interview_questions") or []) if str(x).strip()][:5],
        recommendation=rec,
    )

    return CandidateAnalysisResult(
        mode="ai",
        model=model_name,
        score=total_score,
        raw_score=raw_score,
        required_coverage=req_cov,
        components=components,
        skill_evidence=evidences,
        parsed_context=parsed,
        overview=overview,
        required={
            "matched": req_matched,
            "missing": req_missing,
            "coverage": req_cov,
        },
        preferred={
            "matched": pref_matched,
            "missing": pref_missing,
            "coverage": int(round(pref_frac * 100)),
        },
        experience={
            "years": parsed.experience_years,
            "target_years": target_years,
            "coverage": int(round(max(0.0, min(1.0, exp_frac)) * 100)),
        },
        disclaimer=DISCLAIMER,
    )


async def analyze_candidate(candidate: dict, job: dict) -> CandidateAnalysisResult:
    config = get_ai_config()
    if not config["enabled"]:
        return build_heuristic_analysis(candidate, job)

    job_payload = {
        "title": job.get("title", ""),
        "description": job.get("description", ""),
        "required_skills": job.get("required_skills") or [],
        "preferred_skills": job.get("preferred_skills") or [],
        "experience_min": job.get("experience_min"),
        "education": job.get("education", ""),
        "responsibilities": job.get("responsibilities") or [],
    }
    user_prompt = (
        f"JOB DESCRIPTION:\n{json.dumps(job_payload, ensure_ascii=False)}\n\n"
        f"CANDIDATE HINTS:\n{json.dumps({'name': candidate.get('name', ''), 'email': candidate.get('email', ''), 'filename': candidate.get('filename', ''), 'skills': candidate.get('skills') or []}, ensure_ascii=False)}\n\n"
        f"RESUME TEXT:\n{(candidate.get('resume_text') or '')[:40000]}"
    )

    try:
        raw = await _chat_json(CANDIDATE_SYSTEM_PROMPT, user_prompt, config)
        return _build_analysis_from_llm_json(raw, candidate, job, config["model"])
    except Exception as exc:
        err_tag = _safe_exc_summary(exc)
        logger.warning("AI candidate analysis failed (%s); fallback=%s", err_tag, config["fallback_heuristic"])
        if config["fallback_heuristic"]:
            return build_heuristic_analysis(
                candidate,
                job,
                fallback_reason=f"AI request failed: {err_tag}",
            )
        raise


async def generate_pool_overview(job: dict, ranked_items: list[dict]) -> PoolOverview:
    config = get_ai_config()
    if not ranked_items or not config["enabled"]:
        return build_heuristic_overview(job, ranked_items)

    ordered = sorted(ranked_items, key=lambda x: (-x["score"], x["candidate_id"]))
    scores = [x["score"] for x in ordered]
    avg_score = round(sum(scores) / len(scores), 1)
    high, low = max(scores), min(scores)

    compact_pool = [
        {
            "candidate_id": item["candidate_id"],
            "name": item["name"],
            "score": item["score"],
            "headline": item["analysis"].overview.headline,
            "strengths": item["analysis"].overview.strengths[:3],
            "gaps": item["analysis"].overview.gaps[:3],
            "matched_required": item["analysis"].required.get("matched", []),
            "missing_required": item["analysis"].required.get("missing", []),
        }
        for item in ordered
    ]
    user_prompt = (
        f"JOB:\n{json.dumps({'title': job.get('title', ''), 'required_skills': job.get('required_skills') or [], 'preferred_skills': job.get('preferred_skills') or []}, ensure_ascii=False)}\n\n"
        f"ANALYSED CANDIDATES ({len(compact_pool)} total, avg={avg_score}, range={low}-{high}):\n"
        f"{json.dumps(compact_pool, ensure_ascii=False)}"
    )

    by_id = {item["candidate_id"]: item for item in ordered}

    try:
        raw = await _chat_json(POOL_SYSTEM_PROMPT, user_prompt, config)
        if not isinstance(raw, dict):
            raise ValueError("LLM overview response must be a JSON object")
        top_picks = []
        seen_ids: set[int] = set()
        for p in (raw.get("top_picks") or [])[:5]:
            if not isinstance(p, dict):
                continue
            try:
                cid = int(p.get("candidate_id"))
            except (TypeError, ValueError):
                continue
            if cid not in by_id or cid in seen_ids:
                continue
            seen_ids.add(cid)
            real = by_id[cid]
            top_picks.append(
                TopPick(
                    candidate_id=cid,
                    name=real["name"],
                    score=real["score"],
                    reason=_clean_str(p.get("reason")) or real["analysis"].overview.headline,
                )
            )
        if not top_picks:
            top_picks = [
                TopPick(
                    candidate_id=item["candidate_id"],
                    name=item["name"],
                    score=item["score"],
                    reason=item["analysis"].overview.headline,
                )
                for item in ordered[:3]
            ]
        return PoolOverview(
            mode="ai",
            model=config["model"],
            candidate_count=len(ordered),
            average_score=avg_score,
            highest_score=high,
            lowest_score=low,
            executive_summary=_clean_str(raw.get("executive_summary")),
            top_picks=top_picks,
            common_strengths=_clean_str_list(raw.get("common_strengths"))[:5],
            common_gaps=_clean_str_list(raw.get("common_gaps"))[:5],
            sourcing_signal=_clean_str(raw.get("sourcing_signal")),
        )
    except Exception as exc:
        err_tag = _safe_exc_summary(exc)
        logger.warning("AI pool overview failed (%s); fallback=%s", err_tag, config["fallback_heuristic"])
        if config["fallback_heuristic"]:
            return build_heuristic_overview(
                job,
                ranked_items,
                fallback_reason=f"AI request failed: {err_tag}",
            )
        raise
