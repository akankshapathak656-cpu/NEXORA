from pydantic import BaseModel, Field
from typing import List

class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = ""
    required_skills: List[str] = []
    preferred_skills: List[str] = []

class CandidateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: str = ""
    experience_years: float = Field(default=0, ge=0, le=80)
    education: str = ""
    skills: List[str] = []
    resume_text: str = ""
    status: str = "New"

class StatusUpdate(BaseModel):
    status: str
