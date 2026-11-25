import pytest
from fastapi.testclient import TestClient

from app import database
from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "nexora-api"}


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
