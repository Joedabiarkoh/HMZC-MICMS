# HMZC-MICMS Backend (FastAPI)

Foundation backend for the HMZC Marine Inspection & Certification Management System.

## Running tests

Nothing here has actually been executed — see `tests/conftest.py`'s
docstring for exactly what that means and why. Once you have a real
Python environment:

```bash
pip install -r requirements-dev.txt
pytest
```

Uses an isolated in-memory SQLite database per test, not your real
Postgres — fast, no setup needed, but not a full substitute for testing
against real Postgres before production (SQLite doesn't have a native
ENUM type, for one). Covers registration/login/the account-approval
bootstrap problem, admin-only actions being actually rejected for
non-admins, the temporary-password-forces-a-change flow, and the
certificate conflict-detection scenario (two saves against the same
record, the second with a stale version) that the root README
specifically flagged as needing a real test rather than just
inspection.

## Run locally (no Docker)

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
cp .env.local.example .env   # then edit DATABASE_URL/password
uvicorn app.main:app --reload
```

Visit http://127.0.0.1:8000 and http://127.0.0.1:8000/docs

## API routes

- `GET /api/health` — health check
- `POST /api/auth/register` — create an account (email, password, full_name, role)
- `POST /api/auth/login` — OAuth2 password flow (form-encoded `username`=email, `password`), returns a JWT
- `GET /api/auth/me` — current signed-in user (requires `Authorization: Bearer <token>`)
- `GET /api/auth/users` — **admin-only**, every registered account
- `PATCH /api/auth/users/{id}/role?new_role=admin` — **admin-only**, promote/change another account's role
- `POST /api/auth/users/{id}/approve` — **admin-only**, activates a new sign-up or a previously deactivated account
- `POST /api/auth/users/{id}/deactivate` — **admin-only**, suspends access without deleting the account's history
- `POST /api/auth/users/{id}/reset-password` — **admin-only**, generates a new temporary password (returned once — see the README's "Account approval and password recovery" section for why there's no way to retrieve an existing one)
- `POST /api/auth/change-password` — self-service, requires current password
- `POST /api/certificates` — save a certificate (creates or updates by `cert_no`); `issued_by` is set to whoever's signed in, once, on first save
- `GET /api/certificates` — every certificate, with issuer and timestamps (any signed-in user)
- `DELETE /api/certificates/{cert_no}` — **admin-only**
- `GET/POST /api/finance/items` — item/price catalog (read: Finance or Admin; write: **admin-only**)
- `PATCH /api/finance/items/{id}` — **admin-only**
- `GET/POST /api/finance/quotations`, `DELETE /api/finance/quotations/{quotation_no}` — Finance or Admin can create; an Admin can edit/delete any, a Finance user only their own
- `GET/POST /api/finance/invoices`, `DELETE /api/finance/invoices/{invoice_no}` — same permission model as quotations

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Visit http://localhost:8000 and http://localhost:8000/api/health

## Folder structure

```
app/
  main.py          FastAPI entrypoint
  core/            config, database, security, logging
  api/routes/      route modules (health.py so far)
  models/          SQLAlchemy models (base.py so far)
  schemas/         Pydantic request/response schemas (empty — next module)
  services/        business logic / integrations (empty — next module)
  repositories/    DB access layer (empty — next module)
  utils/           shared helpers (empty)
migrations/        Alembic migrations (run `alembic init migrations` when ready)
tests/             pytest tests
```

## Notes on inconsistencies resolved from the source chat

- Two different `.env` credential sets were used across the conversation
  (`hmzc_user`/`postgres` host for Docker vs `postgres`/`localhost` for the
  manual pgAdmin walkthrough). Both are kept as separate files —
  `.env.example` (Docker) and `.env.local.example` (local Postgres install)
  — instead of picking one and silently breaking the other workflow.
- `requirements.txt` appeared twice with different contents (the second
  version, tied to certificate generation, added `reportlab`, `qrcode`,
  `pillow`). Both are merged into one file here.
- `core/logging.py` and password-hashing helpers in `core/security.py` were
  referenced/implied (folder diagram, "Password Hashing" in Module 2,
  `passlib[bcrypt]` in requirements.txt) but never actually written in the
  chat — minimal implementations are included so the structure isn't
  pointing at empty promises.
