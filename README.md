# Industrial Project Tracker

A small, complete full-stack application for managing engineering projects and their
tasks. It is deliberately scoped for a technical interview: a clear layered backend, a
responsive interface without a frontend framework, and an isolated automated test suite.

**PostgreSQL is the only supported application database.** SQLite is used only by the
automated test suite and is not a supported runtime or deployment database. The FastAPI
process serves both the JSON API and the static frontend, so there is no separate
frontend development server.

## Features

- Dashboard with project, open-task, and completed-task counts calculated from the API.
- Project list, detail view, creation, editing, and confirmed deletion.
- Task list within a project, creation, editing, and confirmed deletion.
- API-backed task filtering by status and priority.
- Task status, priority, and optional due-date controls.
- Loading, empty, success, validation-error, and request-error states.
- Responsive layout at desktop, tablet, and 375px mobile widths.
- Accessible labels, native dialogs, keyboard focus support, visible status text, and
  screen-reader status/error announcements.

## Technology stack

- Python 3.11+ (verified with Python 3.12)
- FastAPI and Pydantic 2
- SQLAlchemy 2.x with synchronous sessions
- PostgreSQL via Psycopg 3
- HTML5, CSS3, and vanilla JavaScript with `fetch()`
- pytest and FastAPI `TestClient`
- SQLite only for isolated automated tests

## Project structure

```text
.
├── app/
│   ├── main.py              # FastAPI app, lifespan, static files, safe error handlers
│   ├── database.py          # Env config, engine, sessions, dependency, SQLite FK pragma
│   ├── models.py            # Project and Task ORM models
│   ├── schemas.py           # Explicit request/response schemas and enums
│   ├── crud.py              # Reusable database operations
│   ├── routers/
│   │   ├── projects.py      # Project CRUD and project task listing
│   │   └── tasks.py         # Task CRUD, filters, task creation under a project
│   └── static/
│       ├── index.html
│       ├── css/style.css
│       └── js/app.js
├── tests/
│   ├── conftest.py          # Temporary SQLite test database and fixtures
│   ├── test_projects.py
│   └── test_tasks.py
├── requirements.txt
├── .env.example
├── .gitignore
├── PLAN.md
└── README.md
```

## Prerequisites

- Python 3.11 or newer
- PostgreSQL 14 or newer
- A PostgreSQL role that can create the application database and tables

SQLite requires no installation and is used automatically by the test suite. It is not a
supported application database.

## PostgreSQL setup

Create a local role and database with an administrative PostgreSQL account. Replace the
placeholder password and keep the real value out of source control.

```sql
CREATE ROLE ipt_user LOGIN PASSWORD 'replace_me';
CREATE DATABASE industrial_project_tracker OWNER ipt_user;
```

Using `psql` on Windows PowerShell:

```powershell
psql -U postgres
```

```sql
CREATE ROLE ipt_user LOGIN PASSWORD 'replace_me';
CREATE DATABASE industrial_project_tracker OWNER ipt_user;
\q
```

The application creates missing tables from the shared SQLAlchemy metadata at startup.
The status/priority checks, foreign key, cascade delete, indexes, defaults, and timestamps
are therefore created directly in PostgreSQL. No separate PostgreSQL schema file is
needed, and existing tables are never altered automatically.

## Environment configuration

The application loads `.env` from the project root. Start from the example:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

Set the PostgreSQL connection URL:

```dotenv
DATABASE_URL=postgresql+psycopg://ipt_user:replace_me@127.0.0.1:5432/industrial_project_tracker
```

- Replace the username, password, host, port, and database as needed.
- URL-encode special characters in the password (for example `@` as `%40`).
- `.env` is ignored by Git. Never commit real credentials.
- `DATABASE_URL` is required; the application raises a clear configuration error when it
  is missing.
- The URL must use the installed synchronous Psycopg 3 driver, `postgresql+psycopg://`.
- The test suite overrides `DATABASE_URL` with a temporary SQLite URL before importing the
  application, so tests never touch the configured PostgreSQL database.

## Install and run

### Windows PowerShell

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# edit .env with your PostgreSQL connection string
uvicorn app.main:app --reload
```

If PowerShell blocks activation, run the commands directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
# edit .env with your PostgreSQL connection string
uvicorn app.main:app --reload
```

Open:

- Frontend: <http://127.0.0.1:8000/>
- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>

## Run the tests

The automated suite creates a unique temporary SQLite database and replaces the configured
database URL before importing the application. It never connects to PostgreSQL or a
developer database. Foreign keys are enabled on every SQLite test connection, and the
schema is recreated before each test.

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

```bash
pytest -q
```

Current result on Python 3.12.3:

```text
43 passed, 1 warning in 5.07s
```

The warning is an upstream Starlette/anyio deprecation notice about
`anyio.abc.BlockingPortal`; it does not affect test results.

### SQLite tests versus PostgreSQL verification

The pytest suite is intentionally SQLite-only so it runs quickly, in isolation, and
without a database server. Passing those tests does not by itself prove PostgreSQL
behavior.

PostgreSQL compatibility is verified separately against a live PostgreSQL instance. The
live integration checks cover:

- application startup and table creation;
- project and task CRUD;
- project, status, and priority filters;
- request validation and missing-resource responses;
- database-level foreign-key and check constraints;
- cascade deletion at the PostgreSQL level;
- timestamp updates and frontend rendering against PostgreSQL data.

See the verification record in [PLAN.md](PLAN.md) for the latest local result.

### Test strategy

