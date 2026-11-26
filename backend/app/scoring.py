from collections import Counter
import re

from .schemas import (
    CandidateAnalysisResult,
    CandidateOverview,
    ParsedCandidateContext,
    PoolOverview,
    ScoreComponent,
    SkillEvidence,
    TopPick,
)

# 7-component weights matching frontend/src/data/weights.js
COMPONENT_WEIGHTS: dict[str, tuple[str, float]] = {
    "req": ("Required skills", 40.0),
    "pref": ("Preferred skills", 10.0),
    "exp": ("Relevant experience", 20.0),
    "edu": ("Education", 10.0),
    "proj": ("Project experience", 10.0),
    "resp": ("JD responsibilities", 5.0),
    "ctx": ("Use in work experience", 5.0),
}

TIER_CREDIT: dict[str, float] = {
    "D": 1.0,
    "E": 1.0,
    "M": 0.5,
    "I": 0.0,
    "N": 0.0,
}

DEFAULT_EXPERIENCE_CAP = 3.0
DISCLAIMER = (
    "Advisory screening aid only. A human must review the resume and make every hiring decision."
)


def _normalise(items) -> set[str]:
    return {str(x).strip().casefold() for x in items if str(x).strip()}


def recommendation_for_score(score: int) -> str:
    if score >= 80:
        return "Strong Fit"
    if score >= 65:
        return "Worth Reviewing"
    if score >= 45:
        return "Needs Verification"
    return "Limited Fit"


def compute_weighted_score(raw_components: list[tuple[str, float, str]]) -> tuple[int, float, list[ScoreComponent]]:
    """
    Rescale weights of active components to 100 and compute deterministic points.
    raw_components: list of (key, fraction_0_to_1, note)
    """
    active = [
        (key, max(0.0, min(1.0, float(frac))), note)
        for key, frac, note in raw_components
        if key in COMPONENT_WEIGHTS
    ]
    total_weight = sum(COMPONENT_WEIGHTS[k][1] for k, _, _ in active) or 1.0
    components: list[ScoreComponent] = []
    raw_total = 0.0
    for key, frac, note in active:
        label, weight = COMPONENT_WEIGHTS[key]
        max_pts = round(weight * 100.0 / total_weight, 2)
        pts = round(max_pts * frac, 2)
        raw_total += max_pts * frac
        components.append(
            ScoreComponent(
                key=key,
                label=label,
                weight=weight,
                fraction=round(frac, 4),
                points=pts,
                max_points=max_pts,
                note=note,
            )
        )
    raw_total = max(0.0, min(100.0, round(raw_total, 2)))
    return int(round(raw_total)), raw_total, components


def _extract_email(text: str) -> str:
    match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text or "")
    return match.group(0) if match else ""


def _extract_phone(text: str) -> str:
    match = re.search(r"(?:\+?\d[\d\s().-]{8,16}\d)", text or "")
    return match.group(0).strip() if match else ""


def _extract_years(text: str) -> float:
    matches = re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)", text or "", flags=re.IGNORECASE)
    if not matches:
        return 0.0
    vals = [float(m) for m in matches if float(m) <= 50]
    return max(vals) if vals else 0.0


def _guess_name(text: str, filename: str = "") -> str:
    for line in (text or "").splitlines():
        clean = line.strip()
        if not clean or "@" in clean or len(clean) > 60:
            continue
        if re.match(r"^[A-Za-z][A-Za-z .'-]{2,50}$", clean) and len(clean.split()) <= 4:
            return clean
    if filename:
        stem = filename.rsplit(".", 1)[0]
        cleaned = re.sub(r"[_\-]+", " ", stem).strip()
        if cleaned:
            return cleaned.title()[:80]
    return "Unnamed Candidate"


def _find_evidence_line(text: str, skill: str) -> str:
    needle = skill.casefold()
    for line in (text or "").splitlines():
        if needle in line.casefold():
            return line.strip()[:200]
    return ""


