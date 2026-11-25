import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .database import connect, init_db
from .schemas import CandidateCreate, JobCreate, StatusUpdate
from .scoring import score_candidate

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="NEXORA API",
    description="Prototype API for NEXORA recruiter-support workflows.",
    version="1.0.0",
    lifespan=lifespan,
)

# Set this to the exact frontend origin(s) in deployment. In Codespaces,
# use the forwarded frontend origin if the frontend is served on another port.
origins = [
    item.strip()
    for item in os.getenv(
        "NEXORA_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500,https://nexora-beta-six-33.vercel.app,https://urban-space-memory-qvgqwqj744ppfj9v-5500.app.github.dev",
    ).split(",")
    if item.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
            (payload.title, payload.description, json.dumps(payload.required_skills), json.dumps(payload.preferred_skills)),
        )
        return decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (cur.lastrowid,)).fetchone())

@app.get("/api/jobs")
def list_jobs():
    with connect() as db:
        return [decode_job(row) for row in db.execute("SELECT * FROM jobs ORDER BY id DESC")]

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
             json.dumps(payload.skills), payload.resume_text, payload.status),
        )
        return decode_candidate(db.execute("SELECT * FROM candidates WHERE id=?", (cur.lastrowid,)).fetchone())

@app.get("/api/candidates")
def list_candidates():
    with connect() as db:
        return [decode_candidate(row) for row in db.execute("SELECT * FROM candidates ORDER BY id DESC")]

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
    return {
        "job": {"id": job["id"], "title": job["title"]},
        "candidate": {"id": candidate["id"], "name": candidate["name"]},
        **score_candidate(candidate, job),
    }

@app.post("/api/resumes/extract")
async def extract_resume(file: UploadFile = File(...)):
    """Extract selectable text from a PDF or DOCX resume."""
    from io import BytesIO

    filename = (file.filename or "").strip()
    extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if extension not in {"pdf", "docx"}:
        raise HTTPException(415, "Upload a PDF or DOCX file")

    content = await file.read()
    if not content:
        raise HTTPException(400, "The uploaded file is empty")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Resume file exceeds the 10 MB limit")

    try:
        if extension == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(content))
            if reader.is_encrypted:
                raise HTTPException(422, "Password-protected PDFs are not supported")
            pages = reader.pages
            text = "\n".join((page.extract_text() or "") for page in pages)
            page_count = len(pages)
        else:
            from docx import Document
            document = Document(BytesIO(content))
            paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
            table_text = [
                " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                for table in document.tables
                for row in table.rows
            ]
            text = "\n".join(paragraphs + [line for line in table_text if line])
            page_count = None
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, "The file could not be read. Check that it is a valid, uncorrupted PDF or DOCX.")

    text = text.strip()
    if not text:
        raise HTTPException(422, "No selectable text was found. Scanned/image-only PDFs require OCR, which is not enabled.")
    return {
        "filename": filename,
        "text": text[:120000],
        "characters": min(len(text), 120000),
        "pages": page_count,
        "truncated": len(text) > 120000,
    }