- `TestClient` exercises the real FastAPI routes and Pydantic validation.
- A function-scoped autouse fixture drops and recreates all tables, so tests do not
  depend on execution order.
- The SQLite test URL is set before importing `app`, ensuring `.env` cannot redirect the
  tests to the PostgreSQL development database.
- `PRAGMA foreign_keys=ON` is applied on SQLite connections so the same foreign-key
  cascade behavior is exercised.
- Coverage includes project CRUD and validation, task CRUD, invalid enums, missing
  resources, partial PATCH semantics, client-managed field rejection, filters, deletion,
  and project-to-task cascade deletion.

## API reference

All endpoints are prefixed with `/api`. Errors use JSON `{"detail": ...}` responses.

| Method | Path | Success | Description |
| --- | --- | --- | --- |
| `GET` | `/api/projects` | `200` | List projects, newest first |
| `POST` | `/api/projects` | `201` | Create a project |
| `GET` | `/api/projects/{id}` | `200` | Retrieve a project |
| `PATCH` | `/api/projects/{id}` | `200` | Partially update a project |
| `DELETE` | `/api/projects/{id}` | `204` | Delete a project and its tasks |
| `GET` | `/api/projects/{id}/tasks` | `200` | List tasks for a project |
| `POST` | `/api/projects/{id}/tasks` | `201` | Create a task for an existing project |
| `GET` | `/api/tasks` | `200` | List tasks; optional filters below |
| `GET` | `/api/tasks/{id}` | `200` | Retrieve a task |
| `PATCH` | `/api/tasks/{id}` | `200` | Partially update a task |
| `DELETE` | `/api/tasks/{id}` | `204` | Delete a task |

Task list filters:

```text
GET /api/tasks?project_id=1&status=in_progress&priority=high
```

Allowed values:

- Project status: `active`, `completed`, `archived`
- Task status: `planned`, `in_progress`, `completed`
- Task priority: `low`, `medium`, `high`

Invalid values return `422`; missing resources return `404`. IDs and timestamps are
server-managed and rejected as request fields. PATCH requests only change explicitly
supplied fields.

### Example requests

```bash
curl -X POST http://127.0.0.1:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Pump Station Upgrade","description":"Phase 2","status":"active"}'

curl -X POST http://127.0.0.1:8000/api/projects/1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Review P&ID","status":"in_progress","priority":"high"}'

curl "http://127.0.0.1:8000/api/tasks?status=planned&priority=high"
```

## Data model

### Project

`id` (server-generated auto-increment integer), `name` (1–120 characters), optional
`description`, `status` (default `active`), `created_at`, `updated_at`.

### Task

`id` (server-generated auto-increment integer), required `project_id`, `title` (1–150
characters), optional `description`, `status` (default `planned`), `priority` (default
`medium`), optional `due_date`, `created_at`, `updated_at`.

Integrity is enforced at both layers:

- Pydantic validates required text, length limits, enum values, and forbidden fields.
- PostgreSQL enforces status/priority `CHECK` constraints, the non-null foreign key, and
  `ON DELETE CASCADE`.
- Indexes cover `project_id`, `status`, `priority`, and `due_date`.
- ORM relationships pair one project with many tasks and cascade deletes.

## Design decisions

- **Small layers, clear ownership.** `main.py` wires the app; `database.py` owns engine
  and sessions; `models.py` owns persistence; `schemas.py` owns the API contract;
  `crud.py` owns reusable queries; routers own HTTP concerns and error mapping.
- **One application database.** PostgreSQL is the only supported runtime database.
  Generic SQLAlchemy constructs keep the models portable to the isolated SQLite test
  backend without carrying a second production-database abstraction.
- **Explicit schemas.** ORM objects are never returned indiscriminately. Pydantic
  response models define the public payload, while `extra="forbid"` prevents clients
  from setting IDs or timestamps.
- **Safe sessions.** The session dependency rolls back on exceptions and always closes
  the session. Commits roll back on failure, and SQLAlchemy errors are logged server-side
  while the API returns a generic `500` JSON response with no stack trace or credentials.
- **Single origin.** FastAPI serves the frontend plus `/docs`, so there is no CORS setup or
  separate frontend build server.
- **Live UI state.** The browser retrieves dashboard metrics from `/api/projects` and
  `/api/tasks`; task counts are never hardcoded. Detail tasks use the API filter
  parameters. After mutations the affected views are reloaded with `fetch()`.
- **Safe DOM rendering.** User text is inserted with `textContent`, not with HTML template
  interpolation, preventing stored XSS.
- **No decorative complexity.** There are no animations, charts, frontend frameworks, or
  unnecessary dependencies. Status and priority are always conveyed with text labels as
  well as color.

## Known limitations

- No authentication, authorization, multi-tenancy, or user accounts; it is a local
  single-user tool.
- No pagination, full-text search, or sorting controls. The interface is intended for a
  small portfolio.
- No migration framework. Tables are created from the shared ORM metadata at startup;
  existing tables are not altered. Schema changes require a deliberate migration strategy
  before production use.
- The automated suite uses SQLite and therefore does not itself prove PostgreSQL-specific
  behavior. PostgreSQL is verified separately against a live server, and that distinction
  is documented above.
- Timestamps are generated by the database and returned without timezone conversion. The
  browser formats dates in the local timezone.
- The frontend is a single page with no routing; browser history is not used.
- No CSRF protection is needed for a same-origin, unauthenticated local app, but it would
  need review before exposing the API on a public network.
