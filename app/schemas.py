"""Explicit Pydantic request and response schemas for the public API."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class TaskStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RequestModel(BaseModel):
    """Reject unknown fields so server-managed fields cannot be changed."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ResponseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(RequestModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    status: ProjectStatus = ProjectStatus.ACTIVE


class ProjectUpdate(RequestModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    status: ProjectStatus | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field_name in ("name", "status"):
            value = getattr(self, field_name)
            if field_name in self.model_fields_set and value is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class ProjectRead(ResponseModel):
    id: int
    name: str
    description: str | None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime


class TaskCreate(RequestModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    status: TaskStatus = TaskStatus.PLANNED
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: date | None = None


class TaskUpdate(RequestModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field_name in ("title", "status", "priority"):
            value = getattr(self, field_name)
            if field_name in self.model_fields_set and value is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class TaskRead(ResponseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    created_at: datetime
    updated_at: datetime
