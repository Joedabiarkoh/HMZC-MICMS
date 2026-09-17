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


def test_reset_password_revokes_already_issued_token(client, admin_token):
    """
    Requested directly, from a security review: the OLD password no
    longer logging in (test_admin_reset_password_forces_change_on_next_
    login above) isn't the same guarantee as a token issued BEFORE the
    reset stopping working — a JWT is self-contained and, before
    User.token_version existed, stayed valid until its own natural
    expiry no matter what happened to the account afterward. This
    confirms the actual gap: a token obtained under the old password
    must fail on its very next use once the account is reset, not just
    "the old password" failing at a future login attempt.
    """
    create_response = client.post(
        "/api/auth/users",
        json={"email": "tokenholder@hmzc-test.com", "full_name": "Token Holder", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    original_password = create_response.json()["temporary_password"]

    original_login = client.post("/api/auth/login", data={"username": "tokenholder@hmzc-test.com", "password": original_password})
    assert original_login.status_code == 200, original_login.text
    stolen_token = original_login.json()["access_token"]

    # The token works right now, before the reset.
    before = client.get("/api/auth/me", headers={"Authorization": f"Bearer {stolen_token}"})
    assert before.status_code == 200, before.text

    reset_response = client.post(f"/api/auth/users/{user_id}/reset-password", headers={"Authorization": f"Bearer {admin_token}"})
    assert reset_response.status_code == 200, reset_response.text

    # The same token — never re-issued, never told about the reset —
    # must now be rejected rather than remaining valid until it expires.
    after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {stolen_token}"})
    assert after.status_code == 401, after.text


def test_deactivate_revokes_already_issued_token(client, admin_token):
    """
    Same gap as above, for the scenario deactivate actually exists for:
    an admin discovers a compromised or departing account and needs it
    locked out immediately, not just blocked from a fresh login.
    """
    create_response = client.post(
        "/api/auth/users",
        json={"email": "compromised@hmzc-test.com", "full_name": "Compromised", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    temp_password = create_response.json()["temporary_password"]

    login = client.post("/api/auth/login", data={"username": "compromised@hmzc-test.com", "password": temp_password})
    assert login.status_code == 200, login.text
    active_token = login.json()["access_token"]

    deactivate_response = client.post(f"/api/auth/users/{user_id}/deactivate", headers={"Authorization": f"Bearer {admin_token}"})
    assert deactivate_response.status_code == 200, deactivate_response.text

    after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {active_token}"})
    assert after.status_code == 401, after.text


def test_change_password_revokes_previous_token(client):
    """
    The self-service counterpart — changing your own password (e.g.
    because you suspect a device or token was compromised) should
    actually revoke whatever token was issued under the old password,
    not just update the stored hash. The frontend's own 401 handling
    (api/axios.ts's response interceptor) treats this as an expired
    session and bounces to sign-in, which is the intended UX, not a bug.
    """
    client.post(
        "/api/auth/register",
        json={"email": "selfchanger@hmzc-test.com", "password": "originalpass123", "full_name": "Self Changer", "role": "inspector"},
    )
    login = client.post("/api/auth/login", data={"username": "selfchanger@hmzc-test.com", "password": "originalpass123"})
    old_token = login.json()["access_token"]

    change_response = client.post(
        "/api/auth/change-password",
        json={"current_password": "originalpass123", "new_password": "brandnewpass456"},
        headers={"Authorization": f"Bearer {old_token}"},
    )
    assert change_response.status_code == 200, change_response.text

    # The old token — the one used to make the change-password request
    # itself — must fail on the next request after the change.
    after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert after.status_code == 401, after.text

    # A fresh login with the new password still works normally.
    new_login = client.post("/api/auth/login", data={"username": "selfchanger@hmzc-test.com", "password": "brandnewpass456"})
    assert new_login.status_code == 200, new_login.text


def test_logout_everywhere_revokes_current_token(client):
    """
    Requested directly, from the same security review — self-service:
    "sign out of every device" for someone who suspects a token leaked
    but doesn't necessarily want to also change their password.
    """
    client.post(
        "/api/auth/register",
        json={"email": "paranoid@hmzc-test.com", "password": "password123", "full_name": "Paranoid", "role": "inspector"},
    )
    login = client.post("/api/auth/login", data={"username": "paranoid@hmzc-test.com", "password": "password123"})
    token = login.json()["access_token"]

    logout_response = client.post("/api/auth/logout-everywhere", headers={"Authorization": f"Bearer {token}"})
    assert logout_response.status_code == 200, logout_response.text

    after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert after.status_code == 401, after.text

    # The account itself is untouched — a fresh login still works.
    relogin = client.post("/api/auth/login", data={"username": "paranoid@hmzc-test.com", "password": "password123"})
    assert relogin.status_code == 200, relogin.text


# 1x1 transparent PNG, base64-encoded — smallest possible valid image for
# exercising the data-URI decode path without shipping a real signature.
_TINY_PNG_DATA_URI = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def test_saved_signature_persists_and_is_reused(client, admin_token):
    """
    Requested directly: a user saves their signature once (PUT
    /auth/me/signature) and it should come back on every subsequent
    /auth/me — the frontend auto-fill (useInspections.ts) relies on this
    being present without the user having to redraw it.
    """
    save_response = client.put(
        "/api/auth/me/signature",
        json={"signature": _TINY_PNG_DATA_URI},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert save_response.status_code == 200, save_response.text
    saved_url = save_response.json()["saved_signature_url"]
    assert saved_url  # a real URL was written, not left null
    assert "/api/photos/" in saved_url

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert me.json()["saved_signature_url"] == saved_url


def test_deleting_saved_signature_clears_it(client, admin_token):
    client.put(
        "/api/auth/me/signature",
        json={"signature": _TINY_PNG_DATA_URI},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    delete_response = client.delete("/api/auth/me/signature", headers={"Authorization": f"Bearer {admin_token}"})
    assert delete_response.status_code == 200, delete_response.text
    assert delete_response.json()["saved_signature_url"] is None

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert me.json()["saved_signature_url"] is None
