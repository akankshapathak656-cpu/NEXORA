from typing import Literal

from pydantic import BaseModel, Field


class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=20000)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    experience_min: float | None = Field(default=None, ge=0, le=50)
    education: str = Field(default="", max_length=500)
    responsibilities: list[str] = Field(default_factory=list)


class CandidateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=60)
    experience_years: float = Field(default=0, ge=0, le=80)
    education: str = Field(default="", max_length=500)
    skills: list[str] = Field(default_factory=list)
    resume_text: str = Field(default="", max_length=120000)
    filename: str = Field(default="", max_length=255)
    status: str = Field(default="New", max_length=40)


class StatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=40)


class WorkEntry(BaseModel):
    title: str = ""
    company: str = ""
    date_range: str = ""
    skills: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    title: str = ""
    description: str = ""
    skills: list[str] = Field(default_factory=list)


class ParsedCandidateContext(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    experience_years: float = 0.0
    education: str = ""
    skills: list[str] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    work: list[WorkEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)


class SkillEvidence(BaseModel):
    skill: str
    category: str = "Technical"
    tier: Literal["D", "E", "M", "I", "N"] = "N"
    confidence: Literal["High", "Medium", "Low"] = "Low"
    evidence: str = ""
    section: str = "Not recorded"
    required_by_jd: Literal["Required", "Preferred", "Additional"] = "Required"
    match_status: Literal["Matched", "Partial", "Missing", "Additional"] = "Missing"


class ScoreComponent(BaseModel):
    key: Literal["req", "pref", "exp", "edu", "proj", "resp", "ctx"]
    label: str
    weight: float
    fraction: float = Field(ge=0.0, le=1.0)
    points: float = 0.0
    max_points: float = 0.0
    note: str = ""


class CandidateOverview(BaseModel):
    headline: str
    summary: str
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    interview_questions: list[str] = Field(default_factory=list)
    recommendation: Literal[
        "Strong Fit",
        "Worth Reviewing",
        "Needs Verification",
        "Limited Fit",
    ] = "Needs Verification"


class CandidateAnalysisResult(BaseModel):
    mode: Literal["ai", "heuristic"]
    model: str = ""
    score: int = Field(ge=0, le=100)
    raw_score: float = Field(ge=0.0, le=100.0)
    required_coverage: int = Field(ge=0, le=100)
    components: list[ScoreComponent] = Field(default_factory=list)
    skill_evidence: list[SkillEvidence] = Field(default_factory=list)
    parsed_context: ParsedCandidateContext = Field(default_factory=ParsedCandidateContext)
    overview: CandidateOverview
    required: dict = Field(default_factory=dict)
    preferred: dict = Field(default_factory=dict)
    experience: dict = Field(default_factory=dict)
    fallback_reason: str | None = None
    disclaimer: str = (
        "Advisory screening aid only. A human must review the resume and make every hiring decision."
    )


class TopPick(BaseModel):
    candidate_id: int
    name: str
    score: int
    reason: str


class PoolOverview(BaseModel):
    mode: Literal["ai", "heuristic"]
    model: str = ""
    candidate_count: int = 0
    average_score: float = 0.0
    highest_score: int = 0
    lowest_score: int = 0
    executive_summary: str
    top_picks: list[TopPick] = Field(default_factory=list)
    common_strengths: list[str] = Field(default_factory=list)
    common_gaps: list[str] = Field(default_factory=list)
    sourcing_signal: str = ""
    fallback_reason: str | None = None
    disclaimer: str = (
        "Advisory pool summary only. A human must review each candidate and make every hiring decision."
    )


class AnalyzeTextItem(BaseModel):
    filename: str = Field(default="", max_length=255)
    text: str = Field(min_length=1, max_length=120000)
    name: str = Field(default="", max_length=160)
    email: str = Field(default="", max_length=254)


class AnalyzeTextRequest(BaseModel):
    resumes: list[AnalyzeTextItem] = Field(min_length=1, max_length=50)
    include_overview: bool = True
