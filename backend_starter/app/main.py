import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .database import connect, init_db
from .schemas import JobCreate, CandidateCreate, StatusUpdate
from .scoring import score_candidate

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="NEXORA API", version="1.0.0", lifespan=lifespan)

# Set NEXORA_CORS_ORIGINS to your deployed frontend URL in production.
import os
origins = os.getenv("NEXORA_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500,https://nexora-beta-six-33.vercel.app").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in origins if x.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

def row_to_dict(row):
    return dict(row) if row else None

def decode_job(row):
    data = row_to_dict(row)
    if data:
        data["required_skills"] = json.loads(data["required_skills"])
        data["preferred_skills"] = json.loads(data["preferred_skills"])
    return data

def decode_candidate(row):
    data = row_to_dict(row)
    if data:
        data["skills"] = json.loads(data["skills"])
    return data

@app.get("/")
def root():
    return {"name": "NEXORA API", "docs": "/docs", "health": "/api/health"}

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "nexora-api"}

@app.post("/api/jobs", status_code=201)
def create_job(payload: JobCreate):
    with connect() as db:
        cur = db.execute(
            "INSERT INTO jobs(title, description, required_skills, preferred_skills) VALUES(?,?,?,?)",
            (payload.title, payload.description, json.dumps(payload.required_skills), json.dumps(payload.preferred_skills))
        )
        return decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (cur.lastrowid,)).fetchone())

@app.get("/api/jobs")
def list_jobs():
    with connect() as db:
        return [decode_job(r) for r in db.execute("SELECT * FROM jobs ORDER BY id DESC")]

@app.get("/api/jobs/{job_id}")
def get_job(job_id: int):
    with connect() as db:
        job = decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
    if not job:
        raise HTTPException(404, "Job not found")
    return job

@app.post("/api/candidates", status_code=201)
def create_candidate(payload: CandidateCreate):
    with connect() as db:
        cur = db.execute(
            """INSERT INTO candidates(name,email,experience_years,education,skills,resume_text,status)
               VALUES(?,?,?,?,?,?,?)""",
            (payload.name, payload.email, payload.experience_years, payload.education,
             json.dumps(payload.skills), payload.resume_text, payload.status)
        )
        return decode_candidate(db.execute("SELECT * FROM candidates WHERE id=?", (cur.lastrowid,)).fetchone())

@app.get("/api/candidates")
def list_candidates():
    with connect() as db:
        return [decode_candidate(r) for r in db.execute("SELECT * FROM candidates ORDER BY id DESC")]

@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: int):
    with connect() as db:
        candidate = decode_candidate(db.execute("SELECT * FROM candidates WHERE id=?", (candidate_id,)).fetchone())
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    return candidate

@app.patch("/api/candidates/{candidate_id}/status")
def update_status(candidate_id: int, payload: StatusUpdate):
    allowed = {"New", "Needs review", "Shortlisted", "Interview", "Hired", "Rejected"}
    if payload.status not in allowed:
        raise HTTPException(400, f"Status must be one of: {', '.join(sorted(allowed))}")
    with connect() as db:
        cur = db.execute("UPDATE candidates SET status=? WHERE id=?", (payload.status, candidate_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "Candidate not found")
        return decode_candidate(db.execute("SELECT * FROM candidates WHERE id=?", (candidate_id,)).fetchone())

@app.delete("/api/candidates/{candidate_id}", status_code=204)
def delete_candidate(candidate_id: int):
    with connect() as db:
        cur = db.execute("DELETE FROM candidates WHERE id=?", (candidate_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Candidate not found")
    return None

@app.post("/api/jobs/{job_id}/score/{candidate_id}")
def score(job_id: int, candidate_id: int):
    with connect() as db:
        job = decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
        candidate = decode_candidate(db.execute("SELECT * FROM candidates WHERE id=?", (candidate_id,)).fetchone())
    if not job:
        raise HTTPException(404, "Job not found")
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    return {"job": {"id": job["id"], "title": job["title"]},
            "candidate": {"id": candidate["id"], "name": candidate["name"]},
            **score_candidate(candidate, job)}

@app.post("/api/resumes/extract")
async def extract_resume(file: UploadFile = File(...)):
    """
    Optional extraction endpoint. PDF/DOCX extraction is intentionally not
    implemented in this minimal starter; add vetted parsers before enabling it.
    """
    name = (file.filename or "").lower()
    if not (name.endswith(".pdf") or name.endswith(".docx")):
        raise HTTPException(415, "Upload a PDF or DOCX file")
    raise HTTPException(501, "Resume extraction is not enabled yet. Extract text in the browser or add PDF/DOCX parsers.")
