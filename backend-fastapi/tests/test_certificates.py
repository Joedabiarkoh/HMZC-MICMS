"""Not run — see conftest.py's module docstring."""


def _register_and_login(client, email="tech@hmzc-test.com", role="inspector"):
    """First account is auto-activated (bootstrap admin) — use this only
    for the first account in a given test's fresh database. Any account
    after that must go through _admin_create_and_login below instead:
    self-registration for a second account is rejected outright now
    (see the root README's "Admin-only account creation" section), not
    created-but-pending the way it used to be."""
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "full_name": "Tech", "role": role},
    )
    login = client.post("/api/auth/login", data={"username": email, "password": "password123"})
    return login.json()["access_token"]


def _admin_create_and_login(client, admin_token, email, role):
    """For every account after the first in a test — admin-created
    accounts are active immediately (no separate approval step), with a
    generated temporary password this logs in with right away."""
    create = client.post(
        "/api/auth/users",
        json={"email": email, "full_name": email.split("@")[0], "role": role},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    temp_password = create.json()["temporary_password"]
    login = client.post("/api/auth/login", data={"username": email, "password": temp_password})
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
    assert body["issued_by"]["email"] == "tech@hmzc-test.com"


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
    original_token = _register_and_login(client, email="original@hmzc-test.com", role="inspector")
    client.post("/api/certificates", json=_sample_certificate(), headers={"Authorization": f"Bearer {original_token}"})

    # A genuinely different account — an admin, created via `original`'s
    # own bootstrap-admin rights — re-saves the certificate `original`
    # issued. issued_by must stay "original" throughout, not silently
    # become the resaving admin.
    other_admin_token = _admin_create_and_login(client, original_token, "otheradmin@hmzc-test.com", "admin")
    resave = client.post(
        "/api/certificates",
        json=_sample_certificate(version=1),
        headers={"Authorization": f"Bearer {other_admin_token}"},
    )
    assert resave.status_code == 200, resave.text
    assert resave.json()["issued_by"]["email"] == "original@hmzc-test.com"


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
    tech_token = _register_and_login(client, email="tech3@hmzc-test.com", role="inspector")
    client.post("/api/certificates", json=_sample_certificate(), headers={"Authorization": f"Bearer {tech_token}"})

    # tech3 is the bootstrap account (first in this test's fresh
    # database), so it's an admin — use its rights to create the client
    # account directly. Admin-created accounts are active immediately,
    # so there's no separate approval step needed before this test can
    # exercise the actual permission check.
    client_token = _admin_create_and_login(client, tech_token, "client@hmzc-test.com", "client")

    response = client.get("/api/certificates", headers={"Authorization": f"Bearer {client_token}"})
    assert response.status_code == 403
