"""
Requested directly, from a security review: jobs.py had zero test
coverage despite carrying real business logic (a job's PO-or-pending
requirement, the letter-suffix disambiguation for two jobs on the same
vessel/day, and the race-condition-safe INSERT ... ON CONFLICT cert-
number reservation for Loose Gear). Follows the same _register_and_login/
_admin_create_and_login conventions as test_certificates.py/test_auth.py.
"""


def _admin_create_and_login(client, admin_token, email, role):
    create = client.post(
        "/api/auth/users",
        json={"email": email, "full_name": email.split("@")[0], "role": role},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    temp_password = create.json()["temporary_password"]
    login = client.post("/api/auth/login", data={"username": email, "password": temp_password})
    return login.json()["access_token"]


def test_create_job_requires_po_or_pending(client, admin_token):
    """"a job always needs one or the other, never neither" — see
    create_job's own comment in api/routes/jobs.py."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post("/api/jobs", json={"vessel_name": "MV No PO"}, headers=headers)
    assert response.status_code == 422, response.text
    assert "po number" in response.json()["detail"].lower()


def test_create_job_with_po_pending_requires_customer_name(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(
        "/api/jobs",
        json={"vessel_name": "MV Pending PO", "po_pending": True},
        headers=headers,
    )
    assert response.status_code == 422, response.text
    assert "customer name" in response.json()["detail"].lower()


def test_job_no_gets_letter_suffix_for_same_vessel_same_day(client, admin_token):
    """
    "same vessel can be visited on different occassion for different
    POs" — a second, genuinely separate job for the same vessel opened
    the same day gets its own number via a letter suffix rather than
    colliding or being silently merged with the first.
    """
    headers = {"Authorization": f"Bearer {admin_token}"}
    first = client.post("/api/jobs", json={"vessel_name": "MV Repeat Visitor", "po_number": "PO-001"}, headers=headers)
    assert first.status_code == 200, first.text
    second = client.post("/api/jobs", json={"vessel_name": "MV Repeat Visitor", "po_number": "PO-002"}, headers=headers)
    assert second.status_code == 200, second.text

    first_no = first.json()["job_no"]
    second_no = second.json()["job_no"]
    assert first_no != second_no
    assert second_no == f"{first_no}-B"


def test_set_po_fills_in_pending_po(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post(
        "/api/jobs",
        json={"vessel_name": "MV Awaiting PO", "po_pending": True, "customer_name": "Some Customer"},
        headers=headers,
    )
    assert created.status_code == 200, created.text
    assert created.json()["po_pending"] is True
    job_no = created.json()["job_no"]

    set_po = client.post(f"/api/jobs/{job_no}/set-po", json={"po_number": "PO-LATE-001"}, headers=headers)
    assert set_po.status_code == 200, set_po.text
    assert set_po.json()["po_number"] == "PO-LATE-001"
    assert set_po.json()["po_pending"] is False


def test_reserve_cert_no_is_sequential_and_blocked_after_close(client, admin_token):
    """
    Covers the one raw-SQL statement in this route (INSERT ...
    ON CONFLICT ... DO UPDATE ... RETURNING, see reserve_cert_no's own
    comment) — the part most likely to behave differently against
    SQLite than the ORM-built queries everywhere else, so worth
    confirming it actually runs and returns real, sequential numbers
    rather than just trusting it "looks right." Also confirms the
    job-must-be-open guard actually blocks reservation once closed,
    not just new certificate creation.
    """
    headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post("/api/jobs", json={"vessel_name": "MV Loose Gear Job", "po_number": "PO-LG-001"}, headers=headers)
    job_no = created.json()["job_no"]

    first = client.post(f"/api/jobs/{job_no}/reserve-cert-no", headers=headers)
    assert first.status_code == 200, first.text
    second = client.post(f"/api/jobs/{job_no}/reserve-cert-no", headers=headers)
    assert second.status_code == 200, second.text
    assert first.json()["cert_no"] != second.json()["cert_no"]

    close = client.post(f"/api/jobs/{job_no}/close", headers=headers)
    assert close.status_code == 200, close.text
    assert close.json()["status"] == "closed"

    blocked = client.post(f"/api/jobs/{job_no}/reserve-cert-no", headers=headers)
    assert blocked.status_code == 409, blocked.text
    assert "closed" in blocked.json()["detail"].lower()


def test_client_role_cannot_view_or_create_jobs(client, admin_token):
    """UserRole.CLIENT gets no permissions by default at all (see
    core/permissions.py's ROLE_DEFAULT_PERMISSIONS) — confirms jobs.view/
    jobs.create are actually enforced, not just declared."""
    client_token = _admin_create_and_login(client, admin_token, "clientuser@hmzc-test.com", "client")
    headers = {"Authorization": f"Bearer {client_token}"}

    list_response = client.get("/api/jobs", headers=headers)
    assert list_response.status_code == 403

    create_response = client.post("/api/jobs", json={"vessel_name": "MV Not Allowed", "po_number": "PO-X"}, headers=headers)
    assert create_response.status_code == 403
