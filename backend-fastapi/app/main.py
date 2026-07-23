from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401 — registers every model with Base before create_all runs below
from app.api.routes import auth, certificates, finance, health
from app.core.config import settings
from app.core.database import Base, engine

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


@app.get("/")
def root():
    return {"message": "HMZC Backend API Running"}
