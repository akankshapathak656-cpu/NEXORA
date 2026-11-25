from pydantic import BaseModel, Field

class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=10000)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)

class CandidateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: str = Field(default="", max_length=254)
    experience_years: float = Field(default=0, ge=0, le=80)
    education: str = Field(default="", max_length=500)
    skills: list[str] = Field(default_factory=list)
    resume_text: str = Field(default="", max_length=100000)
    status: str = Field(default="New", max_length=40)

class StatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=40)
