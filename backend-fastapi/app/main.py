import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401 — registers every model with Base before create_all runs below
from app.api.routes import auth, backup as backup_routes, certificates, finance, health, photos
from app.core.backup import is_backup_configured, run_backup
from app.core.config import settings
from app.core.database import Base, engine

logger = logging.getLogger("hmzc.startup")

BACKUP_INTERVAL_SECONDS = 24 * 60 * 60


async def _backup_loop() -> None:
    """
    Runs on Railway, inside this same always-on process — not on anyone's
    laptop (see core/backup.py's own comment for why that distinction
    matters). First run happens shortly after startup as a fast sanity
    check rather than waiting a full day to discover misconfiguration;
    every run after that is 24 hours apart.
    """
    if not is_backup_configured():
        logger.warning("BACKUP_S3_* not configured — scheduled backups are OFF.")
        return
    await asyncio.sleep(60)
    while True:
        try:
            result = await asyncio.to_thread(run_backup)
            logger.info("Scheduled backup finished: %s", result)
        except Exception:
            logger.exception("Scheduled backup raised an unhandled exception")
        await asyncio.sleep(BACKUP_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_backup_loop())
    yield
    task.cancel()

# Module 2 (Users + Auth) additions, merged in rather than replacing this
# file wholesale — the pasted chat output regenerated its own main.py from
# scratch (different title, no health route), so only what's actually new
# was added here:
#   - CORS middleware, so the React frontend (a different origin in dev)
#     can call this API.
#   - Base.metadata.create_all(bind=engine) as a stand-in until Alembic
#     migrations exist (see migrations/ — still empty).
#   - auth.router, mounted at /api/auth (register/login/me/users), the
#     same way health.router is already mounted at /api.
#   - certificates.router, mounted at /api/certificates — the backend
#     table certificates previously only lived in browser localStorage
#     for (see inspection.storage.ts and the README's former "Next step").
#   - finance.router, mounted at /api/finance — item catalog, quotations,
#     invoices. The chat's original finance.api.ts already called
#     /finance/dashboard, /finance/quotation(s), /finance/invoice(s) etc.
#     with no backend behind any of it; this is that backend's first
#     real piece (catalog + quotations + invoices — dashboard/payments/
#     expenses/job-costing/reports still aren't built).
#
# Base.metadata.create_all(bind=engine) below is NOT "a stand-in until
# Alembic migrations exist" anymore — migrations/ now has real ones (see
# migrations/README.md). create_all() is kept because it's genuinely
# harmless to leave running (it only creates tables that don't exist
# yet, checkfirst=True by default — it can't conflict with Alembic or
# touch existing data) and it's convenient for a truly fresh install.
# What it can NOT do is add a new column to a table that already
# exists — that's what caused users.must_change_password to be missing
# from any database stood up before migrations existed, and it's why
# migrations/README.md, not this comment, is the real source of truth
# for "how do I actually apply a schema change."
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HMZC Marine Inspection & Certification Management System",
    version="1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # Was allow_origins=["*"] — invalid together with allow_credentials=True
    # per the CORS spec (browsers reject the wildcard+credentials
    # combination silently, which is a worse failure mode than an error).
    # See Settings.CORS_ORIGINS in core/config.py to configure this per
    # environment rather than hardcoding a deployment URL here.
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(certificates.router, prefix="/api/certificates")
app.include_router(finance.router, prefix="/api/finance")
app.include_router(photos.router, prefix="/api/photos")
app.include_router(backup_routes.router, prefix="/api/backup")


@app.get("/")
def root():
    return {"message": "HMZC Backend API Running"}