def score_candidate(candidate: dict, job: dict) -> dict:
    """
    Legacy baseline heuristic score kept for backwards compatibility.
    """
    skills = _normalise(candidate.get("skills") or [])
    text = (candidate.get("resume_text") or "").casefold()
    required = [s.strip() for s in (job.get("required_skills") or []) if str(s).strip()]
    preferred = [s.strip() for s in (job.get("preferred_skills") or []) if str(s).strip()]

    def found(skill: str) -> bool:
        key = skill.casefold()
        return key in skills or key in text

    req_hits = [s for s in required if found(s)]
    pref_hits = [s for s in preferred if found(s)]
    req_ratio = len(req_hits) / len(required) if required else 1.0
    pref_ratio = len(pref_hits) / len(preferred) if preferred else 1.0
    target_years = float(job.get("experience_min") or 3.0)
    exp_ratio = min(float(candidate.get("experience_years") or 0) / target_years, 1.0) if target_years > 0 else 1.0
    score = round(70 * req_ratio + 20 * pref_ratio + 10 * exp_ratio)

    return {
        "score": score,
        "required": {
            "matched": req_hits,
            "missing": [s for s in required if s not in req_hits],
            "coverage": round(req_ratio * 100),
        },
        "preferred": {
            "matched": pref_hits,
            "missing": [s for s in preferred if s not in pref_hits],
            "coverage": round(pref_ratio * 100),
        },
        "experience": {
            "years": candidate.get("experience_years") or 0,
            "target_years": target_years,
            "coverage": round(exp_ratio * 100),
        },
        "disclaimer": DISCLAIMER,
    }


