"""Not run — see conftest.py's module docstring."""
from datetime import date, timedelta


def _register_and_login(client, email="tech@hmzc-test.com", role="inspector"):
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "full_name": "Tech", "role": role},
    )
    login = client.post("/api/auth/login", data={"username": email, "password": "password123"})
    return login.json()["access_token"]


def _admin_create_and_login(client, admin_token, email, role):
    create = client.post(
        "/api/auth/users",
        json={"email": email, "full_name": email.split("@")[0], "role": role},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    temp_password = create.json()["temporary_password"]
    login = client.post("/api/auth/login", data={"username": email, "password": temp_password})
    return login.json()["access_token"]


def _create_certificate(client, token, cert_no, date_of_servicing, status="final"):
    payload = {
        "cert_no": cert_no,
        "equipment_type": "lifeboat",
        "vessel_name": "MV Test Vessel",
        "imo_no": "1234567",
        "status": status,
        "date_of_servicing": date_of_servicing,
        "payload": {"certNo": cert_no, "type": "lifeboat", "vesselName": "MV Test Vessel"},
    }
    response = client.post("/api/certificates", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    return response.json()


def test_expiring_certificates_requires_view_all_permission(client):
    """Inspector/Technical only ever sees their own certificates (CERT_VIEW,
    not CERT_VIEW_ALL) — the company-wide expiring-soon list is exactly the
    kind of cross-account visibility that permission distinction exists
    to gate, same as list_certificates itself."""
    token = _register_and_login(client)  # bootstrap admin, but re-used as a plain inspector-role account below
    inspector_token = _admin_create_and_login(client, token, "inspector2@hmzc-test.com", "inspector")
    response = client.get("/api/reports/expiring-certificates", headers={"Authorization": f"Bearer {inspector_token}"})
    assert response.status_code == 403


def test_expiring_certificates_lists_within_window_and_marks_overdue(client):
    admin_token = _register_and_login(client, email="admin@hmzc-test.com")
    today = date.today()

    # Expiry = date_of_servicing + 365 days.
    overdue_dos = (today - timedelta(days=370)).isoformat()  # expiry was 5 days ago
    soon_dos = (today - timedelta(days=350)).isoformat()  # expiry in 15 days — inside the 30-day lead window
    far_dos = today.isoformat()  # expiry in 365 days — outside the window

    _create_certificate(client, admin_token, "CERT/HMZCS/LB/OVERDUE-001", overdue_dos)
    _create_certificate(client, admin_token, "CERT/HMZCS/LB/SOON-001", soon_dos)
    _create_certificate(client, admin_token, "CERT/HMZCS/LB/FAR-001", far_dos)
    # A draft with an otherwise-expiring date shouldn't show up — it was
    # never actually issued.
    _create_certificate(client, admin_token, "CERT/HMZCS/LB/DRAFT-001", overdue_dos, status="draft")

    response = client.get("/api/reports/expiring-certificates", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200, response.text
    body = response.json()
    cert_nos = [c["cert_no"] for c in body]
    assert cert_nos == ["CERT/HMZCS/LB/OVERDUE-001", "CERT/HMZCS/LB/SOON-001"]  # most-urgent (overdue) first
    assert body[0]["overdue"] is True
    assert body[1]["overdue"] is False


def test_certificates_summary_counts_only_finalized(client):
    admin_token = _register_and_login(client, email="admin@hmzc-test.com")
    today = date.today().isoformat()
    _create_certificate(client, admin_token, "CERT/HMZCS/LB/FINAL-001", today, status="final")
    _create_certificate(client, admin_token, "CERT/HMZCS/LB/DRAFT-002", today, status="draft")

    response = client.get("/api/reports/certificates-summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200, response.text
    assert response.json()["total_finalized"] == 1


def test_expiry_reminder_run_requires_admin(client):
    admin_token = _register_and_login(client, email="admin@hmzc-test.com")
    sales_token = _admin_create_and_login(client, admin_token, "sales@hmzc-test.com", "sales")
    response = client.post("/api/reports/expiry-reminders/run", headers={"Authorization": f"Bearer {sales_token}"})
    assert response.status_code == 403


def test_expiry_reminder_sends_once_then_skips_already_reminded(client, monkeypatch):
    """The real email send is mocked out (no real SMTP in tests — see
    core/email.py's own comment on what was/wasn't actually tested) but
    the state-tracking behavior around it is real: a certificate should
    only ever trigger the digest once, not on every scheduled run."""
    from app.core.config import settings
    import app.core.expiry_reminders as expiry_reminders_module

    monkeypatch.setattr(settings, "EXPIRY_REMINDER_EMAILS", "staff@hmzc-test.com")
    sent_payloads = []

    def fake_send(to_emails, certificates):
        sent_payloads.append((to_emails, certificates))
        return True

    monkeypatch.setattr(expiry_reminders_module, "send_expiry_reminder_email", fake_send)

    admin_token = _register_and_login(client, email="admin@hmzc-test.com")
    soon_dos = (date.today() - timedelta(days=350)).isoformat()
    _create_certificate(client, admin_token, "CERT/HMZCS/LB/REMIND-001", soon_dos)

    first = client.post("/api/reports/expiry-reminders/run", headers={"Authorization": f"Bearer {admin_token}"})
    assert first.status_code == 200, first.text
    assert first.json()["reminded"] == 1
    assert len(sent_payloads) == 1
    assert sent_payloads[0][0] == ["staff@hmzc-test.com"]

    second = client.post("/api/reports/expiry-reminders/run", headers={"Authorization": f"Bearer {admin_token}"})
    assert second.status_code == 200, second.text
    assert second.json()["reminded"] == 0  # already reminded — not sent again
    assert len(sent_payloads) == 1  # no second email attempt
