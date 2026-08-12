import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

import app.models  # noqa: F401 — registers every model with Base for relationship resolution
from app.api.routes import auth, backup as backup_routes, certificates, finance, health, jobs, photos, reports, settings as settings_routes, suppliers
from app.core.backup import is_backup_configured, run_backup
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.expiry_reminders import send_expiry_reminders

logger = logging.getLogger("hmzc.startup")

BACKUP_INTERVAL_SECONDS = 24 * 60 * 60
EXPIRY_REMINDER_CHECK_INTERVAL_SECONDS = 24 * 60 * 60


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


async def _expiry_reminder_loop() -> None:
    """
    Same shape as _backup_loop above — runs in this same always-on
    process, not relying on anyone remembering to check certificates
    manually. Opens its own DB session per run (SessionLocal, not the
    request-scoped get_database dependency) since there's no request
    here to hang one off of.

    Deliberately no "configured?" pre-check gating the whole loop off
    at startup (there used to be one) — the recipient list is now an
    admin-editable Settings row (see core/expiry_reminders.py,
    api/routes/settings.py) that can be configured or changed at any
    time without a restart, so a check made once here at boot would go
    stale the moment an admin saves a Settings change. send_expiry_
    reminders itself already checks per-run and returns a "skipped"
    result (logged below) when nothing's configured yet.
    """
    await asyncio.sleep(90)
    while True:
        db = SessionLocal()
        try:
            result = await asyncio.to_thread(send_expiry_reminders, db)
            logger.info("Expiry reminder check finished: %s", result)
        except Exception:
            logger.exception("Expiry reminder check raised an unhandled exception")
        finally:
            db.close()
        await asyncio.sleep(EXPIRY_REMINDER_CHECK_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    backup_task = asyncio.create_task(_backup_loop())
    expiry_task = asyncio.create_task(_expiry_reminder_loop())
    yield
    backup_task.cancel()
    expiry_task.cancel()

# Schema is created/updated by `alembic upgrade head` (see the
# Dockerfile's CMD, which runs it before uvicorn on every single
# container start — local Docker Compose and Railway alike). This used
# to also call Base.metadata.create_all(bind=engine) here as a stand-in,
# which was fine for creating brand new tables but could never ALTER an
# existing one — exactly what let users.must_change_password quietly go
# missing from any database stood up before migrations existed. Removed
# now that every environment's database is stamped to a real Alembic
# revision and every startup actually runs migrations, not just once
# manually remembered by whoever happened to be setting up that database.
app = FastAPI(
    title="HMZC Marine Inspection & Certification Management System",
    version="1.0",
    lifespan=lifespan,
)

# Found during a security review — this app had no security headers at
# all beyond FastAPI's own defaults. None of these change behavior for
# a legitimate client; they only close off classes of attack a browser
# would otherwise still allow:
#   - X-Content-Type-Options: nosniff stops a browser from guessing a
#     response's type against its declared Content-Type (MIME sniffing),
#     which matters most for the photo-serving endpoint (core/photo_
#     storage.py's files are user-supplied images, saved and served back).
#   - X-Frame-Options: DENY / frame-ancestors stop this API's responses
#     (particularly the public /verify and /photos endpoints, the only
#     ones without auth) from being framed on another site for
#     clickjacking.
#   - Referrer-Policy limits what leaks in the Referer header on
#     outbound links/requests, since URLs here can contain cert numbers.
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Root-caused from an audit pass: nowhere in this app caught
# IntegrityError, even though several routes generate a candidate unique
# value (job_no, cert_no, a finance item's code) by reading existing rows
# and picking the next free one, then insert — a genuine TOCTOU race
# between two concurrent requests choosing the same candidate ends in an
# uncaught IntegrityError, which FastAPI turns into a raw 500 with no
# useful message. A global handler is simpler and more robust than
# fixing each call site individually (and catches any future one written
# the same way): the client gets a clean 409 asking it to retry, exactly
# the same shape as the deliberate version-conflict 409s already used
# elsewhere in this app, instead of a generic server-error page.
@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError) -> JSONResponse:
    logger.warning("IntegrityError on %s: %s", exc.__class__.__name__, str(exc.orig) if exc.orig else exc)
    return JSONResponse(
        status_code=409,
        content={"detail": "That couldn't be saved because of a conflicting change (likely two requests at the same moment). Please try again."},
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
app.include_router(jobs.router, prefix="/api/jobs")
app.include_router(finance.router, prefix="/api/finance")
app.include_router(photos.router, prefix="/api/photos")
app.include_router(backup_routes.router, prefix="/api/backup")
app.include_router(reports.router, prefix="/api/reports")
app.include_router(settings_routes.router, prefix="/api/settings")
app.include_router(suppliers.router, prefix="/api/suppliers")


@app.get("/")
def root():
    return {"message": "HMZC Backend API Running"}
