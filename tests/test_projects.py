"""Project API tests."""

from __future__ import annotations

import pytest


def test_create_project(client):
    response = client.post(
        "/api/projects",
        json={
            "name": "North Sea Substation",
            "description": "Transmission upgrade programme.",
            "status": "active",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["name"] == "North Sea Substation"
    assert body["description"] == "Transmission upgrade programme."
    assert body["status"] == "active"
    assert body["created_at"]
    assert body["updated_at"]


def test_create_project_uses_default_status(client):
    response = client.post("/api/projects", json={"name": "Default Status"})

    assert response.status_code == 201
    assert response.json()["status"] == "active"


@pytest.mark.parametrize(
    "name",
    ["", "   ", "x" * 121],
    ids=["empty", "whitespace-only", "too-long"],
)
def test_reject_invalid_project_name(client, name):
    response = client.post("/api/projects", json={"name": name})

    assert response.status_code == 422


def test_reject_client_managed_fields_on_create(client):
    response = client.post(
        "/api/projects",
        json={
            "id": 999,
            "name": "Client Supplied ID",
            "created_at": "2020-01-01T00:00:00",
        },
    )

    assert response.status_code == 422


def test_list_projects(client, create_project):
    first = create_project(name="First Project")
    second = create_project(name="Second Project")

    response = client.get("/api/projects")

    assert response.status_code == 200
    body = response.json()
    assert {project["id"] for project in body} == {first["id"], second["id"]}
    assert {project["name"] for project in body} == {"First Project", "Second Project"}


def test_get_existing_project(client, create_project):
    project = create_project(name="Retrieve Me")

    response = client.get(f"/api/projects/{project['id']}")

    assert response.status_code == 200
    assert response.json()["name"] == "Retrieve Me"


def test_get_missing_project_returns_404(client):
    response = client.get("/api/projects/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}


def test_patch_updates_only_supplied_fields(client, create_project):
    project = create_project(
        name="Partially Updated",
        description="Keep this description",
        status="active",
    )

    response = client.patch(
        f"/api/projects/{project['id']}", json={"status": "completed"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["name"] == "Partially Updated"
    assert body["description"] == "Keep this description"

    fetched = client.get(f"/api/projects/{project['id']}").json()
    assert fetched["status"] == "completed"
    assert fetched["name"] == "Partially Updated"


def test_patch_can_clear_optional_description(client, create_project):
    project = create_project(description="Remove me")

    response = client.patch(
        f"/api/projects/{project['id']}", json={"description": None}
    )

    assert response.status_code == 200
    assert response.json()["description"] is None


def test_patch_rejects_null_required_name(client, create_project):
    project = create_project()

    response = client.patch(
        f"/api/projects/{project['id']}", json={"name": None}
    )

    assert response.status_code == 422


def test_patch_rejects_client_managed_fields(client, create_project):
    project = create_project()

    response = client.patch(
        f"/api/projects/{project['id']}", json={"id": 123}
    )

    assert response.status_code == 422


def test_patch_missing_project_returns_404(client):
    response = client.patch("/api/projects/999999", json={"name": "Missing"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}


def test_delete_project(client, create_project):
    project = create_project(name="Delete Me")

    response = client.delete(f"/api/projects/{project['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/api/projects/{project['id']}").status_code == 404
    assert client.get("/api/projects").json() == []


def test_delete_missing_project_returns_404(client):
    response = client.delete("/api/projects/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}
