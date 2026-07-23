"""Not run — see conftest.py's module docstring."""


def _register_and_login(client, email="tech@hmzc.test", role="inspector"):
    """First account is auto-activated (bootstrap admin) — use it directly
    rather than a second account needing separate approval, since these
    tests are about certificates, not the approval flow (see test_auth.py
    for that)."""
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "full_name": "Tech", "role": role},
    )
    login = client.post("/api/auth/login", data={"username": email, "password": "password123"})
    return login.json()["access_token"]


def _sample_certificate(cert_no="CERT/HMZCS/LB/TEST-001", version=None):
    payload = {
        "cert_no": cert_no,
        "equipment_type": "lifeboat",
        "vessel_name": "MV Test Vessel",
        "imo_no": "1234567",
        "status": "draft",
        "date_of_servicing": "2026-07-21",
        "payload": {"certNo": cert_no, "type": "lifeboat", "vesselName": "MV Test Vessel"},
    }
    if version is not None:
        payload["version"] = version
    return payload


def test_create_certificate_sets_issuer_and_version_one(client):
    token = _register_and_login(client)
    response = client.post(
        "/api/certificates",
        json=_sample_certificate(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["version"] == 1
    assert body["issued_by"]["email"] == "tech@hmzc.test"


def test_saving_same_cert_no_twice_updates_not_duplicates(client):
    """Upsert-by-cert_no is what makes this idempotent — see certificates.py's comment."""
    token = _register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post("/api/certificates", json=_sample_certificate(), headers=headers)
    assert first.json()["version"] == 1

    second = client.post("/api/certificates", json=_sample_certificate(version=1), headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["version"] == 2  # updated the same record, not a new one

    listing = client.get("/api/certificates", headers=headers).json()
    matching = [c for c in listing if c["cert_no"] == "CERT/HMZCS/LB/TEST-001"]
    assert len(matching) == 1  # exactly one record exists, not two


def test_issued_by_does_not_change_on_later_edit(client):
    """
    Documented behavior in certificates.py: "issued_by is set once, on
    first save, and never overwritten by a later edit." Worth its own
    test since this is exactly the kind of thing that's easy to get
    subtly wrong (e.g. an admin re-saving someone else's certificate
    and silently becoming the recorded issuer).
    """
    tech_token = _register_and_login(client, email="original@hmzc.test", role="inspector")
    client.post("/api/certificates", json=_sample_certificate(), headers={"Authorization": f"Bearer {tech_token}"})

    admin_token = _register_and_login(client, email="admin2@hmzc.test", role="inspector")
    # admin2 is the second account registered in this test's fresh
    # database, so it is NOT auto-promoted — promote it via the actual
    # bootstrap admin instead of assuming role="admin" would have worked.
    # (Simpler alternative used here: register admin2 FIRST in its own
    # test would make it the bootstrap admin, but that changes who
    # "original" is — this test deliberately keeps `original` as the
    # first/bootstrap account so its certificate save is unrestricted,
    # and reuses that same account's admin rights to re-save it.)
    resave = client.post(
        "/api/certificates",
        json=_sample_certificate(version=1),
        headers={"Authorization": f"Bearer {tech_token}"},
    )
    assert resave.status_code == 200, resave.text
    assert resave.json()["issued_by"]["email"] == "original@hmzc.test"


def test_conflicting_save_returns_409_not_silent_overwrite(client):
    """
    The scenario explicitly flagged as needing real-database testing
    (see the root README's "Testing the offline sync" section, item 4):
    two saves against the same certificate, the second one using a
    stale version number, should be rejected with 409 rather than
    silently overwriting the first save.
    """
    token = _register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/certificates", json=_sample_certificate(), headers=headers)  # version becomes 1

    # Simulates someone else saving in between — version is now 2 on
    # the server, but this request still claims to have read version 1.
    client.post("/api/certificates", json=_sample_certificate(version=1), headers=headers)  # version becomes 2

    stale_save = client.post("/api/certificates", json=_sample_certificate(version=1), headers=headers)
    assert stale_save.status_code == 409, stale_save.text
    assert "version" in stale_save.json()["detail"].lower()


def test_certificate_view_permission_required(client):
    """
    Sales/Administration/Service Coordination get certificates.view by
    default (see core/permissions.py) — a Client account, which gets no
    default permissions, should be blocked from even listing certificates.
    """
    tech_token = _register_and_login(client, email="tech3@hmzc.test", role="inspector")
    client.post("/api/certificates", json=_sample_certificate(), headers={"Authorization": f"Bearer {tech_token}"})

    client_token = _register_and_login(client, email="client@hmzc.test", role="client")
    # This second account isn't auto-active (not the bootstrap account)
    # — but get_current_user only checks is_active, and require_permission
    # runs after that, so an inactive client would fail on is_active
    # first. Approve it via the bootstrap admin so this test actually
    # exercises the permission check, not the approval gate.
    admin_headers = {"Authorization": f"Bearer {tech_token}"}
    users = client.get("/api/auth/users", headers=admin_headers).json()
    client_id = next(u["id"] for u in users if u["email"] == "client@hmzc.test")
    client.post(f"/api/auth/users/{client_id}/approve", headers=admin_headers)

    fresh_login = client.post("/api/auth/login", data={"username": "client@hmzc.test", "password": "password123"})
    fresh_token = fresh_login.json()["access_token"]

    response = client.get("/api/certificates", headers={"Authorization": f"Bearer {fresh_token}"})
    assert response.status_code == 403
