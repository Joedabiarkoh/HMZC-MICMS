"""
Not run — see conftest.py's module docstring. Written to actually
exercise the real behavior described in the code's own comments, not
just "does it return 200."
"""


def test_first_account_is_auto_activated_admin(client):
    """The bootstrap case in register_user — see its comment on why this exists."""
    response = client.post(
        "/api/auth/register",
        json={"email": "first@hmzc.test", "password": "password123", "full_name": "First User", "role": "client"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["is_active"] is True
    assert body["role"] == "admin"  # promoted regardless of the "client" role requested


def test_second_account_starts_inactive(client):
    client.post(
        "/api/auth/register",
        json={"email": "first@hmzc.test", "password": "password123", "full_name": "First", "role": "inspector"},
    )
    response = client.post(
        "/api/auth/register",
        json={"email": "second@hmzc.test", "password": "password123", "full_name": "Second", "role": "inspector"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["is_active"] is False
    assert body["role"] == "inspector"  # not promoted — only the first account is


def test_inactive_account_cannot_log_in(client):
    client.post(
        "/api/auth/register",
        json={"email": "first@hmzc.test", "password": "password123", "full_name": "First", "role": "inspector"},
    )
    client.post(
        "/api/auth/register",
        json={"email": "pending@hmzc.test", "password": "password123", "full_name": "Pending", "role": "inspector"},
    )
    response = client.post(
        "/api/auth/login",
        data={"username": "pending@hmzc.test", "password": "password123"},
    )
    assert response.status_code == 400
    assert "pending" in response.json()["detail"].lower() or "deactivated" in response.json()["detail"].lower()


def test_wrong_password_rejected(client):
    client.post(
        "/api/auth/register",
        json={"email": "first@hmzc.test", "password": "correctpassword", "full_name": "First", "role": "inspector"},
    )
    response = client.post(
        "/api/auth/login",
        data={"username": "first@hmzc.test", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_duplicate_email_rejected(client):
    payload = {"email": "dupe@hmzc.test", "password": "password123", "full_name": "Dupe", "role": "inspector"}
    first = client.post("/api/auth/register", json=payload)
    assert first.status_code == 201
    second = client.post("/api/auth/register", json=payload)
    assert second.status_code == 400


def test_login_rate_limited_after_repeated_attempts(client):
    """
    core/rate_limit.py's MAX_ATTEMPTS_PER_WINDOW is 10 — the 11th
    request within the window should be rejected with 429, regardless
    of whether the credentials are even valid, since the limiter runs
    before the credential check.
    """
    for _ in range(10):
        client.post("/api/auth/login", data={"username": "nobody@hmzc.test", "password": "wrong"})
    response = client.post("/api/auth/login", data={"username": "nobody@hmzc.test", "password": "wrong"})
    assert response.status_code == 429


def test_admin_can_approve_pending_account(client, admin_token):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "newperson@hmzc.test", "password": "password123", "full_name": "New Person", "role": "sales"},
    )
    user_id = register_response.json()["id"]
    assert register_response.json()["is_active"] is False

    approve_response = client.post(
        f"/api/auth/users/{user_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve_response.status_code == 200, approve_response.text
    assert approve_response.json()["is_active"] is True


def test_non_admin_cannot_approve_accounts(client, admin_token):
    # A non-admin (Sales, in this case) trying to approve someone else
    # should be rejected — approve_user requires get_current_admin_user.
    client.post(
        "/api/auth/register",
        json={"email": "salesperson@hmzc.test", "password": "password123", "full_name": "Sales Person", "role": "sales"},
    )
    # Promote sales person to active via admin so they can log in and try.
    users = client.get("/api/auth/users", headers={"Authorization": f"Bearer {admin_token}"}).json()
    sales_id = next(u["id"] for u in users if u["email"] == "salesperson@hmzc.test")
    client.post(f"/api/auth/users/{sales_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    login = client.post("/api/auth/login", data={"username": "salesperson@hmzc.test", "password": "password123"})
    sales_token = login.json()["access_token"]

    another = client.post(
        "/api/auth/register",
        json={"email": "yetanother@hmzc.test", "password": "password123", "full_name": "Yet Another", "role": "sales"},
    )
    response = client.post(
        f"/api/auth/users/{another.json()['id']}/approve",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 403


def test_admin_reset_password_forces_change_on_next_login(client, admin_token):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "forgetful@hmzc.test", "password": "originalpassword", "full_name": "Forgetful", "role": "inspector"},
    )
    user_id = register_response.json()["id"]
    client.post(f"/api/auth/users/{user_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    reset_response = client.post(
        f"/api/auth/users/{user_id}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reset_response.status_code == 200, reset_response.text
    temp_password = reset_response.json()["temporary_password"]
    assert temp_password  # a real value was actually generated, not empty

    # The old password should no longer work.
    old_login = client.post("/api/auth/login", data={"username": "forgetful@hmzc.test", "password": "originalpassword"})
    assert old_login.status_code == 401

    # The temporary password should work, and the account should be
    # flagged to force a change.
    new_login = client.post("/api/auth/login", data={"username": "forgetful@hmzc.test", "password": temp_password})
    assert new_login.status_code == 200
    token = new_login.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["must_change_password"] is True
