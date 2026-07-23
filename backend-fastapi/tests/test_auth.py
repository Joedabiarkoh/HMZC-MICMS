"""
Not run — see conftest.py's module docstring. Written to actually
exercise the real behavior described in the code's own comments, not
just "does it return 200."
"""


def test_first_account_is_auto_activated_admin(client):
    """The bootstrap case in register_user — see its comment on why this exists."""
    response = client.post(
        "/api/auth/register",
        json={"email": "first@hmzc-test.com", "password": "password123", "full_name": "First User", "role": "client"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["is_active"] is True
    assert body["role"] == "admin"  # promoted regardless of the "client" role requested


def test_second_self_registration_is_blocked(client):
    """
    Was test_second_account_starts_inactive, testing behavior that no
    longer exists: self-registration for any account past the first is
    now rejected outright (see register_user's is_first_user check),
    not created-but-inactive. That changed later in this project's
    build-out (see the root README's "Admin-only account creation"
    section) — the test was never updated to match, and would have kept
    "passing" only because the whole suite never actually ran until now.
    """
    client.post(
        "/api/auth/register",
        json={"email": "first@hmzc-test.com", "password": "password123", "full_name": "First", "role": "inspector"},
    )
    response = client.post(
        "/api/auth/register",
        json={"email": "second@hmzc-test.com", "password": "password123", "full_name": "Second", "role": "inspector"},
    )
    assert response.status_code == 403, response.text
    assert "administrator" in response.json()["detail"].lower()


def test_deactivated_account_cannot_log_in(client, admin_token):
    """
    Was test_inactive_account_cannot_log_in, which relied on
    self-registration producing a pending (is_active=False) account —
    no longer reachable at all (see the test above). The one real,
    current path to an inactive account is an admin deactivating one
    that was already active — see deactivate_user in api/routes/auth.py.
    """
    create_response = client.post(
        "/api/auth/users",
        json={"email": "wastoggled@hmzc-test.com", "full_name": "Was Toggled", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    temp_password = create_response.json()["temporary_password"]

    deactivate_response = client.post(
        f"/api/auth/users/{user_id}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert deactivate_response.status_code == 200, deactivate_response.text
    assert deactivate_response.json()["is_active"] is False

    response = client.post(
        "/api/auth/login",
        data={"username": "wastoggled@hmzc-test.com", "password": temp_password},
    )
    assert response.status_code == 400
    assert "pending" in response.json()["detail"].lower() or "deactivated" in response.json()["detail"].lower()


def test_wrong_password_rejected(client):
    client.post(
        "/api/auth/register",
        json={"email": "first@hmzc-test.com", "password": "correctpassword", "full_name": "First", "role": "inspector"},
    )
    response = client.post(
        "/api/auth/login",
        data={"username": "first@hmzc-test.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_duplicate_email_rejected(client, admin_token):
    """
    Was two self-registration calls with the same payload — the second
    call now 403s for an unrelated reason (self-registration is blocked
    entirely past the first account, regardless of email), not the 400
    "already registered" this test actually means to check. Duplicate-
    email rejection is still real, just only reachable through the
    admin-create endpoint now that self-registration for a second
    account doesn't get far enough to check the email at all.
    """
    payload = {"email": "dupe@hmzc-test.com", "full_name": "Dupe", "role": "inspector"}
    first = client.post("/api/auth/users", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert first.status_code == 201, first.text
    second = client.post("/api/auth/users", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert second.status_code == 400
    assert "already registered" in second.json()["detail"].lower()


def test_login_rate_limited_after_repeated_attempts(client):
    """
    core/rate_limit.py's MAX_ATTEMPTS_PER_WINDOW is 10 — the 11th
    request within the window should be rejected with 429, regardless
    of whether the credentials are even valid, since the limiter runs
    before the credential check.
    """
    for _ in range(10):
        client.post("/api/auth/login", data={"username": "nobody@hmzc-test.com", "password": "wrong"})
    response = client.post("/api/auth/login", data={"username": "nobody@hmzc-test.com", "password": "wrong"})
    assert response.status_code == 429


def test_admin_can_reactivate_deactivated_account(client, admin_token):
    """
    Was test_admin_can_approve_pending_account, built on a self-
    registered pending account — no longer reachable (see
    test_second_self_registration_is_blocked above). /approve's real,
    current job is reactivating an account an admin previously
    deactivated, not admitting a new signup — same endpoint, the
    reachable path to it changed.
    """
    create_response = client.post(
        "/api/auth/users",
        json={"email": "newperson@hmzc-test.com", "full_name": "New Person", "role": "sales"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    assert create_response.json()["user"]["is_active"] is True  # admin-created accounts start active

    client.post(f"/api/auth/users/{user_id}/deactivate", headers={"Authorization": f"Bearer {admin_token}"})

    approve_response = client.post(
        f"/api/auth/users/{user_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve_response.status_code == 200, approve_response.text
    assert approve_response.json()["is_active"] is True


def test_non_admin_cannot_approve_accounts(client, admin_token):
    # A non-admin (Sales, in this case) trying to approve someone else
    # should be rejected — approve_user requires get_current_admin_user.
    # Both accounts are admin-created (active immediately) rather than
    # self-registered, since self-registration past the first account
    # is blocked entirely now.
    sales_create = client.post(
        "/api/auth/users",
        json={"email": "salesperson@hmzc-test.com", "full_name": "Sales Person", "role": "sales"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    sales_temp_password = sales_create.json()["temporary_password"]

    login = client.post("/api/auth/login", data={"username": "salesperson@hmzc-test.com", "password": sales_temp_password})
    assert login.status_code == 200, login.text
    sales_token = login.json()["access_token"]

    another = client.post(
        "/api/auth/users",
        json={"email": "yetanother@hmzc-test.com", "full_name": "Yet Another", "role": "sales"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    another_id = another.json()["user"]["id"]
    client.post(f"/api/auth/users/{another_id}/deactivate", headers={"Authorization": f"Bearer {admin_token}"})

    response = client.post(
        f"/api/auth/users/{another_id}/approve",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 403


def test_admin_reset_password_forces_change_on_next_login(client, admin_token):
    """
    Was a self-registration + approve — replaced with a single
    admin-create call (self-registration for a second account is
    blocked, and admin-created accounts start active, so there's
    nothing left to approve first).
    """
    create_response = client.post(
        "/api/auth/users",
        json={"email": "forgetful@hmzc-test.com", "full_name": "Forgetful", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    original_password = create_response.json()["temporary_password"]

    # Sanity-check the account can actually log in with its first
    # temporary password before resetting it — otherwise "the old
    # password no longer works" below wouldn't be testing anything.
    original_login = client.post("/api/auth/login", data={"username": "forgetful@hmzc-test.com", "password": original_password})
    assert original_login.status_code == 200, original_login.text

    reset_response = client.post(
        f"/api/auth/users/{user_id}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reset_response.status_code == 200, reset_response.text
    temp_password = reset_response.json()["temporary_password"]
    assert temp_password  # a real value was actually generated, not empty

    # The old (first temporary) password should no longer work.
    old_login = client.post("/api/auth/login", data={"username": "forgetful@hmzc-test.com", "password": original_password})
    assert old_login.status_code == 401

    # The temporary password should work, and the account should be
    # flagged to force a change.
    new_login = client.post("/api/auth/login", data={"username": "forgetful@hmzc-test.com", "password": temp_password})
    assert new_login.status_code == 200
    token = new_login.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["must_change_password"] is True
