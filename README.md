# NEXORA

NEXORA is a recruiter-support demo for explainable resume screening. The existing single-page frontend and its seven-part browser-side scoring logic are preserved. A FastAPI backend provides job and candidate CRUD plus PDF/DOCX text extraction.

## Current integration

The frontend in `index.html` calls the FastAPI backend for:
- Creating jobs from the quick-create and full job-description flows.
- Creating newly uploaded candidate profiles.
- Updating candidate status.
- Extracting selectable text from PDF and DOCX resumes.

Resume analysis, matching, ranking, and the existing seven-part score remain in the browser. Sample records and browser-local app settings are not automatically migrated to the API database. The frontend currently uses a Codespaces API URL; update `API_BASE` in `index.html` when deploying the backend elsewhere.

## Run the complete demo in GitHub Codespaces

Use two terminals in the repository root.

### Terminal 1 — backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Forward port **8000** in the Codespaces Ports tab. The health endpoint should return:

```json
{"status":"ok","service":"nexora-api"}
```

API documentation: `https://YOUR-CODESPACE-8000.app.github.dev/docs`

### Terminal 2 — frontend

From the repository root:

```bash
python -m http.server 5500
```

Open the forwarded port **5500** address. Keep both terminals running. The frontend origin must be listed in `NEXORA_CORS_ORIGINS` on the backend. The current defaults include the known NEXORA Vercel and Codespaces demo origins; if your Codespace URL changes, update the environment variable and restart the API.

## Verify backend tests

From the repository root:

```bash
cd backend
python -m pip install -r requirements.txt
pytest -q
```

The tests cover health, job creation/listing, candidate create/list/status/delete, and rejection of unsupported resume file types.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST / GET | `/api/jobs` | Create/list jobs |
| GET | `/api/jobs/{job_id}` | Get one job |
| POST / GET | `/api/candidates` | Create/list candidates |
| GET | `/api/candidates/{candidate_id}` | Get one candidate |
| PATCH | `/api/candidates/{candidate_id}/status` | Update candidate status |
| DELETE | `/api/candidates/{candidate_id}` | Delete candidate |
| POST | `/api/jobs/{job_id}/score/{candidate_id}` | Backend baseline score (not the frontend's seven-part score) |
| POST | `/api/resumes/extract` | Extract PDF/DOCX text |

## Configuration and deployment

- `NEXORA_CORS_ORIGINS`: comma-separated exact frontend origins.
- `NEXORA_DB_PATH`: SQLite database path; defaults to `nexora.db` relative to the backend process working directory.
- Backend start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

The current Codespaces URL is a development endpoint, not a stable production API. For a production deployment, use a stable Python host and managed PostgreSQL or another durable database, set the exact CORS origin, configure secrets, and then update `API_BASE` in `index.html`. Do not use a temporary Codespaces URL as a permanent production endpoint. SQLite on an ephemeral host can lose data after restarts or redeploys.

## Security and responsible use — important

**This repository is a demo, not a production-ready recruiting system.** The API currently has no recruiter authentication, authorization, tenant isolation, rate limiting, or audit log. Do not upload real candidate resumes or personal information to the publicly forwarded demo API. Do not expose it for public use until authentication and access controls are implemented and tested.

Before production use, add:
- Authenticated recruiter accounts and per-organization authorization.
- A managed database, migrations, backups, and retention/deletion controls.
- Private file handling, upload scanning, rate limits, request limits, and audit logging.
- HTTPS, secret management, monitoring, and automated integration tests.
- A privacy notice, candidate consent process, and applicable legal review.

PDF/DOCX extraction reads selectable text only. Scanned/image-only PDFs require OCR, which is not included. Extraction errors should be reviewed; no resume parsing system is guaranteed to be complete.

NEXORA scores are advisory evidence summaries only. A human must review the resume and make every hiring decision. Do not score or infer protected characteristics.

## License

See [LICENSE](LICENSE).
