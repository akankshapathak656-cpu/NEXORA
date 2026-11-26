import asyncio
import hashlib
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .ai_scoring import analyze_candidate, generate_pool_overview, get_ai_config
from .database import connect, init_db
from .extract import extract_resume_bytes
from .schemas import (
    AnalyzeTextRequest,
    CandidateAnalysisResult,
    CandidateCreate,
    JobCreate,
    PoolOverview,
    StatusUpdate,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="NEXORA API",
    description="API for NEXORA recruiter-support workflows, resume extraction, and AI scoring.",
    version="1.1.0",
    lifespan=lifespan,
)

# Set this to the exact frontend origin(s) in deployment.
origins = [
    item.strip()
    for item in os.getenv(
        "NEXORA_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500,https://nexora-beta-six-33.vercel.app,https://urban-space-memory-qvgqwqj744ppfj9v-5500.app.github.dev",
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
        data["responsibilities"] = json.loads(data.get("responsibilities") or "[]")
    return data


def decode_candidate(row):
    data = row_to_dict(row)
    if data:
        data["skills"] = json.loads(data["skills"])
    return data


def _save_analysis(db, job_id: int, candidate_id: int, result: CandidateAnalysisResult) -> None:
    db.execute(
        """
        INSERT INTO candidate_analyses(job_id, candidate_id, mode, model, score, payload_json, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(job_id, candidate_id) DO UPDATE SET
            mode = excluded.mode,
            model = excluded.model,
            score = excluded.score,
            payload_json = excluded.payload_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            job_id,
            candidate_id,
            result.mode,
            result.model,
            result.score,
            result.model_dump_json(),
        ),
    )


def _load_job_analyses(db, job_id: int) -> list[dict]:
    rows = db.execute(
        """
        SELECT ca.candidate_id, ca.score, ca.payload_json, ca.updated_at,
               c.name, c.email, c.phone, c.experience_years, c.education, c.skills, c.filename, c.status
        FROM candidate_analyses ca
        JOIN candidates c ON c.id = ca.candidate_id
        WHERE ca.job_id = ?
        ORDER BY ca.score DESC, ca.candidate_id ASC
        """,
        (job_id,),
    ).fetchall()
    items = []
    for row in rows:
        analysis = CandidateAnalysisResult.model_validate_json(row["payload_json"])
        items.append(
            {
                "candidate_id": row["candidate_id"],
                "name": row["name"],
                "score": row["score"],
                "status": row["status"],
                "filename": row["filename"],
                "updated_at": row["updated_at"],
                "analysis": analysis,
            }
        )
    return items


def _pool_hash(job_id: int, items: list[dict], mode_tag: str) -> str:
    sig = "|".join(
        f"{item['candidate_id']}:{item['score']}:{item['updated_at']}"
        for item in sorted(items, key=lambda x: x["candidate_id"])
    )
    return hashlib.sha256(f"{job_id}|{mode_tag}|{sig}".encode()).hexdigest()


async def _get_or_create_overview(job: dict, force: bool = False) -> PoolOverview:
    with connect() as db:
        items = _load_job_analyses(db, job["id"])
        cfg = get_ai_config()
        mode_tag = f"ai:{cfg['model']}" if cfg["enabled"] else "heuristic"
        phash = _pool_hash(job["id"], items, mode_tag)
        if not force:
            cached = db.execute(
                "SELECT pool_hash, payload_json FROM job_overviews WHERE job_id = ?",
                (job["id"],),
            ).fetchone()
            if cached and cached["pool_hash"] == phash:
                return PoolOverview.model_validate_json(cached["payload_json"])

    overview = await generate_pool_overview(job, items)

    with connect() as db:
        db.execute(
            """
            INSERT INTO job_overviews(job_id, pool_hash, mode, model, payload_json, updated_at)
            VALUES(?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(job_id) DO UPDATE SET
                pool_hash = excluded.pool_hash,
                mode = excluded.mode,
                model = excluded.model,
                payload_json = excluded.payload_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                job["id"],
                phash,
                overview.mode,
                overview.model,
                overview.model_dump_json(),
            ),
        )
    return overview


@app.get("/")
def root():
    return {"name": "NEXORA API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "nexora-api"}


@app.get("/api/config/ai")
def ai_status():
    cfg = get_ai_config()
    return {
        "ai_enabled": cfg["enabled"],
        "mode": "ai" if cfg["enabled"] else "heuristic",
        "model": cfg["model"] if cfg["enabled"] else "heuristic-v1",
        "reasoning_effort": cfg["reasoning_effort"] or None,
        "max_concurrency": cfg["max_concurrency"],
        "base_url_configured": bool(cfg["base_url"]),
    }


@app.post("/api/jobs", status_code=201)
def create_job(payload: JobCreate, upsert: bool = Query(default=False)):
    req_json = json.dumps(payload.required_skills)
    pref_json = json.dumps(payload.preferred_skills)
    resp_json = json.dumps(payload.responsibilities)
    with connect() as db:
        if upsert:
            existing = db.execute(
                "SELECT * FROM jobs WHERE lower(title) = lower(?) ORDER BY id DESC LIMIT 1",
                (payload.title,),
            ).fetchone()
            if existing:
                changed = (
                    existing["description"] != payload.description
                    or existing["required_skills"] != req_json
                    or existing["preferred_skills"] != pref_json
                    or existing["experience_min"] != payload.experience_min
                    or existing["education"] != payload.education
                    or (existing["responsibilities"] or "[]") != resp_json
                )
                if changed:
                    db.execute(
                        """UPDATE jobs
                           SET title=?, description=?, required_skills=?, preferred_skills=?,
                               experience_min=?, education=?, responsibilities=?
                           WHERE id=?""",
                        (
                            payload.title,
                            payload.description,
                            req_json,
                            pref_json,
                            payload.experience_min,
                            payload.education,
                            resp_json,
                            existing["id"],
                        ),
                    )
                    db.execute("DELETE FROM candidate_analyses WHERE job_id=?", (existing["id"],))
                    db.execute("DELETE FROM job_overviews WHERE job_id=?", (existing["id"],))
                return decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (existing["id"],)).fetchone())

        cur = db.execute(
            """INSERT INTO jobs(title, description, required_skills, preferred_skills, experience_min, education, responsibilities)
               VALUES(?,?,?,?,?,?,?)""",
            (
                payload.title,
                payload.description,
                req_json,
                pref_json,
                payload.experience_min,
                payload.education,
                resp_json,
            ),
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
def create_candidate(payload: CandidateCreate, upsert: bool = Query(default=False)):
    skills_json = json.dumps(payload.skills)
    with connect() as db:
        if upsert:
            existing = None
            if payload.email.strip():
                existing = db.execute(
                    "SELECT * FROM candidates WHERE lower(email) = lower(?) ORDER BY id DESC LIMIT 1",
                    (payload.email.strip(),),
                ).fetchone()
            if not existing:
                existing = db.execute(
                    "SELECT * FROM candidates WHERE lower(name) = lower(?) ORDER BY id DESC LIMIT 1",
                    (payload.name.strip(),),
                ).fetchone()
            if existing:
                changed = (
                    existing["resume_text"] != payload.resume_text
                    or existing["skills"] != skills_json
                    or existing["experience_years"] != payload.experience_years
                    or existing["education"] != payload.education
                    or existing["email"] != payload.email
                    or existing["phone"] != payload.phone
                )
                if changed:
                    db.execute(
                        """UPDATE candidates
                           SET name=?, email=?, phone=?, experience_years=?, education=?,
                               skills=?, resume_text=?, filename=?
                           WHERE id=?""",
                        (
                            payload.name,
                            payload.email,
                            payload.phone,
                            payload.experience_years,
                            payload.education,
                            skills_json,
                            payload.resume_text,
                            payload.filename,
                            existing["id"],
                        ),
                    )
                    db.execute("DELETE FROM candidate_analyses WHERE candidate_id=?", (existing["id"],))
                return decode_candidate(db.execute("SELECT * FROM candidates WHERE id=?", (existing["id"],)).fetchone())

        cur = db.execute(
            """INSERT INTO candidates(name,email,phone,experience_years,education,skills,resume_text,filename,status)
               VALUES(?,?,?,?,?,?,?,?,?)""",
            (
                payload.name,
                payload.email,
                payload.phone,
                payload.experience_years,
                payload.education,
                skills_json,
                payload.resume_text,
                payload.filename,
                payload.status,
            ),
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
async def score(job_id: int, candidate_id: int, force: bool = Query(default=False)):
    cfg = get_ai_config()
    expected_mode = "ai" if cfg["enabled"] else "heuristic"
    expected_model = cfg["model"] if cfg["enabled"] else "heuristic-v1"

    with connect() as db:
        job = decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
        candidate = decode_candidate(db.execute("SELECT * FROM candidates WHERE id=?", (candidate_id,)).fetchone())
        cached_row = (
            db.execute(
                "SELECT mode, model, payload_json FROM candidate_analyses WHERE job_id=? AND candidate_id=?",
                (job_id, candidate_id),
            ).fetchone()
            if (job and candidate and not force)
            else None
        )
    if not job:
        raise HTTPException(404, "Job not found")
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    if cached_row and cached_row["mode"] == expected_mode and cached_row["model"] == expected_model:
        result = CandidateAnalysisResult.model_validate_json(cached_row["payload_json"])
        cached = True
    else:
        result = await analyze_candidate(candidate, job)
        with connect() as db:
            _save_analysis(db, job_id, candidate_id, result)
        cached = False

    return {
        "job": {"id": job["id"], "title": job["title"]},
        "candidate": {"id": candidate["id"], "name": candidate["name"]},
        "cached": cached,
        **result.model_dump(),
    }


@app.get("/api/jobs/{job_id}/analyses")
def list_job_analyses(job_id: int):
    with connect() as db:
        job = decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
        if not job:
            raise HTTPException(404, "Job not found")
        items = _load_job_analyses(db, job_id)
        overview_row = db.execute(
            "SELECT payload_json FROM job_overviews WHERE job_id=?",
            (job_id,),
        ).fetchone()
    return {
        "job": {"id": job["id"], "title": job["title"]},
        "analyses": [
            {
                "candidate_id": item["candidate_id"],
                "name": item["name"],
                "status": item["status"],
                "filename": item["filename"],
                "updated_at": item["updated_at"],
                **item["analysis"].model_dump(),
            }
            for item in items
        ],
        "pool_overview": (
            PoolOverview.model_validate_json(overview_row["payload_json"]).model_dump()
            if overview_row
            else None
        ),
    }


async def _run_batch_analysis(
    job: dict,
    extracted_items: list[dict],
    errors: list[dict],
    include_overview: bool,
) -> dict:
    cfg = get_ai_config()
    semaphore = asyncio.Semaphore(cfg["max_concurrency"])

    async def process_one(item: dict) -> dict:
        async with semaphore:
            draft = {
                "name": item.get("name", ""),
                "email": item.get("email", ""),
                "phone": "",
                "experience_years": 0.0,
                "education": "",
                "skills": [],
                "resume_text": item["text"],
                "filename": item.get("filename", ""),
            }
            analysis = await analyze_candidate(draft, job)
            parsed = analysis.parsed_context
            with connect() as db:
                cur = db.execute(
                    """INSERT INTO candidates(name,email,phone,experience_years,education,skills,resume_text,filename,status)
                       VALUES(?,?,?,?,?,?,?,?,?)""",
                    (
                        parsed.name or item.get("name") or "Unnamed Candidate",
                        parsed.email or item.get("email") or "",
                        parsed.phone or "",
                        parsed.experience_years,
                        parsed.education,
                        json.dumps(parsed.skills),
                        item["text"],
                        item.get("filename", ""),
                        "New",
                    ),
                )
                candidate = decode_candidate(
                    db.execute("SELECT * FROM candidates WHERE id=?", (cur.lastrowid,)).fetchone()
                )
                _save_analysis(db, job["id"], candidate["id"], analysis)
            return {
                "candidate": candidate,
                "extraction": {
                    "filename": item.get("filename", ""),
                    "characters": len(item["text"]),
                    "pages": item.get("pages"),
                    "truncated": bool(item.get("truncated", False)),
                },
                "analysis": analysis.model_dump(),
            }

    results = []
    if extracted_items:
        outcomes = await asyncio.gather(
            *(process_one(item) for item in extracted_items),
            return_exceptions=True,
        )
        for item, outcome in zip(extracted_items, outcomes):
            if isinstance(outcome, Exception):
                errors.append(
                    {
                        "filename": item.get("filename", ""),
                        "error": f"Analysis failed ({type(outcome).__name__})",
                    }
                )
            else:
                results.append(outcome)

    results.sort(key=lambda r: (-r["analysis"]["score"], r["candidate"]["id"]))

    pool_overview = None
    if include_overview and results:
        pool_overview = (await _get_or_create_overview(job, force=True)).model_dump()

    effective_mode = (
        "ai"
        if any(r["analysis"]["mode"] == "ai" for r in results)
        else ("ai" if (not results and cfg["enabled"]) else "heuristic")
    )

    return {
        "job": {"id": job["id"], "title": job["title"]},
        "mode": effective_mode,
        "results": results,
        "errors": errors,
        "pool_overview": pool_overview,
    }


@app.post("/api/jobs/{job_id}/analyze")
async def analyze_resumes(
    job_id: int,
    files: list[UploadFile] = File(...),
    include_overview: bool = Query(default=True),
):
    if len(files) > 50:
        raise HTTPException(400, "Upload at most 50 resume files per batch")

    with connect() as db:
        job = decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
    if not job:
        raise HTTPException(404, "Job not found")

    extracted_items: list[dict] = []
    errors: list[dict] = []
    for upload in files:
        filename = (upload.filename or "").strip()
        try:
            content = await upload.read()
            extracted = extract_resume_bytes(filename, content)
            extracted_items.append(extracted)
        except HTTPException as exc:
            errors.append({"filename": filename, "error": exc.detail, "status_code": exc.status_code})

    return await _run_batch_analysis(job, extracted_items, errors, include_overview)


@app.post("/api/jobs/{job_id}/analyze-text")
async def analyze_resume_texts(job_id: int, payload: AnalyzeTextRequest):
    with connect() as db:
        job = decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
    if not job:
        raise HTTPException(404, "Job not found")

    extracted_items = [
        {
            "filename": item.filename,
            "text": item.text,
            "name": item.name,
            "email": item.email,
            "pages": None,
            "truncated": False,
        }
        for item in payload.resumes
    ]
    return await _run_batch_analysis(job, extracted_items, [], payload.include_overview)


@app.post("/api/jobs/{job_id}/overview")
async def job_overview(job_id: int, force: bool = Query(default=False)):
    with connect() as db:
        job = decode_job(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
    if not job:
        raise HTTPException(404, "Job not found")

    overview = await _get_or_create_overview(job, force=force)
    return {
        "job": {"id": job["id"], "title": job["title"]},
        **overview.model_dump(),
    }


@app.post("/api/resumes/extract")
async def extract_resume(file: UploadFile = File(...)):
    """Extract selectable text from a PDF or DOCX resume."""
    content = await file.read()
    return extract_resume_bytes(file.filename or "", content)
