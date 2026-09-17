"""
Requested directly, from a security review: settings.py had zero test
coverage despite gating who can see/change company-wide configuration
(expiry-reminder recipients, PEPPOL ID, bank details printed on real
invoices). Follows test_certificates.py/test_auth.py's conventions.
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


def test_expiry_reminder_emails_admin_only(client, admin_token):
    non_admin_token = _admin_create_and_login(client, admin_token, "notanadmin@hmzc-test.com", "inspector")
    headers = {"Authorization": f"Bearer {non_admin_token}"}

    get_response = client.get("/api/settings/expiry-reminder-emails", headers=headers)
    assert get_response.status_code == 403

    put_response = client.put(
        "/api/settings/expiry-reminder-emails",
        json={"emails": ["someone@hmzc.com"]},
        headers=headers,
    )
    assert put_response.status_code == 403


def test_update_and_read_expiry_reminder_emails_roundtrip(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_response = client.put(
        "/api/settings/expiry-reminder-emails",
        json={"emails": ["ops@hmzc.com", "admin@hmzc.com"]},
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text
    assert sorted(update_response.json()["emails"]) == ["admin@hmzc.com", "ops@hmzc.com"]

    read_response = client.get("/api/settings/expiry-reminder-emails", headers=headers)
    assert sorted(read_response.json()["emails"]) == ["admin@hmzc.com", "ops@hmzc.com"]

    # "An empty list is a valid save: it turns the reminder feature
    # back off" — see update_expiry_reminder_emails' own comment.
    cleared = client.put("/api/settings/expiry-reminder-emails", json={"emails": []}, headers=headers)
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["emails"] == []


def test_company_info_readable_by_any_signed_in_user_but_not_editable(client, admin_token):
    """
    "Read is any signed-in user (Finance/Sales staff print these
    documents daily, not just admins); write stays admin-only" — see
    the module's own top comment in api/routes/settings.py.
    """
    sales_token = _admin_create_and_login(client, admin_token, "salesperson@hmzc-test.com", "sales")
    headers = {"Authorization": f"Bearer {sales_token}"}

    read_response = client.get("/api/settings/company-info", headers=headers)
    assert read_response.status_code == 200, read_response.text

    write_response = client.put(
        "/api/settings/company-info",
        json={"peppol_id": "should-not-be-allowed"},
        headers=headers,
    )
    assert write_response.status_code == 403


def test_update_company_info_roundtrip(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_response = client.put(
        "/api/settings/company-info",
        json={
            "peppol_id": "0208:1234567890",
            "bank_name": "Test Bank",
            "bank_iban": "AO06000600000100037131174",
        },
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["peppol_id"] == "0208:1234567890"
    assert update_response.json()["bank_name"] == "Test Bank"

    read_response = client.get("/api/settings/company-info", headers=headers)
    assert read_response.json()["bank_iban"] == "AO06000600000100037131174"
