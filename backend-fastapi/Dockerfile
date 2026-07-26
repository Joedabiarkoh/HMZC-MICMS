FROM python:3.12-slim

WORKDIR /app

# postgresql-client provides pg_dump, used by core/backup.py to produce
# real, restorable database backups (same tool/format used for the local
# D:\HMZC-Backups scripts) rather than hand-rolling a SQL export.
#
# Debian's own default repo only ships client v17, but Railway's Postgres
# template runs v18 (proven by actually running this, not assumed —
# pg_dump refused with "aborting because of server version mismatch:
# server version 18.4, pg_dump version 17.10"). pg_dump can dump an
# OLDER server than itself, never a newer one, so the client here must
# be pinned to match — installed from the official PGDG apt repo since
# Debian's own repo doesn't carry v18 yet.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# `alembic upgrade head` runs on every single container start, in every
# environment (local Docker Compose and Railway alike) - not a
# Railway-specific "preDeployCommand" setting, which would only live in
# Railway's own config and not be visible in, or portable with, the
# repo itself. This is what actually closes the gap Base.metadata.
# create_all() (removed from main.py) never could: create_all() can add
# a brand new table, but never ALTER an existing one, so any future
# schema change (e.g. a new column) would previously need someone to
# remember to run migrations by hand against whatever database that
# change was heading to. Both the local and Railway databases were
# stamped to 0003_permissions_and_roles (their already-current real
# schema, from before migrations were wired in here) so this doesn't
# try to re-run history against tables that already exist.
#
# Shell form (not exec-form JSON array) so ${PORT:-8000} actually
# expands - Railway injects PORT and expects the app to listen on it,
# but local Docker Compose doesn't set PORT at all, hence the :-8000
# fallback matching docker-compose.yml's hardcoded "8000:8000" mapping.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
