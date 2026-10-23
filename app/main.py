"""FastAPI application entry point and static frontend hosting."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from . import models  # noqa: F401 - ensures ORM metadata is registered
from .database import create_tables
from .routers import projects, tasks

logger = logging.getLogger("industrial_project_tracker")
STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create missing PostgreSQL tables from the shared ORM metadata. Existing
    # tables are never altered.
    create_tables()
    yield


app = FastAPI(
    title="Industrial Project Tracker API",
    description=(
        "Manage engineering projects and their tasks. The same FastAPI "
        "application serves the browser interface and this JSON API."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(projects.router)
app.include_router(tasks.router)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(
    request: Request, exc: SQLAlchemyError
) -> JSONResponse:
    logger.error(
        "Unhandled database error while processing %s %s",
        request.method,
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred."},
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    logger.error(
        "Unhandled error while processing %s %s",
        request.method,
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred."},
    )


@app.get("/", include_in_schema=False)
def serve_frontend() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html", media_type="text/html")
