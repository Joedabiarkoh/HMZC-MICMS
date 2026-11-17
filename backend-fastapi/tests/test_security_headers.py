"""
Hosting-review follow-ups: the production API must not publish its
interactive docs / endpoint map, and every response must carry the
browser security headers.
"""
import importlib
import sys

import pytest
from fastapi.testclient import TestClient


def test_api_docs_are_disabled_by_default(client):
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404, f"{path} should not be served"


def test_real_endpoints_still_work_with_docs_disabled(client):
    assert client.get("/api/health").status_code == 200


def test_security_headers_present_on_every_response(client):
    # An ordinary 200 and a 401 (auth failure) and a 404 should all carry them.
    for path in ("/api/health", "/api/auth/users", "/no-such-route"):
        headers = client.get(path).headers
        assert headers["strict-transport-security"] == "max-age=31536000"
        assert headers["x-content-type-options"] == "nosniff"
        assert headers["x-frame-options"] == "DENY"
        assert headers["content-security-policy"] == "frame-ancestors 'none'"
        assert headers["referrer-policy"] == "strict-origin-when-cross-origin"


def test_api_docs_can_be_opted_into(monkeypatch):
    """ENABLE_API_DOCS=true brings the docs back (local development only)."""
    monkeypatch.setenv("ENABLE_API_DOCS", "true")
    # Settings() and the FastAPI() constructor both run at import time, so
    # build a fresh app module under the new environment, then restore the
    # real one so later tests are unaffected.
    saved = {name: mod for name, mod in sys.modules.items() if name in ("app.main", "app.core.config")}
    for name in saved:
        del sys.modules[name]
    try:
        fresh = importlib.import_module("app.main")
        c = TestClient(fresh.app)
        assert c.get("/docs").status_code == 200
        assert c.get("/openapi.json").status_code == 200
    finally:
        for name in ("app.main", "app.core.config"):
            sys.modules.pop(name, None)
        sys.modules.update(saved)
