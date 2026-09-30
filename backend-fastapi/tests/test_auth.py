"""
Not run — see conftest.py's module docstring. Written to actually
exercise the real behavior described in the code's own comments, not
just "does it return 200."
"""
import pyotp


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


def test_account_locks_after_max_failed_attempts(client, admin_token):
    """
    core/account_lockout.py's MAX_FAILED_ATTEMPTS is 5 — a different,
    per-account control from the per-IP rate limiter above (which this
    stays well under: 5 wrong attempts + 1 more login < the 10/min
    window). Once locked, even the CORRECT password is rejected with
    423, not just further wrong ones — the lock blocks the account
    outright, it doesn't just keep counting failures.
    """
    create_response = client.post(
        "/api/auth/users",
        json={"email": "getslocked@hmzc-test.com", "full_name": "Gets Locked", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    temp_password = create_response.json()["temporary_password"]

    for _ in range(5):
        response = client.post("/api/auth/login", data={"username": "getslocked@hmzc-test.com", "password": "wrongpassword"})
        assert response.status_code == 401, response.text

    locked_response = client.post("/api/auth/login", data={"username": "getslocked@hmzc-test.com", "password": temp_password})
    assert locked_response.status_code == 423, locked_response.text
    assert "locked" in locked_response.json()["detail"].lower()


def test_successful_login_resets_failed_attempts(client, admin_token):
    """A few wrong attempts (not enough to lock) shouldn't linger — a
    genuine successful login should clear the counter back to a clean
    slate, confirmed here via locked_until on the admin Users listing."""
    create_response = client.post(
        "/api/auth/users",
        json={"email": "typo@hmzc-test.com", "full_name": "Typo Prone", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    temp_password = create_response.json()["temporary_password"]

    for _ in range(3):
        client.post("/api/auth/login", data={"username": "typo@hmzc-test.com", "password": "wrongpassword"})

    success = client.post("/api/auth/login", data={"username": "typo@hmzc-test.com", "password": temp_password})
    assert success.status_code == 200, success.text

    users = client.get("/api/auth/users", headers={"Authorization": f"Bearer {admin_token}"}).json()
    this_user = next(u for u in users if u["id"] == user_id)
    assert this_user["locked_until"] is None


def test_admin_can_unlock_locked_account(client, admin_token):
    """The admin-facing complement to lockout — POST .../unlock lets a
    genuine user back in immediately instead of waiting out LOCKOUT_MINUTES."""
    create_response = client.post(
        "/api/auth/users",
        json={"email": "rescued@hmzc-test.com", "full_name": "Rescued", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    temp_password = create_response.json()["temporary_password"]

    for _ in range(5):
        client.post("/api/auth/login", data={"username": "rescued@hmzc-test.com", "password": "wrongpassword"})

    still_locked = client.post("/api/auth/login", data={"username": "rescued@hmzc-test.com", "password": temp_password})
    assert still_locked.status_code == 423, still_locked.text

    unlock_response = client.post(f"/api/auth/users/{user_id}/unlock", headers={"Authorization": f"Bearer {admin_token}"})
    assert unlock_response.status_code == 200, unlock_response.text
    assert unlock_response.json()["locked_until"] is None

    after_unlock = client.post("/api/auth/login", data={"username": "rescued@hmzc-test.com", "password": temp_password})
    assert after_unlock.status_code == 200, after_unlock.text


def test_non_admin_cannot_unlock_accounts(client, admin_token):
    create_response = client.post(
        "/api/auth/users",
        json={"email": "notyours@hmzc-test.com", "full_name": "Not Yours", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]

    sales_create = client.post(
        "/api/auth/users",
        json={"email": "salesperson2@hmzc-test.com", "full_name": "Sales", "role": "sales"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    sales_temp_password = sales_create.json()["temporary_password"]
    sales_login = client.post("/api/auth/login", data={"username": "salesperson2@hmzc-test.com", "password": sales_temp_password})
    sales_token = sales_login.json()["access_token"]

    response = client.post(f"/api/auth/users/{user_id}/unlock", headers={"Authorization": f"Bearer {sales_token}"})
    assert response.status_code == 403, response.text


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


def test_extra_permission_grants_exactly_one_capability(client, admin_token):
    """
    Requested directly, from a security review: the per-person
    extra_permissions grant (PATCH /auth/users/{id}/permissions, see
    its own comment) had no test coverage at all. UserRole.CLIENT gets
    an empty permission set by default (core/permissions.py's
    ROLE_DEFAULT_PERMISSIONS) — a clean baseline to confirm a single
    granted permission unlocks exactly that one capability and nothing
    else, not a broader "now basically an admin" effect.
    """
    create = client.post(
        "/api/auth/users",
        json={"email": "singlegrant@hmzc-test.com", "full_name": "Single Grant", "role": "client"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create.json()["user"]["id"]
    login = client.post(
        "/api/auth/login",
        data={"username": "singlegrant@hmzc-test.com", "password": create.json()["temporary_password"]},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Before any grant: blocked from both finance and certificates.
    before_finance = client.get("/api/finance/dashboard", headers=headers)
    assert before_finance.status_code == 403
    before_certs = client.get("/api/certificates", headers=headers)
    assert before_certs.status_code == 403

    grant = client.patch(
        f"/api/auth/users/{user_id}/permissions",
        json={"extra_permissions": ["finance.view"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert grant.status_code == 200, grant.text

    # The SAME token (permissions are checked live against the database
    # on every request, not baked into the JWT — see
    # get_user_permissions in core/permissions.py) now passes for
    # finance.view specifically...
    after_finance = client.get("/api/finance/dashboard", headers=headers)
    assert after_finance.status_code == 200, after_finance.text

    # ...but still gets 403 for certificates.view, which was never
    # granted — the point of this test: one specific permission, not a
    # blanket unlock.
    after_certs = client.get("/api/certificates", headers=headers)
    assert after_certs.status_code == 403


def test_granting_unknown_permission_is_rejected(client, admin_token):
    create = client.post(
        "/api/auth/users",
        json={"email": "badgrant@hmzc-test.com", "full_name": "Bad Grant", "role": "client"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create.json()["user"]["id"]
    response = client.patch(
        f"/api/auth/users/{user_id}/permissions",
        json={"extra_permissions": ["not_a_real_permission"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 400
    assert "unknown permission" in response.json()["detail"].lower()


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


# ---- Two-factor authentication (core/two_factor.py) ----

def _enable_2fa(client, token):
    """Shared setup+confirm flow — returns (secret, recovery_codes)."""
    setup = client.post("/api/auth/2fa/setup", headers={"Authorization": f"Bearer {token}"})
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    assert setup.json()["qr_code_data_uri"].startswith("data:image/png;base64,")

    code = pyotp.TOTP(secret).now()
    confirm = client.post("/api/auth/2fa/confirm", json={"code": code}, headers={"Authorization": f"Bearer {token}"})
    assert confirm.status_code == 200, confirm.text
    body = confirm.json()
    assert len(body["recovery_codes"]) == 8
    assert body["user"]["two_factor_enabled"] is True
    return secret, body["recovery_codes"]


def test_admin_requires_2fa_setup_until_enabled(admin_token, client):
    """User.requires_2fa_setup — the "soft enforcement" flag RequireAuth.tsx
    gates on. True for an admin who hasn't set 2FA up yet, False once they have."""
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert me.json()["requires_2fa_setup"] is True

    _enable_2fa(client, admin_token)

    me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert me_after.json()["requires_2fa_setup"] is False


def test_inspector_never_requires_2fa_setup(client, admin_token):
    """Only Admin/Finance are enforced — every other role's flag stays
    False regardless of two_factor_enabled."""
    response = client.post(
        "/api/auth/users",
        json={"email": "regularinspector@hmzc-test.com", "full_name": "Regular", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.json()["user"]["requires_2fa_setup"] is False


def test_2fa_confirm_sends_enabled_email(admin_token, client, monkeypatch):
    """core/email.py's send_2fa_enabled_email — a security review's
    additional-layers request: a 2FA state change should reach the
    account holder somewhere they'd actually see it. Mocked rather than
    exercised against a real SMTP server (see email.py's own comment on
    why that's untestable from here) — this checks it's called with the
    right recipient at the right point, and that its result flows into
    the response's email_sent field."""
    calls = []
    monkeypatch.setattr("app.api.routes.auth.send_2fa_enabled_email", lambda *a, **kw: calls.append((a, kw)) or True)

    setup = client.post("/api/auth/2fa/setup", headers={"Authorization": f"Bearer {admin_token}"})
    code = pyotp.TOTP(setup.json()["secret"]).now()
    confirm = client.post("/api/auth/2fa/confirm", json={"code": code}, headers={"Authorization": f"Bearer {admin_token}"})

    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["email_sent"] is True
    assert len(calls) == 1
    assert calls[0][0][0] == "admin@hmzc-test.com"


def test_2fa_self_disable_sends_disabled_email(admin_token, client, monkeypatch):
    calls = []
    monkeypatch.setattr("app.api.routes.auth.send_2fa_disabled_email", lambda *a, **kw: calls.append((a, kw)) or True)
    _enable_2fa(client, admin_token)

    response = client.post("/api/auth/2fa/disable", json={"current_password": "adminpassword123"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200, response.text
    assert len(calls) == 1
    assert calls[0][0][0] == "admin@hmzc-test.com"
    assert calls[0][1].get("by_admin") is False


def test_admin_disable_2fa_sends_disabled_email_with_by_admin_flag(admin_token, client, monkeypatch):
    """Distinguishes itself from the self-service case above — the
    recipient is the affected USER, not the admin doing the disabling,
    and by_admin=True changes the email's own wording (see
    send_2fa_disabled_email's own comment on why that distinction
    matters for someone recovering a genuinely lost device)."""
    calls = []
    monkeypatch.setattr("app.api.routes.auth.send_2fa_disabled_email", lambda *a, **kw: calls.append((a, kw)) or True)

    create_response = client.post(
        "/api/auth/users",
        json={"email": "emailtest2fa@hmzc-test.com", "full_name": "Email Test", "role": "finance"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    temp_password = create_response.json()["temporary_password"]
    login = client.post("/api/auth/login", data={"username": "emailtest2fa@hmzc-test.com", "password": temp_password})
    user_token = login.json()["access_token"]
    _enable_2fa(client, user_token)

    response = client.post(f"/api/auth/users/{user_id}/disable-2fa", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200, response.text
    assert len(calls) == 1
    assert calls[0][0][0] == "emailtest2fa@hmzc-test.com"
    assert calls[0][1].get("by_admin") is True


def test_2fa_confirm_rejects_wrong_code(admin_token, client):
    client.post("/api/auth/2fa/setup", headers={"Authorization": f"Bearer {admin_token}"})
    response = client.post("/api/auth/2fa/confirm", json={"code": "000000"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 400, response.text
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert me.json()["two_factor_enabled"] is False


def test_login_with_2fa_enabled_requires_second_step(admin_token, client):
    """The core flow: once enabled, POST /auth/login stops handing back
    a real access_token and instead returns a challenge_token, which
    only POST /auth/login/2fa (with the actual code) can exchange for
    one — matching login()'s own comment on why."""
    secret, _codes = _enable_2fa(client, admin_token)

    first_step = client.post("/api/auth/login", data={"username": "admin@hmzc-test.com", "password": "adminpassword123"})
    assert first_step.status_code == 200, first_step.text
    body = first_step.json()
    assert body["mfa_required"] is True
    assert body["access_token"] is None
    challenge_token = body["challenge_token"]
    assert challenge_token

    wrong_code = client.post("/api/auth/login/2fa", json={"challenge_token": challenge_token, "code": "000000"})
    assert wrong_code.status_code == 401, wrong_code.text

    second_step = client.post("/api/auth/login/2fa", json={"challenge_token": challenge_token, "code": pyotp.TOTP(secret).now()})
    assert second_step.status_code == 200, second_step.text
    assert second_step.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {second_step.json()['access_token']}"})
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "admin@hmzc-test.com"


def test_login_without_2fa_still_returns_token_directly(admin_token, client):
    """Backward-compat check: an account that never enabled 2FA gets the
    exact same one-step login it always did — LoginResponse's extra
    fields don't change that."""
    response = client.post("/api/auth/login", data={"username": "admin@hmzc-test.com", "password": "adminpassword123"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["mfa_required"] is False
    assert body["access_token"]


def test_2fa_recovery_code_is_single_use(admin_token, client):
    _secret, codes = _enable_2fa(client, admin_token)
    first_login = client.post("/api/auth/login", data={"username": "admin@hmzc-test.com", "password": "adminpassword123"})
    challenge_token = first_login.json()["challenge_token"]

    first_use = client.post("/api/auth/login/2fa", json={"challenge_token": challenge_token, "code": codes[0]})
    assert first_use.status_code == 200, first_use.text

    second_login = client.post("/api/auth/login", data={"username": "admin@hmzc-test.com", "password": "adminpassword123"})
    challenge_token_2 = second_login.json()["challenge_token"]
    reuse_attempt = client.post("/api/auth/login/2fa", json={"challenge_token": challenge_token_2, "code": codes[0]})
    assert reuse_attempt.status_code == 401, reuse_attempt.text


def test_2fa_self_disable_requires_correct_password(admin_token, client):
    _enable_2fa(client, admin_token)

    wrong_password = client.post("/api/auth/2fa/disable", json={"current_password": "notitspassword"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert wrong_password.status_code == 400, wrong_password.text

    correct_password = client.post("/api/auth/2fa/disable", json={"current_password": "adminpassword123"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert correct_password.status_code == 200, correct_password.text
    assert correct_password.json()["two_factor_enabled"] is False

    # Disabled — back to a normal one-step login.
    login = client.post("/api/auth/login", data={"username": "admin@hmzc-test.com", "password": "adminpassword123"})
    assert login.json()["mfa_required"] is False


def test_admin_can_disable_2fa_for_another_locked_out_user(admin_token, client):
    """The admin-assisted recovery path — someone who's lost both their
    device and every recovery code has no self-service way back in."""
    create_response = client.post(
        "/api/auth/users",
        json={"email": "lostphone@hmzc-test.com", "full_name": "Lost Phone", "role": "finance"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]
    temp_password = create_response.json()["temporary_password"]
    login = client.post("/api/auth/login", data={"username": "lostphone@hmzc-test.com", "password": temp_password})
    user_token = login.json()["access_token"]
    _enable_2fa(client, user_token)

    response = client.post(f"/api/auth/users/{user_id}/disable-2fa", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200, response.text
    assert response.json()["two_factor_enabled"] is False
    assert response.json()["requires_2fa_setup"] is True  # still a finance role — will be asked to set it up again

    login_again = client.post("/api/auth/login", data={"username": "lostphone@hmzc-test.com", "password": temp_password})
    assert login_again.json()["mfa_required"] is False


def test_non_admin_cannot_disable_2fa_for_others(admin_token, client):
    create_response = client.post(
        "/api/auth/users",
        json={"email": "target2fa@hmzc-test.com", "full_name": "Target", "role": "inspector"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_id = create_response.json()["user"]["id"]

    sales_create = client.post(
        "/api/auth/users",
        json={"email": "salesperson3@hmzc-test.com", "full_name": "Sales", "role": "sales"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    sales_login = client.post("/api/auth/login", data={"username": "salesperson3@hmzc-test.com", "password": sales_create.json()["temporary_password"]})
    sales_token = sales_login.json()["access_token"]

    response = client.post(f"/api/auth/users/{user_id}/disable-2fa", headers={"Authorization": f"Bearer {sales_token}"})
    assert response.status_code == 403, response.text