def build_heuristic_analysis(
    candidate: dict,
    job: dict,
    *,
    fallback_reason: str | None = None,
) -> CandidateAnalysisResult:
    """
    Deterministic 7-component heuristic fallback matching the structured AI contract.
    """
    resume_text = candidate.get("resume_text") or ""
    text_cf = resume_text.casefold()
    listed_skills = [str(s).strip() for s in (candidate.get("skills") or []) if str(s).strip()]
    skills_cf = _normalise(listed_skills)

    required = [str(s).strip() for s in (job.get("required_skills") or []) if str(s).strip()]
    preferred = [str(s).strip() for s in (job.get("preferred_skills") or []) if str(s).strip()]
    responsibilities = [str(r).strip() for r in (job.get("responsibilities") or []) if str(r).strip()]
    job_edu = (job.get("education") or "").strip()
    target_years = float(job["experience_min"]) if job.get("experience_min") is not None else DEFAULT_EXPERIENCE_CAP

    exp_years = float(candidate.get("experience_years") or 0)
    if exp_years <= 0 and resume_text:
        exp_years = _extract_years(resume_text)

    skill_evidence: list[SkillEvidence] = []
    req_hits: list[str] = []
    req_missing: list[str] = []
    pref_hits: list[str] = []
    pref_missing: list[str] = []

    def evaluate_skill(skill: str, jd_bucket: str) -> SkillEvidence:
        key = skill.casefold()
        in_text = key in text_cf
        in_list = key in skills_cf
        ev_line = _find_evidence_line(resume_text, skill) if in_text else ""
        if in_text and len(ev_line.split()) >= 6:
            tier, conf, status, sec = "D", "Medium", "Matched", "Resume text"
        elif in_text:
            tier, conf, status, sec = "E", "Medium", "Matched", "Resume text"
        elif in_list:
            tier, conf, status, sec = "M", "Low", "Partial", "Skills"
        else:
            tier, conf, status, sec = "N", "Low", "Missing", "Not recorded"
        return SkillEvidence(
            skill=skill,
            category="Technical",
            tier=tier,
            confidence=conf,
            evidence=ev_line or ("Listed in candidate skills." if in_list else "Not found in resume."),
            section=sec,
            required_by_jd=jd_bucket,
            match_status=status,
        )

    for s in required:
        ev = evaluate_skill(s, "Required")
        skill_evidence.append(ev)
        if ev.tier in {"D", "E", "M"}:
            req_hits.append(s)
        else:
            req_missing.append(s)

    for s in preferred:
        if any(e.skill.casefold() == s.casefold() for e in skill_evidence):
            continue
        ev = evaluate_skill(s, "Preferred")
        skill_evidence.append(ev)
        if ev.tier in {"D", "E", "M"}:
            pref_hits.append(s)
        else:
            pref_missing.append(s)

    def credit_ratio(items: list[str]) -> float:
        if not items:
            return 1.0
        ev_map = {e.skill.casefold(): e.tier for e in skill_evidence}
        return sum(TIER_CREDIT.get(ev_map.get(s.casefold(), "N"), 0.0) for s in items) / len(items)

    req_frac = credit_ratio(required)
    raw_comps: list[tuple[str, float, str]] = [
        (
            "req",
            req_frac,
            f"{len(req_hits)} of {len(required)} required skills matched" if required else "No required skills specified",
        ),
    ]

    pref_frac = credit_ratio(preferred)
    if preferred:
        raw_comps.append(("pref", pref_frac, f"{len(pref_hits)} of {len(preferred)} preferred skills matched"))

    if target_years > 0:
        exp_frac = min(exp_years / target_years, 1.0)
        raw_comps.append(("exp", exp_frac, f"{exp_years:g} yrs vs {target_years:g} yrs target"))
    else:
        exp_frac = 1.0

    cand_edu = (candidate.get("education") or "").strip()
    if job_edu:
        edu_tokens = [t for t in re.findall(r"[a-zA-Z]{2,}", job_edu.casefold()) if t not in {"degree", "in", "or", "equivalent"}]
        edu_haystack = f"{cand_edu} {resume_text}".casefold()
        edu_hit = any(tok in edu_haystack for tok in edu_tokens) if edu_tokens else bool(cand_edu)
        raw_comps.append(("edu", 1.0 if edu_hit else 0.0, "Education requirement matched" if edu_hit else "Education requirement not confirmed"))

    # Project & work-context heuristic estimates from evidence tiers
    proj_hits = sum(1 for e in skill_evidence if e.required_by_jd == "Required" and e.tier == "D")
    proj_frac = (proj_hits / len(required)) if required else 0.0
    raw_comps.append(("proj", proj_frac, f"{proj_hits} of {len(required)} required skills demonstrated in context"))

    if responsibilities:
        resp_hits = 0
        for r in responsibilities:
            words = [w for w in re.findall(r"[a-zA-Z]{4,}", r.casefold())]
            if words and sum(1 for w in words if w in text_cf) >= max(2, len(words) // 4):
                resp_hits += 1
        raw_comps.append(("resp", resp_hits / len(responsibilities), f"{resp_hits} of {len(responsibilities)} JD responsibilities aligned"))

    ctx_frac = proj_frac
    raw_comps.append(("ctx", ctx_frac, f"{proj_hits} of {len(required)} required skills used in work/project lines"))

    total_score, raw_score, components = compute_weighted_score(raw_comps)
    req_cov = int(round(req_frac * 100))

    name = (candidate.get("name") or "").strip() or _guess_name(resume_text, candidate.get("filename") or "")
    email = (candidate.get("email") or "").strip() or _extract_email(resume_text)
    phone = (candidate.get("phone") or "").strip() or _extract_phone(resume_text)
    all_skills = list(dict.fromkeys(listed_skills + req_hits + pref_hits))

    strengths = []
    if req_hits:
        strengths.append(f"Evidences required skills: {', '.join(req_hits[:6])}")
    if pref_hits:
        strengths.append(f"Also covers preferred skills: {', '.join(pref_hits[:4])}")
    if exp_years > 0:
        strengths.append(f"Lists {exp_years:g} years of experience")

    gaps = []
    if req_missing:
        gaps.append(f"Missing required skills: {', '.join(req_missing[:6])}")
    if target_years > 0 and exp_years < target_years:
        gaps.append(f"Experience ({exp_years:g} yrs) is below target ({target_years:g} yrs)")

    questions = [
        f"Can you walk through hands-on production work using {s}?"
        for s in req_missing[:3]
    ]
    if not questions and req_hits:
        questions.append(f"Describe the most complex system you built with {req_hits[0]}.")

    rec = recommendation_for_score(total_score)
    headline = f"{rec} ({total_score}%) — {len(req_hits)}/{len(required)} required skills matched"
    summary = (
        f"{name} scores {total_score}/100 for {job.get('title', 'this role')} in heuristic mode. "
        f"Matched {len(req_hits)} of {len(required)} required skills"
        + (f" ({', '.join(req_hits[:4])})" if req_hits else "")
        + (f" with {len(req_missing)} missing ({', '.join(req_missing[:4])})." if req_missing else ".")
    )

    return CandidateAnalysisResult(
        mode="heuristic",
        model="heuristic-v1",
        score=total_score,
        raw_score=raw_score,
        required_coverage=req_cov,
        components=components,
        skill_evidence=skill_evidence,
        parsed_context=ParsedCandidateContext(
            name=name,
            email=email,
            phone=phone,
            experience_years=exp_years,
            education=cand_edu,
            skills=all_skills,
        ),
        overview=CandidateOverview(
            headline=headline,
            summary=summary,
            strengths=strengths or ["Resume text extracted and evaluated"],
            gaps=gaps or ["No major skill gaps detected against listed requirements"],
            interview_questions=questions,
            recommendation=rec,
        ),
        required={
            "matched": req_hits,
            "missing": req_missing,
            "coverage": req_cov,
        },
        preferred={
            "matched": pref_hits,
            "missing": pref_missing,
            "coverage": int(round(pref_frac * 100)),
        },
        experience={
            "years": exp_years,
            "target_years": target_years,
            "coverage": int(round(exp_frac * 100)),
        },
        fallback_reason=fallback_reason,
        disclaimer=DISCLAIMER,
    )


def build_heuristic_overview(
    job: dict,
    ranked_items: list[dict],
    *,
    fallback_reason: str | None = None,
) -> PoolOverview:
    """
    Deterministic pool-level overview built from analysed candidates.
    ranked_items: list of {"candidate_id", "name", "score", "analysis": CandidateAnalysisResult}
    """
    if not ranked_items:
        return PoolOverview(
            mode="heuristic",
            model="heuristic-v1",
            candidate_count=0,
            executive_summary=f"No candidates have been analysed for {job.get('title', 'this role')} yet.",
            sourcing_signal="Upload and analyse resumes to generate a pool overview.",
            fallback_reason=fallback_reason,
        )

    ordered = sorted(ranked_items, key=lambda x: (-x["score"], x["candidate_id"]))
    scores = [x["score"] for x in ordered]
    avg_score = round(sum(scores) / len(scores), 1)
    high, low = max(scores), min(scores)

    matched_counter: Counter[str] = Counter()
    missing_counter: Counter[str] = Counter()
    for item in ordered:
        analysis: CandidateAnalysisResult = item["analysis"]
        for s in analysis.required.get("matched", []):
            matched_counter[s] += 1
        for s in analysis.required.get("missing", []):
            missing_counter[s] += 1

    common_strengths = [
        f"{skill} ({count}/{len(ordered)} candidates)"
        for skill, count in matched_counter.most_common(4)
    ]
    common_gaps = [
        f"{skill} missing in {count}/{len(ordered)} candidates"
        for skill, count in missing_counter.most_common(4)
    ]

    top_picks = [
        TopPick(
            candidate_id=item["candidate_id"],
            name=item["name"],
            score=item["score"],
            reason=item["analysis"].overview.headline,
        )
        for item in ordered[:3]
    ]

    strong_count = sum(1 for s in scores if s >= 75)
    if strong_count >= 2:
        signal = f"Strong pool: {strong_count} candidates scored 75+. Ready to schedule interviews with top picks."
    elif high >= 65:
        signal = f"Moderate pool: top candidate at {high}%. Interview top pick(s) while continuing targeted sourcing."
    else:
        signal = f"Thin pool (highest score {high}%). Consider widening sourcing or reviewing JD must-haves."

    exec_summary = (
        f"Analysed {len(ordered)} candidate(s) for {job.get('title', 'this role')} with an average score of {avg_score}% "
        f"(range {low}%–{high}%). "
        f"Top candidate is {ordered[0]['name']} ({ordered[0]['score']}%). "
        + (f"Most frequent gap: {common_gaps[0]}." if common_gaps else "Core required skills are well covered.")
    )

    return PoolOverview(
        mode="heuristic",
        model="heuristic-v1",
        candidate_count=len(ordered),
        average_score=avg_score,
        highest_score=high,
        lowest_score=low,
        executive_summary=exec_summary,
        top_picks=top_picks,
        common_strengths=common_strengths,
        common_gaps=common_gaps,
        sourcing_signal=signal,
        fallback_reason=fallback_reason,
    )
