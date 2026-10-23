# Industrial Project Tracker — Implementation Plan

## Objective

Deliver a small, complete full-stack application for managing engineering projects and
their tasks. The application uses FastAPI, SQLAlchemy 2.x, and PostgreSQL, serves its
vanilla HTML/CSS/JS frontend from the FastAPI process, and is covered by an isolated
pytest suite.

## Scope and constraints

- PostgreSQL is the only supported application database.
- SQLite is used only as an isolated automated test backend.
- Two entities — `Project` and `Task` — with a one-to-many relationship and
  database-level cascade deletion.
- JSON REST API under `/api`, explicit Pydantic request/response schemas, consistent
  `404`/`422` errors, and no leaked database details.
- Same-origin static frontend with dashboard metrics, project CRUD, task CRUD, task
  filters, and loading/empty/success/error states.
- No Docker, migrations, authentication, frontend framework, or other unnecessary
  technology.

## Architecture

- `app/main.py` wires the app, error handlers, lifespan bootstrap, and static frontend.
- `app/database.py` owns environment-driven engine creation, synchronous sessions, the
  request-scoped session dependency, and the SQLite test foreign-key pragma.
- `app/models.py` defines the PostgreSQL schema through portable SQLAlchemy metadata:
  integer identity IDs, required/optional fields, status/priority checks, task indexes,
  the project foreign key, cascade deletion, and server-default timestamps.
- `app/schemas.py` defines explicit public request and response contracts.
- `app/crud.py` contains reusable database operations.
- `app/routers/` contains HTTP endpoints and error mapping.
- `tests/` uses a unique temporary SQLite database and never touches the configured
  PostgreSQL database.
- `DATABASE_URL` is the only database selector; no database name or credentials are
  hardcoded. PostgreSQL tables are created from the shared ORM metadata at startup.

## Completed phases

- [x] Phase 1 — workspace inspection, dependency list, environment example, ignore rules.
- [x] Phase 2 — PostgreSQL-compatible SQLAlchemy models, relationships, checks, indexes,
  cascade deletion, timestamps, and automatic table creation.
- [x] Phase 3 — explicit Pydantic schemas, reusable CRUD operations, project/task
  endpoints, filtering, validation, safe sessions, and safe error handling.
- [x] Phase 4 — responsive semantic frontend with live dashboard metrics, dialogs,
  confirmed deletion, filters, and loading/empty/success/error states.
- [x] Phase 5 — isolated SQLite pytest suite covering CRUD, validation, filters, partial
  updates, missing resources, and cascade deletion.
- [x] Phase 6 — PostgreSQL-only configuration and documentation; repository hygiene and
  publication review.

## Planned file structure

```text
.
├── PLAN.md
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── crud.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── projects.py
│   │   └── tasks.py
│   └── static/
│       ├── index.html
│       ├── css/style.css
│       └── js/app.js
└── tests/
    ├── conftest.py
    ├── test_projects.py
    └── test_tasks.py
```

## Database verification record

- **SQLite automated suite:** 43 passed, 1 warning in 5.07s. The warning is an upstream
  Starlette/anyio deprecation notice, not an application failure.
- **PostgreSQL live integration:** 43/43 checks passed against PostgreSQL 18 with Psycopg
  3 on an isolated loopback-only verification cluster. The checks covered:
  - database connectivity and startup schema creation;
  - generated tables, indexes, checks, foreign key, and cascade;
  - project and task create/list/get/partial-update/delete;
  - project, status, priority, and combined task filters;
  - blank names, invalid status/priority, invalid filters, missing resources, and
    client-managed field rejection;
  - database-level foreign-key and check-constraint enforcement;
  - PostgreSQL-level cascade deletion;
  - `updated_at` advancement;
  - static frontend assets, Swagger documentation, and a headless-browser render of
    PostgreSQL-backed dashboard data (2 projects, 2 open tasks, 1 completed task).
- **Dependency check:** `pip check` reported no broken requirements.
- **Syntax checks:** Python compilation and JavaScript syntax checks passed.
- **Responsive/front-end verification:** previously verified at desktop, tablet, and
  375px widths with no horizontal overflow and no browser page errors.

The SQLite suite is intentionally not presented as proof of PostgreSQL behavior;
PostgreSQL compatibility was verified separately against a live server.

## Known limitations

- No migration framework. Schema changes require a deliberate migration strategy before
  production use; the startup bootstrap only creates missing tables.
- The automated test suite is SQLite-only. PostgreSQL integration checks are a separate
  live verification rather than part of pytest.
- Timestamps are database-generated and returned without timezone conversion.
- No authentication, pagination, search, or multi-user features are included.
