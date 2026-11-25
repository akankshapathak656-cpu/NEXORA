def _normalise(items):
    return {str(x).strip().casefold() for x in items if str(x).strip()}

def score_candidate(candidate, job):
    """
    Transparent baseline score, not an automated hiring decision.
    Required skills: 70%; preferred skills: 20%; experience: 10%.
    A skill is counted only if present in the candidate's declared skills
    or resume text. Production use should add evidence spans and human review.
    """
    skills = _normalise(candidate["skills"])
    text = (candidate["resume_text"] or "").casefold()
    required = [s.strip() for s in job["required_skills"] if s.strip()]
    preferred = [s.strip() for s in job["preferred_skills"] if s.strip()]

    def found(skill):
        key = skill.casefold()
        return key in skills or key in text

    req_hits = [s for s in required if found(s)]
    pref_hits = [s for s in preferred if found(s)]
    req_ratio = len(req_hits) / len(required) if required else 1.0
    pref_ratio = len(pref_hits) / len(preferred) if preferred else 1.0

    # Experience target is a deliberately simple configurable baseline.
    target_years = 3.0
    exp_ratio = min(float(candidate["experience_years"] or 0) / target_years, 1.0)

    score = round(70 * req_ratio + 20 * pref_ratio + 10 * exp_ratio)
    return {
        "score": score,
        "required": {"matched": req_hits, "missing": [s for s in required if s not in req_hits],
                     "coverage": round(req_ratio * 100)},
        "preferred": {"matched": pref_hits, "missing": [s for s in preferred if s not in pref_hits],
                      "coverage": round(pref_ratio * 100)},
        "experience": {"years": candidate["experience_years"], "target_years": target_years,
                       "coverage": round(exp_ratio * 100)},
        "disclaimer": "Advisory screening aid only. A human must review the resume and make every hiring decision."
    }
