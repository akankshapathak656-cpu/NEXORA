from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env if present without overriding real environment variables.
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)
