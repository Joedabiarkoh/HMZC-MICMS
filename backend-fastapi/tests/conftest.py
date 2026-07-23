"""
Shared test fixtures.

Real problem caught and fixed while writing this, worth explaining
rather than hiding: app/main.py runs Base.metadata.create_all(bind=engine)
at *import time*, using the engine built from the real configured
DATABASE_URL (see app/core/database.py). Simply doing `from app.main
import app` for testing purposes — the obvious way to get a TestClient
— would therefore try to connect to whatever real database is
configured (or crash if there isn't one reachable), before a single
test even runs. The environment variables below are set *before*
anything from `app` is imported for exactly this reason: they make
Settings() (app/core/config.py) resolve to a harmless throwaway SQLite
file instead of requiring a real Postgres connection just to import the
app. The actual database each test talks to is still fully isolated via
the get_database dependency override further down — this only stops
import-time code from reaching out to a real database at all.

Confirmed nothing here has ever actually been run (no network access to
`pip install pytest` in the environment this was written in) — written
carefully and checked for syntax/import/undefined-name correctness,
same as the rest of this codebase, but "passes static analysis" and
"actually passes when pytest runs it" are different claims. Run this
for real — `pip install -r requirements-dev.txt && pytest` — before
trusting it.

Uses SQLite, not Postgres, for the actual per-test database too — a
deliberate, standard tradeoff (fast, no external service needed) with a
real limitation: SQLite doesn't have a native ENUM type (SQLAlchemy
emulates it with a CHECK constraint) and is generally looser about type
enforcement than Postgres. These tests can confirm the application
logic is correct; they're not a substitute for testing against real
Postgres before production, especially for the migrations themselves
(see migrations/README.md, which says the same thing for the same
reason).
"""
import os

# Must happen before any `app.*` import — pydantic-settings reads these
# at Settings() instantiation, which happens the moment app.core.config
# (imported by nearly everything else) is first imported.
os.environ.setdefault("APP_NAME", "HMZC Test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_import_time.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-real-use-only-for-pytest-runs")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — registers every model with Base, same as main.py
from app.core.database import Base, get_database
from app.main import app

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """
    core/rate_limit.py's _attempts dict is module-level state, shared
    across every test in the same pytest process (TestClient's fake
    request host is constant, so every test would otherwise share the
    same rate-limit bucket). Without this, test_login_rate_limited_
    after_repeated_attempts would pass or fail depending on which other
    tests happened to run first — a real flakiness bug caught while
    writing the tests, not a hypothetical one. autouse=True so every
    test gets a clean slate without having to remember to ask for it.
    """
    from app.core.rate_limit import _attempts

    _attempts.clear()
    yield
    _attempts.clear()


@pytest.fixture()
def db_session():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_database():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_database] = override_get_database
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_token(client):
    """
    Registers the very first account, which register_user auto-activates
    and promotes to admin (see the bootstrap logic in api/routes/auth.py)
    — this fixture exercises that path directly rather than assuming it
    works.
    """
    client.post(
        "/api/auth/register",
        json={"email": "admin@hmzc.test", "password": "adminpassword123", "full_name": "Test Admin", "role": "inspector"},
    )
    response = client.post(
        "/api/auth/login",
        data={"username": "admin@hmzc.test", "password": "adminpassword123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]
