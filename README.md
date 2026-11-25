[NEXORA_README.md](https://github.com/user-attachments/files/35435549/NEXORA_README.md)
# NEXORA

NEXORA is a recruiter-support prototype for explainable resume screening. It compares candidate skills with job requirements, presents missing and matched skills, and keeps hiring decisions under human control.

> **Current repository status:** The original public repository contains a single large `index.html` frontend prototype. Its own UI describes itself as a frontend demo with sample data and no connected backend. This starter adds a separate FastAPI + SQLite backend. It does not silently replace the existing UI or claim that the frontend is already wired to the API.

## Features in this backend starter

- FastAPI REST API with interactive Swagger docs.
- SQLite persistence for jobs and candidates.
- Create/list/get jobs and candidates.
- Update candidate workflow status and delete candidates.
- Explainable baseline score endpoint with matched/missing skill lists.
- CORS configuration for local development and the existing Vercel frontend.

## Repository structure

```text
NEXORA/
├── index.html                 # Existing frontend prototype (keep this)
├── README.md
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI routes
│   │   ├── database.py         # SQLite connection/schema
│   │   ├── schemas.py          # Request validation
│   │   └── scoring.py          # Explainable baseline score
│   ├── requirements.txt
│   ├── .env.example
│   └── .gitignore
└── .gitignore
```

Move the contents of this starter's `app/`, `requirements.txt`, `.env.example`, and `.gitignore` into a new `backend/` directory in the existing repository. Keep the existing `index.html` at the repository root.

## Requirements

- Python 3.10+
- pip

## Run locally (Windows PowerShell)

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

If PowerShell blocks activation, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
```

API URLs:

- Health: http://127.0.0.1:8000/api/health
- Swagger docs: http://127.0.0.1:8000/docs
- Jobs: http://127.0.0.1:8000/api/jobs
- Candidates: http://127.0.0.1:8000/api/candidates

## Example API requests

Create a job:

```bash
curl -X POST http://127.0.0.1:8000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"title":"Python Developer","description":"Backend role","required_skills":["Python","FastAPI","SQL"],"preferred_skills":["Docker","AWS"]}'
```

Create a candidate:

```bash
curl -X POST http://127.0.0.1:8000/api/candidates \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Candidate","email":"demo@example.com","experience_years":2,"education":"B.Tech","skills":["Python","SQL"],"resume_text":"Built APIs using Python and FastAPI."}'
```

Score candidate 1 against job 1:

```bash
curl -X POST http://127.0.0.1:8000/api/jobs/1/score/1
```

## Connect the existing frontend

The existing `index.html` defines an API placeholder around its `API` object and currently marks `API.live` as false. Replace that placeholder only after the backend is running.

Example frontend helper:

```js
const API_BASE = "http://127.0.0.1:8000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`API ${response.status}: ${message}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Example:
const jobs = await apiRequest("/api/jobs");
const candidates = await apiRequest("/api/candidates");
```

For deployment, set `API_BASE` to your deployed backend URL (HTTPS), not localhost. Do not put private API keys or database credentials in `index.html`.

**Important integration note:** The current frontend has its own candidate/job data structures and scoring functions. The backend starter uses a simpler JSON contract. A developer must map the frontend's existing state to these API payloads and replace the local-storage/sample-data calls incrementally. Do not just set `API.live = true`; that flag alone does not connect anything.

## Deploying

The existing frontend can remain on Vercel as a static site. Deploy the `backend/` folder as a separate Python web service (for example, a host that supports FastAPI). Configure:

- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Root directory: `backend`
- Environment variable `NEXORA_CORS_ORIGINS` to your exact Vercel frontend origin.
- A persistent disk/volume for `nexora.db`, or replace SQLite with a managed PostgreSQL database for multi-user production use.

The database file must live on persistent storage; ephemeral deployment filesystems can erase SQLite data on restart/redeploy.

## Scoring and responsible use

The starter's score is a transparent baseline: required skills 70%, preferred skills 20%, experience 10%. It is not the same as the original frontend's seven-part formula. Review and tune the formula with real job-related validation before use.

- A score is not a hiring decision.
- Do not score protected traits or infer them from names, photos, addresses, or other personal attributes.
- Review the original resume and evidence for every candidate.
- Obtain appropriate consent and follow applicable privacy/employment laws before uploading or retaining resumes.
- Add authentication, authorization, audit logging, rate limiting, file validation, malware scanning, retention/deletion controls, and production database migrations before handling real candidate data.

## Current limitations

- No authentication or multi-tenant isolation.
- Resume extraction endpoint intentionally returns `501`; PDF/DOCX parsing is not enabled in this starter.
- No OCR for scanned documents.
- No email delivery.
- No automated hiring or rejection.
- SQLite is suitable for local prototyping, not a concurrent production recruiting platform.

## License

Add a license file before distributing this project.
