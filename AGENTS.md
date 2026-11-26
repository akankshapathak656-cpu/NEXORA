# AGENTS.md — NEXORA

Recruiter-support web app for explainable resume screening with PDF/DOCX text extraction, OpenAI-compatible AI scoring (with deterministic heuristic fallback), and pool-level executive overviews.

## Repository Layout

- `backend/` — FastAPI + SQLite API (`app/main.py`, `app/ai_scoring.py`, `app/scoring.py`, `app/extract.py`, `app/database.py`, `app/schemas.py`, `tests/test_api.py`).
- `frontend/` — React 18 + Vite 5 SPA (`src/pages/`, `src/components/`, `src/store/`, `src/lib/`, `src/data/`, `src/legacy/styles.css`).
- `dev.sh` — Single-command local dev runner (FastAPI on `127.0.0.1:8000` + Vite on `localhost:5173` with `/api` proxy).
- `docker-compose.yml` — Production container stack (`backend` on `:8000` with `nexora_data` volume + `frontend` nginx on `:8080` proxying `/api/`).
- `index.html` — Legacy single-file prototype (kept for reference; active app is `frontend/`).

## Commands

```bash
# Local dev (auto-bootstraps backend/.venv and frontend/node_modules)
./dev.sh

# Backend tests (pytest.ini sets pythonpath = .)
cd backend && .venv/bin/pytest -q

# Frontend production build
cd frontend && npm run build

# Docker production stack
cp .env.example .env && docker compose up --build

# Vercel frontend deployment
vc --cwd frontend --prod --yes
vc --cwd frontend alias set <deployment-url> hacknexora.vercel.app
```

## Backend Guidelines (`backend/`)

- **Environment loading**: `backend/app/__init__.py` auto-loads `backend/.env` with `override=False` (host/shell env vars take precedence). Never commit `.env`, `backend/.env`, or `*.db`.
- **Key env vars**:
  - `NEXORA_CORS_ORIGINS` — comma-separated exact browser origins.
  - `NEXORA_DB_PATH` — SQLite path (default `nexora.db`, `/data/nexora.db` in Docker).
  - `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_REASONING_EFFORT`, `LLM_MAX_CONCURRENCY` (default `8`), `LLM_TIMEOUT_SECONDS` (default `60`), `LLM_FALLBACK_HEURISTIC` (default `true`).
- **Scoring architecture**:
  - `extract.py` extracts selectable text from PDF/DOCX (10 MB / 120k char cap; no OCR).
  - `ai_scoring.py` calls any OpenAI-compatible `/chat/completions` endpoint with `response_format: {"type": "json_object"}` (sending up to 40k chars of `resume_text`) and normalizes `null`/missing fields defensively.
  - Final `0–100` scores are computed **deterministically** in `scoring.py` (`compute_weighted_score`) from the 7 rescaled component weights (`req: 40, exp: 20, pref: 10, edu: 10, proj: 10, resp: 5, ctx: 5`).
  - When `LLM_API_KEY` is unset or an upstream error occurs (with fallback enabled), `scoring.py` serves `mode: "heuristic"`.
- **Caching & upserts**:
  - `candidate_analyses` caches per `(job_id, candidate_id)` and checks active `(mode, model)`.
  - `job_overviews` caches per `job_id` + SHA-256 `pool_hash`.
  - `POST /api/jobs?upsert=true` (by title) and `POST /api/candidates?upsert=true` (by email, then name) update in-place and invalidate stale cached analyses/overviews when JD or resume fields change.
  - `POST /api/jobs/{job_id}/analyze` always inserts new uploaded candidates and runs bounded-concurrency batch analysis + pool overview.
- **Security**: Never expose `LLM_API_KEY`, upstream URLs, or raw exception strings in API responses or logs. Never score or infer protected characteristics.

## Frontend Guidelines (`frontend/`)

- **Conventions** (see `frontend/CONTRACTS.md`):
  - ES modules with named exports; no `window.*` globals, no `innerHTML`, no inline `onclick` strings.
  - Keep existing legacy CSS class names; do **not** edit `frontend/src/legacy/styles.css`.
  - Keep `src/lib/*` pure (no React, DOM, or `localStorage`).
- **Routing**: Clean path routing in `src/routes.js` (`/`, `/login`, `/dashboard`, `/upload`, `/match`, `/roles`, `/cands`, `/profile`, `/gap`, `/trends`, `/dups`, `/work`, `/comms`, `/admin`, `/terms`, `/privacy`). Use `/path` hrefs (not `#hash`). `frontend/vercel.json` handles SPA rewrites.
- **API & state**:
  - `src/lib/api.js` uses `API_BASE = import.meta.env.VITE_API_BASE ?? ''` (empty string uses Vite/Nginx `/api` proxy locally/Docker; set `VITE_API_BASE` in Vercel Production env for hosted deploys).
  - Shared state lives in `src/store/state.js` (`useAppState`, `setState`, persisted under `nexora.v2`). Never mutate state in place.
  - `src/store/actions.js` owns backend sync (`ensureJobSynced`, `ensureCandidateSynced`, `scoreCandidateLive`, `resolvePoolLive`, `aiAnalysisFor`).
  - If you change built-in `src/data/samples.js` or `src/data/jobs.js`, bump `SEED_VERSION` in `src/store/state.js` so cached browser IDs re-sync cleanly via `?upsert=true`.
- **AI display**: Prefer `aiAnalysisFor(job, candidate, state)` across Dashboard, Step 2 (`Match.jsx`, `AnalysisView.jsx`), Step 4 (`Cands.jsx`), and Step 5 (`Profile.jsx`), falling back to browser heuristics only when offline/unscored.

## Verification Before Committing

1. Run `cd backend && .venv/bin/pytest -q` — all tests must pass (mock `_chat_json` for AI paths; never hit live LLM APIs in tests).
2. Run `cd frontend && npm run build` — Vite production build must succeed cleanly.
3. Check `git status -s` to ensure no `.env`, `*.db`, or personal resume files are staged.
