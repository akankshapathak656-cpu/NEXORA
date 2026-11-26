from io import BytesIO
import pytest
from docx import Document
from fastapi.testclient import TestClient

from app import ai_scoring, database
from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    with TestClient(app) as test_client:
        yield test_client


def _make_docx_bytes(lines: list[str]) -> bytes:
    doc = Document()
    for line in lines:
        doc.add_paragraph(line)
    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_health_and_ai_config(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "nexora-api"}

    cfg = client.get("/api/config/ai")
    assert cfg.status_code == 200
    assert cfg.json()["ai_enabled"] is False
    assert cfg.json()["mode"] == "heuristic"


def test_job_and_candidate_crud(client):
    job = client.post("/api/jobs", json={
        "title": "Backend Integration Test",
        "description": "Test role",
        "required_skills": ["Python", "FastAPI"],
        "preferred_skills": ["Docker"],
    })
    assert job.status_code == 201
    job_data = job.json()
    assert job_data["required_skills"] == ["Python", "FastAPI"]
    assert client.get("/api/jobs").json()[0]["id"] == job_data["id"]

    candidate = client.post("/api/candidates", json={
        "name": "Demo Candidate",
        "email": "demo@example.com",
        "experience_years": 2,
        "education": "B.Tech",
        "skills": ["Python"],
        "resume_text": "Built APIs using Python and FastAPI.",
    })
    assert candidate.status_code == 201
    candidate_data = candidate.json()
    assert candidate_data["name"] == "Demo Candidate"
    assert client.get("/api/candidates").json()[0]["id"] == candidate_data["id"]

    updated = client.patch(
        f"/api/candidates/{candidate_data['id']}/status",
        json={"status": "Shortlisted"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "Shortlisted"

    deleted = client.delete(f"/api/candidates/{candidate_data['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/candidates/{candidate_data['id']}").status_code == 404


def test_reject_invalid_resume_upload(client):
    response = client.post(
        "/api/resumes/extract",
        files={"file": ("resume.txt", b"not a resume", "text/plain")},
    )
    assert response.status_code == 415


def test_heuristic_score_and_caching(client):
    job = client.post("/api/jobs", json={
        "title": "Backend Engineer",
        "description": "Build FastAPI services with Python and PostgreSQL.",
        "required_skills": ["Python", "FastAPI", "PostgreSQL"],
        "preferred_skills": ["Docker"],
        "experience_min": 3,
        "education": "B.Tech or BS in Computer Science",
        "responsibilities": ["Design REST APIs and maintain database schemas"],
    }).json()

    cand = client.post("/api/candidates", json={
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "experience_years": 4,
        "education": "B.Tech Computer Science",
        "skills": ["Python", "FastAPI"],
        "resume_text": "Ada Lovelace\n4 years experience. Designed REST APIs using Python and FastAPI with Docker.",
    }).json()

    first = client.post(f"/api/jobs/{job['id']}/score/{cand['id']}")
    assert first.status_code == 200
    data = first.json()
    assert data["mode"] == "heuristic"
    assert data["cached"] is False
    assert 0 <= data["score"] <= 100
    assert len(data["components"]) >= 4
    assert data["overview"]["headline"]
    assert data["overview"]["interview_questions"]

    second = client.post(f"/api/jobs/{job['id']}/score/{cand['id']}")
    assert second.status_code == 200
    assert second.json()["cached"] is True

    forced = client.post(f"/api/jobs/{job['id']}/score/{cand['id']}?force=true")
    assert forced.status_code == 200
    assert forced.json()["cached"] is False


def test_batch_analyze_docx_and_pool_overview(client):
    job = client.post("/api/jobs", json={
        "title": "Full Stack Engineer",
        "description": "React and Python engineer.",
        "required_skills": ["React", "Python", "SQL"],
        "preferred_skills": ["Docker"],
        "experience_min": 2,
    }).json()

    good_docx = _make_docx_bytes([
        "Grace Hopper",
        "grace@example.com",
        "3 years experience building web apps using React, Python, and SQL.",
        "Containerized deployments with Docker.",
    ])
    bad_file = b"plain text not supported"

    resp = client.post(
        f"/api/jobs/{job['id']}/analyze",
        files=[
            ("files", ("grace_hopper.docx", good_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
            ("files", ("notes.txt", bad_file, "text/plain")),
        ],
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "heuristic"
    assert len(body["results"]) == 1
    assert len(body["errors"]) == 1
    assert body["errors"][0]["filename"] == "notes.txt"
    assert body["results"][0]["candidate"]["name"] == "Grace Hopper"
    assert body["results"][0]["candidate"]["email"] == "grace@example.com"
    assert body["pool_overview"]["candidate_count"] == 1
    assert body["pool_overview"]["top_picks"][0]["name"] == "Grace Hopper"

    listed = client.get(f"/api/jobs/{job['id']}/analyses")
    assert listed.status_code == 200
    assert len(listed.json()["analyses"]) == 1
    assert listed.json()["pool_overview"]["candidate_count"] == 1


def test_ai_mode_with_mocked_openai_endpoint(client, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-secret-key")
    monkeypatch.setenv("LLM_MODEL", "gpt-4o-mini")

    async def fake_chat_json(system_prompt: str, user_prompt: str, config: dict) -> dict:
        if "POOL" in system_prompt or "synthesizer" in system_prompt:
            return {
                "executive_summary": "Strong pool led by Alan Turing with deep Python and FastAPI production work.",
                "top_picks": [
                    {"candidate_id": 1, "name": "Alan Turing", "score": 90, "reason": "Matches all core backend skills."}
                ],
                "common_strengths": ["Python (1/1)", "FastAPI (1/1)"],
                "common_gaps": ["Kubernetes missing in 1/1"],
                "sourcing_signal": "Proceed to interview Alan Turing.",
            }
        return {
            "parsed_context": {
                "name": "Alan Turing",
                "email": "alan@example.com",
                "phone": "+1-555-0100",
                "experience_years": 5.0,
                "education": "PhD Mathematics",
                "skills": ["Python", "FastAPI", "PostgreSQL"],
                "soft_skills": ["Problem solving"],
                "work": [
                    {
                        "title": "Senior Backend Engineer",
                        "company": "Bletchley Systems",
                        "date_range": "2021-Present",
                        "skills": ["Python", "FastAPI"],
                        "highlights": ["Built high-throughput FastAPI microservices"],
                    }
                ],
                "projects": [
                    {
                        "title": "Enigma API",
                        "description": "Async Python API with PostgreSQL",
                        "skills": ["Python", "FastAPI", "PostgreSQL"],
                    }
                ],
            },
            "skill_evidence": [
                {
                    "skill": "Python",
                    "category": "Technical",
                    "tier": "D",
                    "confidence": "High",
                    "evidence": "Built high-throughput FastAPI microservices in Python",
                    "section": "Experience",
                    "required_by_jd": "Required",
                    "match_status": "Matched",
                },
                {
                    "skill": "FastAPI",
                    "category": "Framework",
                    "tier": "D",
                    "confidence": "High",
                    "evidence": "Built high-throughput FastAPI microservices",
                    "section": "Experience",
                    "required_by_jd": "Required",
                    "match_status": "Matched",
                },
                {
                    "skill": "Kubernetes",
                    "category": "Tool",
                    "tier": "N",
                    "confidence": "High",
                    "evidence": "Not found in resume",
                    "section": "Not recorded",
                    "required_by_jd": "Preferred",
                    "match_status": "Missing",
                },
            ],
            "component_assessments": {
                "exp": {"applicable": True, "fraction": 1.0, "note": "5 yrs exceeds 3 yr minimum"},
                "edu": {"applicable": False, "fraction": 0.0, "note": "Not required"},
                "proj": {"applicable": True, "fraction": 1.0, "note": "All required skills used in projects"},
                "resp": {"applicable": False, "fraction": 0.0, "note": "Not specified"},
                "ctx": {"applicable": True, "fraction": 1.0, "note": "Demonstrated in work experience"},
            },
            "overview": {
                "headline": "Strong backend fit — 5 yrs Python/FastAPI, missing Kubernetes",
                "summary": "Alan brings 5 years of production Python and FastAPI experience backed by concrete service delivery.",
                "strengths": ["Production Python & FastAPI", "5 years relevant experience"],
                "gaps": ["No Kubernetes listed"],
                "interview_questions": ["How have you deployed and scaled FastAPI services in production?"],
            },
        }

    monkeypatch.setattr(ai_scoring, "_chat_json", fake_chat_json)

    job = client.post("/api/jobs", json={
        "title": "Senior Python Engineer",
        "description": "FastAPI backend services.",
        "required_skills": ["Python", "FastAPI"],
        "preferred_skills": ["Kubernetes"],
        "experience_min": 3,
    }).json()

    resp = client.post(
        f"/api/jobs/{job['id']}/analyze-text",
        json={
            "resumes": [
                {
                    "filename": "alan.pdf",
                    "text": "Alan Turing — Senior Backend Engineer. 5 years with Python, FastAPI, PostgreSQL.",
                }
            ],
            "include_overview": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "ai"
    item = body["results"][0]
    assert item["analysis"]["mode"] == "ai"
    assert item["analysis"]["model"] == "gpt-4o-mini"
    # Deterministic math: req(40)=1.0, pref(10)=0.0, exp(20)=1.0, proj(10)=1.0, ctx(5)=1.0 => 75/85 = 88.24 -> 88
    assert item["analysis"]["score"] == 88
    assert item["analysis"]["overview"]["recommendation"] == "Strong Fit"
    assert body["pool_overview"]["mode"] == "ai"
    assert "Alan Turing" in body["pool_overview"]["executive_summary"]


def test_ai_falls_back_to_heuristic_on_error(client, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-secret-key")

    async def failing_chat_json(system_prompt: str, user_prompt: str, config: dict) -> dict:
        raise RuntimeError("Simulated upstream timeout")

    monkeypatch.setattr(ai_scoring, "_chat_json", failing_chat_json)

    job = client.post("/api/jobs", json={
        "title": "Python Dev",
        "required_skills": ["Python"],
    }).json()

    resp = client.post(
        f"/api/jobs/{job['id']}/analyze-text",
        json={"resumes": [{"filename": "dev.pdf", "text": "Jane Doe\n3 years Python developer."}]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "heuristic"
    analysis = body["results"][0]["analysis"]
    assert analysis["mode"] == "heuristic"
    assert "RuntimeError" in (analysis["fallback_reason"] or "")


def test_llm_null_fields_and_top_pick_sanitization(client, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "sk-super-secret-value")
    monkeypatch.setenv("LLM_BASE_URL", "https://api.example.com/v1/chat/completions")
    monkeypatch.setenv("LLM_TIMEOUT_SECONDS", "not-a-number")
    monkeypatch.setenv("LLM_MAX_CONCURRENCY", "999")

    cfg = ai_scoring.get_ai_config()
    assert cfg["base_url"] == "https://api.example.com/v1"
    assert cfg["timeout"] == 60.0
    assert cfg["max_concurrency"] == 20

    # Ensure /api/config/ai never leaks the API key
    cfg_resp = client.get("/api/config/ai")
    assert cfg_resp.status_code == 200
    assert "sk-super-secret-value" not in cfg_resp.text
    assert "api_key" not in cfg_resp.json()

    async def null_heavy_chat_json(system_prompt: str, user_prompt: str, config: dict) -> dict:
        if "synthesizer" in system_prompt:
            return {
                "executive_summary": "Solid candidate.",
                "top_picks": [
                    {"candidate_id": 9999, "name": "Ghost", "score": 100, "reason": "Hallucinated"},
                    {"candidate_id": 1, "name": "Wrong Name", "score": 999, "reason": "Real pick"},
                ],
                "common_strengths": None,
                "common_gaps": [],
                "sourcing_signal": None,
            }
        return {
            "parsed_context": {
                "name": "Linus Torvalds",
                "email": None,
                "phone": None,
                "experience_years": None,
                "education": None,
                "skills": ["C", "Git"],
                "soft_skills": None,
                "work": [{"title": "Maintainer", "company": None, "date_range": None, "skills": None, "highlights": None}],
                "projects": [{"title": "Linux", "description": None, "skills": ["C"]}],
            },
            "skill_evidence": [
                {
                    "skill": "C",
                    "category": None,
                    "tier": "D",
                    "confidence": "High",
                    "evidence": "Created Linux in C",
                    "section": "Projects",
                    "required_by_jd": "Required",
                    "match_status": "Matched",
                }
            ],
            "component_assessments": {
                "exp": {"applicable": True, "fraction": None, "note": None},
                "proj": {"applicable": True, "fraction": 1.0, "note": "Strong"},
                "ctx": {"applicable": True, "fraction": 1.0, "note": "Strong"},
            },
            "overview": {
                "headline": "Strong systems fit",
                "summary": "Deep C experience.",
                "strengths": ["C"],
                "gaps": [],
                "interview_questions": ["Tell us about kernel maintenance."],
            },
        }

    monkeypatch.setattr(ai_scoring, "_chat_json", null_heavy_chat_json)

    job = client.post("/api/jobs", json={"title": "Systems Eng", "required_skills": ["C"]}).json()
    resp = client.post(
        f"/api/jobs/{job['id']}/analyze-text",
        json={"resumes": [{"filename": "linus.pdf", "text": "Linus Torvalds — C and Git."}]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "ai"
    pick = body["pool_overview"]["top_picks"][0]
    assert len(body["pool_overview"]["top_picks"]) == 1
    assert pick["candidate_id"] == body["results"][0]["candidate"]["id"]
    assert pick["name"] == "Linus Torvalds"
    assert pick["score"] == body["results"][0]["analysis"]["score"]


def test_score_cache_invalidates_on_mode_switch_and_no_error_leak(client, monkeypatch):
    job = client.post("/api/jobs", json={"title": "Backend", "required_skills": ["Python"]}).json()
    cand = client.post("/api/candidates", json={"name": "Sam", "resume_text": "Python engineer"}).json()

    r1 = client.post(f"/api/jobs/{job['id']}/score/{cand['id']}")
    assert r1.json()["mode"] == "heuristic"
    assert r1.json()["cached"] is False

    # Enable AI mode: cache from heuristic must NOT be reused
    monkeypatch.setenv("LLM_API_KEY", "sk-secret-token-123")
    monkeypatch.setenv("LLM_FALLBACK_HEURISTIC", "false")

    async def exploding_chat(system_prompt: str, user_prompt: str, config: dict) -> dict:
        raise RuntimeError("Upstream error with sk-secret-token-123")

    monkeypatch.setattr(ai_scoring, "_chat_json", exploding_chat)

    batch = client.post(
        f"/api/jobs/{job['id']}/analyze-text",
        json={"resumes": [{"filename": "x.pdf", "text": "Python dev"}]},
    )
    assert batch.status_code == 200
    assert batch.json()["results"] == []
    assert len(batch.json()["errors"]) == 1
    assert "sk-secret-token-123" not in batch.text
    assert batch.json()["errors"][0]["error"] == "Analysis failed (RuntimeError)"
