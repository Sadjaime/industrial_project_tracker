"""Project endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..models import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = crud.get_project(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


@router.get("", response_model=list[schemas.ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    return crud.list_projects(db)


@router.post(
    "",
    response_model=schemas.ProjectRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: schemas.ProjectCreate, db: Session = Depends(get_db)
):
    return crud.create_project(db, payload)


@router.get("/{project_id}", response_model=schemas.ProjectRead)
def get_project(
    project_id: Annotated[int, Path(ge=1)], db: Session = Depends(get_db)
):
    return get_project_or_404(db, project_id)


@router.patch("/{project_id}", response_model=schemas.ProjectRead)
def update_project(
    payload: schemas.ProjectUpdate,
    project_id: Annotated[int, Path(ge=1)],
    db: Session = Depends(get_db),
):
    project = get_project_or_404(db, project_id)
    return crud.update_project(db, project, payload)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_project(
    project_id: Annotated[int, Path(ge=1)], db: Session = Depends(get_db)
):
    project = get_project_or_404(db, project_id)
    crud.delete_project(db, project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/tasks", response_model=list[schemas.TaskRead])
def list_project_tasks(
    project_id: Annotated[int, Path(ge=1)], db: Session = Depends(get_db)
):
    get_project_or_404(db, project_id)
    return crud.list_tasks(db, project_id=project_id)
