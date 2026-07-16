"""Shared fixtures: isolated in-memory-ish SQLite DB per test session."""
import os
import sys

os.environ["PD_DATABASE_URL"] = "sqlite:///./test_pipeline_doctor.db"
os.environ["PD_ANTHROPIC_API_KEY"] = ""  # force rule-based engine in tests

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
