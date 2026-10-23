"""Task endpoints, including creation under a project."""

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    Response,
    status as http_status,
)
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..models import Project, Task

router = APIRouter(prefix="/api", tags=["tasks"])


def get_task_or_404(db: Session, task_id: int) -> Task:
    task = crud.get_task(db, task_id)
    if task is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    return task


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = crud.get_project(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


@router.get("/tasks", response_model=list[schemas.TaskRead])
def list_tasks(
    project_id: Annotated[int | None, Query(ge=1)] = None,
    status: Annotated[schemas.TaskStatus | None, Query()] = None,
    priority: Annotated[schemas.TaskPriority | None, Query()] = None,
    db: Session = Depends(get_db),
):
    return crud.list_tasks(
        db,
        project_id=project_id,
        status=status,
        priority=priority,
    )


@router.post(
    "/projects/{project_id}/tasks",
    response_model=schemas.TaskRead,
    status_code=http_status.HTTP_201_CREATED,
)
def create_task(
    payload: schemas.TaskCreate,
    project_id: Annotated[int, Path(ge=1)],
    db: Session = Depends(get_db),
):
    get_project_or_404(db, project_id)
    return crud.create_task(db, project_id, payload)


@router.get("/tasks/{task_id}", response_model=schemas.TaskRead)
def get_task(
    task_id: Annotated[int, Path(ge=1)], db: Session = Depends(get_db)
):
    return get_task_or_404(db, task_id)


@router.patch("/tasks/{task_id}", response_model=schemas.TaskRead)
def update_task(
    payload: schemas.TaskUpdate,
    task_id: Annotated[int, Path(ge=1)],
    db: Session = Depends(get_db),
):
    task = get_task_or_404(db, task_id)
    return crud.update_task(db, task, payload)


@router.delete(
    "/tasks/{task_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_task(
    task_id: Annotated[int, Path(ge=1)], db: Session = Depends(get_db)
):
    task = get_task_or_404(db, task_id)
    crud.delete_task(db, task)
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)
