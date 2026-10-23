"""Shared pytest fixtures and isolated test database configuration."""

from __future__ import annotations

import atexit
import os
import shutil
import tempfile
from pathlib import Path

import pytest

# Configure the application before importing it. The test database is a unique
# temporary SQLite file and never uses the developer's configured PostgreSQL
# database.
TEST_DIRECTORY = Path(tempfile.mkdtemp(prefix="industrial-project-tracker-tests-"))
TEST_DATABASE_PATH = TEST_DIRECTORY / "test.db"
os.environ["DATABASE_URL"] = (
    f"sqlite:///{TEST_DATABASE_PATH.as_posix()}"
)

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


def _remove_test_database() -> None:
    engine.dispose()
    shutil.rmtree(TEST_DIRECTORY, ignore_errors=True)


atexit.register(_remove_test_database)


@pytest.fixture(autouse=True)
def reset_database():
    """Give every test an empty schema, independent of execution order."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def create_project(client):
    def _create_project(
        name: str = "Test Project",
        description: str | None = None,
        status: str = "active",
    ) -> dict:
        response = client.post(
            "/api/projects",
            json={
                "name": name,
                "description": description,
                "status": status,
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    return _create_project


@pytest.fixture
def create_task(client):
    def _create_task(project_id: int, title: str = "Test Task", **overrides) -> dict:
        payload = {
            "title": title,
            "description": None,
            "status": "planned",
            "priority": "medium",
            "due_date": None,
        }
        payload.update(overrides)

        response = client.post(
            f"/api/projects/{project_id}/tasks", json=payload
        )
        assert response.status_code == 201, response.text
        return response.json()

    return _create_task
