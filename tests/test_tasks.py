"""Task API tests."""

from __future__ import annotations

import pytest


def test_create_task_for_existing_project(client, create_project):
    project = create_project(name="Task Parent")

    response = client.post(
        f"/api/projects/{project['id']}/tasks",
        json={
            "title": "Inspect switchgear",
            "description": "Check insulation resistance.",
            "status": "in_progress",
            "priority": "high",
            "due_date": "2026-11-12",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["project_id"] == project["id"]
    assert body["title"] == "Inspect switchgear"
    assert body["status"] == "in_progress"
    assert body["priority"] == "high"
    assert body["due_date"] == "2026-11-12"


def test_create_task_defaults(client, create_project):
    project = create_project()

    response = client.post(
        f"/api/projects/{project['id']}/tasks",
        json={"title": "Default Task"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "planned"
    assert body["priority"] == "medium"
    assert body["due_date"] is None


def test_reject_task_for_missing_project(client):
    response = client.post(
        "/api/projects/999999/tasks", json={"title": "Orphan Task"}
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}


@pytest.mark.parametrize(
    "title",
    ["", "   ", "x" * 151],
    ids=["empty", "whitespace-only", "too-long"],
)
def test_reject_invalid_task_title(client, create_project, title):
    project = create_project()

    response = client.post(
        f"/api/projects/{project['id']}/tasks", json={"title": title}
    )

    assert response.status_code == 422


def test_reject_project_id_in_task_body(client, create_project):
    project = create_project()

    response = client.post(
        f"/api/projects/{project['id']}/tasks",
        json={"title": "Wrong Parent", "project_id": 999},
    )

    assert response.status_code == 422


def test_list_tasks_by_project(client, create_project, create_task):
    first_project = create_project(name="First")
    second_project = create_project(name="Second")
    first_task = create_task(first_project["id"], title="First Project Task")
    second_task = create_task(second_project["id"], title="Second Project Task")

    response = client.get(f"/api/projects/{first_project['id']}/tasks")

    assert response.status_code == 200
    body = response.json()
    assert [task["id"] for task in body] == [first_task["id"]]
    assert second_task["id"] not in {task["id"] for task in body}

    filtered = client.get(
        "/api/tasks", params={"project_id": first_project["id"]}
    )
    assert filtered.status_code == 200
    assert [task["id"] for task in filtered.json()] == [first_task["id"]]


def test_list_tasks_for_missing_project_returns_404(client):
    response = client.get("/api/projects/999999/tasks")

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}


def test_filter_tasks_by_status_and_priority(
    client, create_project, create_task
):
    project = create_project()
    planned_high = create_task(
        project["id"], title="Planned High", priority="high"
    )
    create_task(
        project["id"],
        title="Planned Low",
        status="planned",
        priority="low",
    )
    completed_high = create_task(
        project["id"],
        title="Completed High",
        status="completed",
        priority="high",
    )

    high_response = client.get("/api/tasks", params={"priority": "high"})
    assert high_response.status_code == 200
    assert {task["id"] for task in high_response.json()} == {
        planned_high["id"],
        completed_high["id"],
    }

    completed_response = client.get(
        "/api/tasks", params={"status": "completed"}
    )
    assert completed_response.status_code == 200
    assert [task["id"] for task in completed_response.json()] == [
        completed_high["id"]
    ]

    combined_response = client.get(
        "/api/tasks",
        params={
            "project_id": project["id"],
            "status": "planned",
            "priority": "high",
        },
    )
    assert combined_response.status_code == 200
    assert [task["id"] for task in combined_response.json()] == [
        planned_high["id"]
    ]


def test_filter_rejects_invalid_status_or_priority(client):
    assert client.get("/api/tasks", params={"status": "done"}).status_code == 422
    assert (
        client.get("/api/tasks", params={"priority": "urgent"}).status_code
        == 422
    )


def test_update_only_task_status(client, create_project, create_task):
    project = create_project()
    task = create_task(
        project["id"],
        title="Update Status",
        description="Keep this",
        priority="high",
        due_date="2026-12-01",
    )

    response = client.patch(
        f"/api/tasks/{task['id']}", json={"status": "completed"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["title"] == "Update Status"
    assert body["description"] == "Keep this"
    assert body["priority"] == "high"
    assert body["due_date"] == "2026-12-01"


def test_update_can_clear_due_date(client, create_project, create_task):
    project = create_project()
    task = create_task(project["id"], due_date="2026-12-01")

    response = client.patch(f"/api/tasks/{task['id']}", json={"due_date": None})

    assert response.status_code == 200
    assert response.json()["due_date"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "done"},
        {"priority": "urgent"},
        {"status": None},
        {"priority": None},
        {"id": 10},
        {"project_id": 10},
    ],
)
def test_reject_invalid_task_patch(client, create_project, create_task, payload):
    project = create_project()
    task = create_task(project["id"])

    response = client.patch(f"/api/tasks/{task['id']}", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [{"status": "done"}, {"priority": "urgent"}],
)
def test_reject_invalid_task_create_values(client, create_project, payload):
    project = create_project()

    response = client.post(
        f"/api/projects/{project['id']}/tasks",
        json={"title": "Invalid Values", **payload},
    )

    assert response.status_code == 422


def test_get_existing_task(client, create_project, create_task):
    project = create_project()
    task = create_task(project["id"], title="Retrieve Task")

    response = client.get(f"/api/tasks/{task['id']}")

    assert response.status_code == 200
    assert response.json()["title"] == "Retrieve Task"


def test_get_missing_task_returns_404(client):
    response = client.get("/api/tasks/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_patch_missing_task_returns_404(client):
    response = client.patch("/api/tasks/999999", json={"status": "completed"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_delete_task(client, create_project, create_task):
    project = create_project()
    task = create_task(project["id"], title="Delete Task")

    response = client.delete(f"/api/tasks/{task['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/api/tasks/{task['id']}").status_code == 404
    assert client.get(f"/api/projects/{project['id']}/tasks").json() == []


def test_delete_missing_task_returns_404(client):
    response = client.delete("/api/tasks/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_project_deletion_cascades_to_tasks(
    client, create_project, create_task
):
    project = create_project(name="Cascade Project")
    first_task = create_task(project["id"], title="First Cascade Task")
    second_task = create_task(project["id"], title="Second Cascade Task")

    response = client.delete(f"/api/projects/{project['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/tasks/{first_task['id']}").status_code == 404
    assert client.get(f"/api/tasks/{second_task['id']}").status_code == 404
    assert client.get("/api/tasks").json() == []
    assert (
        client.get(f"/api/projects/{project['id']}/tasks").status_code == 404
    )
