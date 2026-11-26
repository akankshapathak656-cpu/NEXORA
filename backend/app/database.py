import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

# Codespaces keeps this file inside the workspace. For production, use a
# persistent volume or a managed database rather than an ephemeral filesystem.
DB_PATH = Path(os.getenv("NEXORA_DB_PATH", "nexora.db"))


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=30.0)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA journal_mode = WAL")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _ensure_column(db: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    existing = {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            required_skills TEXT NOT NULL DEFAULT '[]',
            preferred_skills TEXT NOT NULL DEFAULT '[]',
            experience_min REAL,
            education TEXT NOT NULL DEFAULT '',
            responsibilities TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            experience_years REAL NOT NULL DEFAULT 0,
            education TEXT NOT NULL DEFAULT '',
            skills TEXT NOT NULL DEFAULT '[]',
            resume_text TEXT NOT NULL DEFAULT '',
            filename TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'New',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS candidate_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            candidate_id INTEGER NOT NULL,
            mode TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT '',
            score INTEGER NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(job_id, candidate_id),
            FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
            FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS job_overviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL UNIQUE,
            pool_hash TEXT NOT NULL,
            mode TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT '',
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
        );
        """)
        # Safe migrations for pre-existing SQLite databases
        _ensure_column(db, "jobs", "experience_min", "REAL")
        _ensure_column(db, "jobs", "education", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(db, "jobs", "responsibilities", "TEXT NOT NULL DEFAULT '[]'")
        _ensure_column(db, "candidates", "phone", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(db, "candidates", "filename", "TEXT NOT NULL DEFAULT ''")
