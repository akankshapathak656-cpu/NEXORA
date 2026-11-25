# NEXORA

NEXORA is a recruiter-support prototype for explainable resume screening. The existing frontend is a single-page HTML application. This repository also includes a FastAPI + SQLite backend starter that can be run in **GitHub Codespaces**.

> **Current integration status:** The backend is available as a separate API. The existing frontend still uses its own browser-side sample data and local storage; it has not yet been migrated to use these API endpoints. Do not treat the frontend as a live multi-user system until that integration, authentication, and deployment are completed.

## Repository structure

```text
NEXORA/
├── index.html
├── README.md
├── LICENSE
├── .gitignore
├── .devcontainer/
│   └── devcontainer.json
└── backend/
    ├── app/
    │   ├── __init__.py
    │   ├── main.py
    │   ├── database.py
    │   ├── schemas.py
    │   └── scoring.py
    ├── requirements.txt
    ├── .env.example
    └── .gitignore
```

## Run in GitHub Codespaces

1. Open this repository on GitHub.
2. Select **Code → Codespaces** and open your Codespace.
3. Open the integrated terminal and run:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Codespaces will offer to forward port **8000**. Open the forwarded URL and visit:

- `/` — API information
- `/api/health` — health check
- `/docs` — interactive Swagger API documentation

Expected health response:

```json
{"status":"ok","service":"nexora-api"}
```

If port 8000 is not forwarded automatically, open the **Ports** panel, choose **Add Port**, enter `8000`, and open the forwarded address. Keep the API server running in the terminal while testing.

## Run locally (optional)

Requires Python 3.10 or newer:

```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/jobs` | Create a job |
| GET | `/api/jobs` | List jobs |
| GET | `/api/jobs/{job_id}` | Get one job |
| POST | `/api/candidates` | Create a candidate |
| GET | `/api/candidates` | List candidates |
| GET | `/api/candidates/{candidate_id}` | Get one candidate |
| PATCH | `/api/candidates/{candidate_id}/status` | Update candidate status |
| DELETE | `/api/candidates/{candidate_id}` | Delete candidate |
| POST | `/api/jobs/{job_id}/score/{candidate_id}` | Calculate an explainable baseline score |

### Example requests

Set the API URL to the forwarded Codespaces port-8000 URL:

```bash
export API_URL="https://YOUR-CODESPACE-8000.app.github.dev"
```

Create a job:

```bash
curl -X POST "$API_URL/api/jobs" \
  -H "Content-Type: application/json" \
  -d '{"title":"Python Developer","description":"Backend role","required_skills":["Python","FastAPI","SQL"],"preferred_skills":["Docker","AWS"]}'
```

Create a candidate:

```bash
curl -X POST "$API_URL/api/candidates" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Candidate","email":"demo@example.com","experience_years":2,"education":"B.Tech","skills":["Python","SQL"],"resume_text":"Built APIs using Python and FastAPI."}'
```

## Frontend integration status

The current `index.html` contains an API placeholder and uses browser local storage and sample records. The backend API is not automatically connected just because it exists. The frontend's original seven-part scoring logic is also different from the backend's starter score.

The next integration step is to map the frontend's candidate and job data to the API payloads, then replace local-only persistence with API calls. Keep the existing browser-side resume parser unless server-side PDF/DOCX parsing is deliberately added. Do not simply change an `API.live` flag to true.

## Configuration

Copy `.env.example` to `.env`. Set `NEXORA_CORS_ORIGINS` to the exact origin(s) of the frontend that will call the API. Do not use a wildcard origin in a production deployment.

`NEXORA_DB_PATH` defaults to `nexora.db` in the backend working directory. In Codespaces, the database file remains in the workspace, but it is not a managed production database. Back up important data.

## Deployment

The static frontend can remain on Vercel. Deploy the backend separately on a Python-capable host.

- Backend root directory: `backend`
- Build/install: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Configure `NEXORA_CORS_ORIGINS` to the exact deployed frontend origin.
- Use persistent storage or managed PostgreSQL for production data.

A Codespaces forwarded URL is intended for development/testing, not as a permanent production API URL.

## Scoring and responsible use

The backend starter score is a transparent prototype formula: required skills 70%, preferred skills 20%, and experience 10%. It is not the same as the existing frontend's seven-part formula and has not been validated for hiring decisions.

- A score is an advisory aid, not a hiring decision.
- Do not score protected traits or infer them from names, photos, addresses, or other personal attributes.
- A human reviewer must inspect the resume and evidence.
- Obtain appropriate consent and follow applicable privacy and employment laws before storing resumes.
- Add authentication, authorization, audit logging, rate limiting, retention/deletion controls, and production database migrations before using real candidate data.

## Known limitations

- No recruiter authentication or multi-tenant isolation.
- Server-side PDF/DOCX extraction is not enabled; the endpoint returns HTTP 501. The existing frontend currently parses files in the browser.
- No OCR for scanned documents.
- No email delivery.
- SQLite is suitable for a prototype, not a concurrent production recruiting platform.
- Frontend-to-backend integration is still pending.

## License

See [LICENSE](LICENSE).
