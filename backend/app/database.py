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
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            required_skills TEXT NOT NULL DEFAULT '[]',
            preferred_skills TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL DEFAULT '',
            experience_years REAL NOT NULL DEFAULT 0,
            education TEXT NOT NULL DEFAULT '',
            skills TEXT NOT NULL DEFAULT '[]',
            resume_text TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'New',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)
