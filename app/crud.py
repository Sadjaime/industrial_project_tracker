"""Reusable database operations used by the API routers."""

from __future__ import annotations

from enum import Enum

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas


def _column_values(data: dict[str, object]) -> dict[str, object]:
    """Convert enum members to their string database values."""
    return {
        key: value.value if isinstance(value, Enum) else value
        for key, value in data.items()
    }


def _commit(db: Session, instance: models.Project | models.Task | None = None):
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    if instance is not None:
        db.refresh(instance)


def list_projects(db: Session) -> list[models.Project]:
    statement = select(models.Project).order_by(
        models.Project.created_at.desc(), models.Project.id.desc()
    )
    return list(db.scalars(statement).all())


def get_project(db: Session, project_id: int) -> models.Project | None:
    return db.get(models.Project, project_id)


def create_project(db: Session, payload: schemas.ProjectCreate) -> models.Project:
    project = models.Project(**_column_values(payload.model_dump()))
    db.add(project)
    _commit(db, project)
    return project


def update_project(
    db: Session, project: models.Project, payload: schemas.ProjectUpdate
) -> models.Project:
    changes = _column_values(payload.model_dump(exclude_unset=True))
    if not changes:
        return project

    for field_name, value in changes.items():
        setattr(project, field_name, value)

    _commit(db, project)
    return project


def delete_project(db: Session, project: models.Project) -> None:
    db.delete(project)
    _commit(db)


def list_tasks(
    db: Session,
    *,
    project_id: int | None = None,
    status: schemas.TaskStatus | None = None,
    priority: schemas.TaskPriority | None = None,
) -> list[models.Task]:
    statement = select(models.Task)

    if project_id is not None:
        statement = statement.where(models.Task.project_id == project_id)
    if status is not None:
        statement = statement.where(models.Task.status == status.value)
    if priority is not None:
        statement = statement.where(models.Task.priority == priority.value)

    statement = statement.order_by(
        models.Task.created_at.desc(), models.Task.id.desc()
    )
    return list(db.scalars(statement).all())


def get_task(db: Session, task_id: int) -> models.Task | None:
    return db.get(models.Task, task_id)


def create_task(
    db: Session, project_id: int, payload: schemas.TaskCreate
) -> models.Task:
    task = models.Task(
        project_id=project_id, **_column_values(payload.model_dump())
    )
    db.add(task)
    _commit(db, task)
    return task


def update_task(
    db: Session, task: models.Task, payload: schemas.TaskUpdate
) -> models.Task:
    changes = _column_values(payload.model_dump(exclude_unset=True))
    if not changes:
        return task

    for field_name, value in changes.items():
        setattr(task, field_name, value)

    _commit(db, task)
    return task


def delete_task(db: Session, task: models.Task) -> None:
    db.delete(task)
    _commit(db)
