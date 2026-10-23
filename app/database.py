"""Database configuration, engine, session factory, and request dependency."""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and configure a "
        "PostgreSQL connection string, or set DATABASE_URL in the environment."
    )


def _engine_options(database_url: str) -> dict[str, object]:
    options: dict[str, object] = {"pool_pre_ping": True}

    if database_url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        if ":memory:" in database_url:
            options["poolclass"] = StaticPool
    else:
        # Keep pooled server connections fresh across long local sessions.
        options["pool_recycle"] = 3600

    return options


engine = create_engine(DATABASE_URL, **_engine_options(DATABASE_URL))
SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autoflush=False,
    expire_on_commit=False,
)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(
    dbapi_connection: object, connection_record: object
) -> None:
    """SQLite does not enforce foreign keys unless asked to per connection."""
    if engine.dialect.name != "sqlite":
        return

    cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Base(DeclarativeBase):
    """Declarative base shared by all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """Provide a request-scoped session and always release it."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def create_tables() -> None:
    """Create missing tables from ORM metadata.

    This keeps first-run local PostgreSQL setup simple and reuses the same
    metadata for isolated SQLite tests. Existing tables are not altered.
    """
    Base.metadata.create_all(bind=engine)
