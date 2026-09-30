from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_user
from app.core.account_lockout import is_locked, lock_remaining_seconds, register_failed_attempt, reset_failed_attempts, unlock_account
from app.core.audit import record_audit
from app.core.database import get_database
from app.core.email import send_account_created_email, send_password_reset_email
from app.core.config import settings
from app.core.permissions import ALL_PERMISSIONS
from app.core.photo_storage import delete_photo_files, externalize_signature, collect_photo_filenames, filter_deletable
from app.core.rate_limit import check_rate_limit
from app.core.security import create_access_token, generate_temporary_password, hash_password, verify_password
from app.core.two_factor import consume_recovery_code, generate_recovery_codes, generate_secret, looks_like_totp_code, provisioning_qr_data_uri, verify_totp_code
from app.models.audit_log import AuditLog
from app.models.certificate import Certificate
from app.models.finance_document import Invoice, Quotation
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogResponse
from app.schemas.user import AdminCreateUser, AdminUpdateProfile, ForgotPasswordRequest, LoginResponse, PasswordChange, PasswordResetResult, PermissionUpdate, SignatureUpdate, Token, TwoFactorConfirmRequest, TwoFactorConfirmResult, TwoFactorDisableRequest, TwoFactorSetupResult, TwoFactorVerify, UserCreate, UserResponse

# 5 minutes — long enough to switch to an authenticator app and type a
# code, short enough that a leaked/logged challenge_token (e.g. in a
# browser history or a proxy log) is worthless well before someone could
# realistically reuse it. Separate constant from ACCESS_TOKEN_EXPIRE_MINUTES
# on purpose — this is a pending-credential token, not a session one.
MFA_CHALLENGE_EXPIRE_MINUTES = 5

# Transcribed from the pasted Module 2 chat output (app/api/v1/auth.py),
# adapted to match what already existed in this project:
#   - Moved from app/api/v1/auth.py to app/api/routes/auth.py, matching
#     the existing routes/ convention (see health.py) instead of adding a
#     one-off v1/ package for a single file.
#   - No prefix set here — main.py mounts it at "/api/auth" itself,
#     the same way it already mounts health.router at "/api".
#   - get_password_hash -> hash_password, and create_access_token now
#     takes a dict ({"sub": ...}) instead of (subject, expires_delta),
#     matching the create_access_token already in app/core/security.py
#     rather than the differently-shaped one pasted in the chat (which
#     would have duplicated/conflicted with it).
router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, request: Request, db: Session = Depends(get_database)):
    check_rate_limit(request, "register")

    # Requested directly: "I want only the admin to create the
    # account" — self-service sign-up is now blocked entirely, except
    # for the very first account ever created. With zero users in the
    # database there's no admin to create one, so that one case still
    # has to self-register to bootstrap the system at all; every
    # account after it must come from POST /auth/users (create_user,
    # below), not this endpoint. Left in place (not deleted) purely for
    # that bootstrap case — a fresh install with nobody in it yet.
    is_first_user = db.query(User).count() == 0
    if not is_first_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration is disabled. Contact your administrator to have an account created for you.",
        )

    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )

    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# The actual replacement for self-service sign-up: an admin creates the
# account directly, active immediately (no approval queue needed — the
# admin creating it *is* the approval), with a generated temporary
# password the person must change the moment they sign in with it (same
# must_change_password mechanism as reset_user_password below). Emails
# the temporary password and a sign-in link if SMTP is configured (see
# core/email.py); either way, the password is also returned in the
# response so the admin can relay it manually if email isn't set up yet
# or the send fails — account creation was never designed to be
# blocked by whether email happens to be configured.
@router.post("/users", response_model=PasswordResetResult, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: AdminCreateUser,
    request: Request,
    db: Session = Depends(get_database),
    admin: User = Depends(get_current_admin_user),
):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email address already registered")

    temp_password = generate_temporary_password()
    user = User(
        email=user_in.email,
        hashed_password=hash_password(temp_password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    email_sent = send_account_created_email(
        to_email=user.email,
        full_name=user.full_name or "",
        temporary_password=temp_password,
        login_url=f"{settings.FRONTEND_URL}/signin",
    )

    record_audit(
        db, request, "user.created_by_admin", user_id=admin.id, resource_type="user", resource_id=str(user.id),
        detail=f"role={user.role}, email_sent={email_sent}",
    )
    return PasswordResetResult(temporary_password=temp_password, user=user, email_sent=email_sent)


@router.post("/login", response_model=LoginResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_database),
):
    check_rate_limit(request, "login")
    # OAuth2PasswordRequestForm's "username" field carries the email —
    # this project logs in by email, not a separate username.
    user = db.query(User).filter(User.email == form_data.username).first()

    # Checked before verifying the password: a locked account should be
    # rejected outright, not re-hashed/re-checked against on every retry
    # while it's locked (see core/account_lockout.py — this is a
    # different, per-account control from check_rate_limit's per-IP
    # one). Only reachable for an account that actually exists, so this
    # inevitably reveals that the account exists — the same accepted
    # tradeoff every mainstream login form (GitHub, Google, etc.) makes;
    # the wrong-password branch below stays deliberately generic so it
    # doesn't ALSO become an enumeration channel.
    if user and is_locked(user):
        minutes_left = max(1, lock_remaining_seconds(user) // 60 + 1)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"This account is temporarily locked after too many failed sign-in attempts. Try again in about {minutes_left} minute{'s' if minutes_left != 1 else ''}, or contact an administrator to unlock it now.",
        )

    if not user or not verify_password(form_data.password, user.hashed_password):
        if user:
            register_failed_attempt(db, user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is pending administrator approval, or has been deactivated. Contact an administrator.",
        )

    reset_failed_attempts(db, user)

    # The password alone was correct, but this account also needs a
    # second factor — don't issue a real access_token yet. Instead hand
    # back a short-lived challenge_token proving "this request already
    # supplied the right password," which POST /auth/login/2fa exchanges
    # for the real token once the actual TOTP/recovery code checks out.
    if user.two_factor_enabled:
        challenge_token = create_access_token({"sub": str(user.id), "mfa_challenge": True}, expires_minutes=MFA_CHALLENGE_EXPIRE_MINUTES)
        return LoginResponse(mfa_required=True, challenge_token=challenge_token)

    access_token = create_access_token({"sub": str(user.id), "tv": user.token_version})
    # Not in the pasted chat output — a login is one of the few events
    # worth a real audit trail entry on a certification platform (see
    # app/core/audit.py for what's scoped in vs deliberately left out).
    record_audit(db, request, "login", user_id=user.id, resource_type="user", resource_id=str(user.id))
    return LoginResponse(access_token=access_token, token_type="bearer")


# The second step of a 2FA login (see login()'s own comment) — separate
# from get_current_user's own JWT check (app/api/deps.py) since a
# challenge_token is deliberately a different, narrower kind of token:
# it carries no "tv" claim and isn't checked against token_version, only
# its own mfa_challenge claim and its own short expiry.
@router.post("/login/2fa", response_model=Token)
def verify_two_factor(
    payload: TwoFactorVerify,
    request: Request,
    db: Session = Depends(get_database),
):
    check_rate_limit(request, "2fa")
    try:
        claims = jwt.decode(payload.challenge_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if not claims.get("mfa_challenge"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired sign-in session. Please sign in again.")
        user_id = int(claims["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired sign-in session. Please sign in again.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.two_factor_enabled or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired sign-in session. Please sign in again.")

    verified = False
    if looks_like_totp_code(payload.code):
        verified = verify_totp_code(user.totp_secret, payload.code)
    if not verified:
        remaining = consume_recovery_code(user.totp_recovery_codes, payload.code)
        if remaining is not None:
            user.totp_recovery_codes = remaining
            db.commit()
            verified = True

    if not verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect authentication code.")

    access_token = create_access_token({"sub": str(user.id), "tv": user.token_version})
    record_audit(db, request, "login", user_id=user.id, resource_type="user", resource_id=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}


# ---- TOTP two-factor enrollment (self-service) ----

@router.post("/2fa/setup", response_model=TwoFactorSetupResult)
def setup_two_factor(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
):
    if current_user.two_factor_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Two-factor authentication is already enabled on this account. Disable it first to set up a new device.")
    secret = generate_secret()
    current_user.totp_secret = secret
    db.commit()
    return TwoFactorSetupResult(secret=secret, qr_code_data_uri=provisioning_qr_data_uri(secret, current_user.email))


@router.post("/2fa/confirm", response_model=TwoFactorConfirmResult)
def confirm_two_factor(
    payload: TwoFactorConfirmRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
):
    if current_user.two_factor_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Two-factor authentication is already enabled on this account.")
    if not current_user.totp_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start setup first — call /auth/2fa/setup to get a code to scan.")
    if not verify_totp_code(current_user.totp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code didn't match. Check your authenticator app and try again.")

    plaintext_codes, hashed_codes = generate_recovery_codes()
    current_user.two_factor_enabled = True
    current_user.totp_recovery_codes = hashed_codes
    db.commit()
    db.refresh(current_user)
    record_audit(db, request, "user.2fa_enabled", user_id=current_user.id, resource_type="user", resource_id=str(current_user.id))
    return TwoFactorConfirmResult(recovery_codes=plaintext_codes, user=current_user)


# Requested directly, alongside enforcing 2FA for Admin/Finance: a
# self-service off switch still needs to exist (someone changing
# authenticator apps, or genuinely done needing it on a role where it's
# only recommended, not required) — gated on the current password (not
# just an active session) so a stolen/left-open browser tab can't
# silently strip an account's second factor on its own.
@router.post("/2fa/disable", response_model=UserResponse)
def disable_two_factor(
    payload: TwoFactorDisableRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.two_factor_enabled = False
    current_user.totp_secret = None
    current_user.totp_recovery_codes = []
    db.commit()
    db.refresh(current_user)
    record_audit(db, request, "user.2fa_disabled", user_id=current_user.id, resource_type="user", resource_id=str(current_user.id))
    return current_user


# The admin-assisted recovery path — mirrors reset_user_password's own
# reasoning: someone who's lost both their authenticator device AND
# every recovery code has no self-service way back in (2FA has no
# "forgot my code" equivalent by design), so an admin who can otherwise
# vouch for their identity needs a way to clear it. Requires re-setup
# from scratch afterward (see requires_2fa_setup) if their role still
# needs it.
@router.post("/users/{user_id}/disable-2fa", response_model=UserResponse)
def admin_disable_two_factor(
    user_id: int,
    request: Request,
    db: Session = Depends(get_database),
    admin: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.two_factor_enabled = False
    user.totp_secret = None
    user.totp_recovery_codes = []
    db.commit()
    db.refresh(user)
    record_audit(db, request, "user.2fa_disabled_by_admin", user_id=admin.id, resource_type="user", resource_id=str(user.id))
    return user


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


# Requested directly: "let allow for each account user be able to load
# their signature and use it on all certificate they will issue so they
# will not need to sign one after the other." Self-service, not
# admin-gated — this is a personal default the signer controls, same as
# choosing what to draw on any single certificate today. Overwrites
# whatever was saved before (a new drawing replaces the old one) and
# cleans up the old file so signature images don't pile up unused.
@router.put("/me/signature", response_model=UserResponse)
def save_my_signature(
    payload: SignatureUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
):
    old_url = current_user.saved_signature_url
    current_user.saved_signature_url = externalize_signature(payload.signature, current_user.email)
    db.commit()
    db.refresh(current_user)
    if old_url:
        deletable = filter_deletable(db, collect_photo_filenames(old_url))
        if deletable:
            delete_photo_files(deletable)
    return current_user


@router.delete("/me/signature", response_model=UserResponse)
def delete_my_signature(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
):
    old_url = current_user.saved_signature_url
    current_user.saved_signature_url = None
    db.commit()
    db.refresh(current_user)
    if old_url:
        deletable = filter_deletable(db, collect_photo_filenames(old_url))
        if deletable:
            delete_photo_files(deletable)
    return current_user


# Not in the pasted chat output — added for the requested admin visibility:
# "admin must be able to know number of people who have signed up and who
# are working on certificates at each level." Certificates now have a
# real backend table with issued_by_id -> users.id (see
# app/models/certificate.py), so this and that both answer real,
# queryable questions rather than one of them being a localStorage-only
# approximation.
@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    return db.query(User).order_by(User.created_at.desc()).all()


# Not in the pasted chat output — added so an admin can promote another
# account (e.g. after reviewing a new sign-up) without needing direct
# database access. Referenced from the sign-up page's "not self-service"
# note on the frontend.
@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    new_role: str,
    request: Request,
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    if new_role not in UserRole._value2member_map_:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    old_role = user.role
    user.role = UserRole(new_role)
    db.commit()
    db.refresh(user)
    # Role changes are the other event worth auditing directly — who
    # granted (or revoked) elevated access, and when.
    record_audit(
        db, request, "user.role_change", user_id=_admin.id, resource_type="user", resource_id=str(user.id),
        detail=f"{old_role} -> {new_role} (by admin id {_admin.id})",
    )
    return user


# Requested directly: "let admin be able to work on the profile and
# make changes in how the account name for users or email changes" —
# correcting a typo'd name or an out-of-date email, the same kind of
# direct-database-access-avoiding fix update_user_role above exists
# for. Both fields optional (see AdminUpdateProfile) so a request only
# touching one doesn't have to resend the other unchanged.
@router.patch("/users/{user_id}/profile", response_model=UserResponse)
def update_user_profile(
    user_id: int,
    payload: AdminUpdateProfile,
    request: Request,
    db: Session = Depends(get_database),
    admin: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    changes = []
    if payload.email is not None and payload.email != user.email:
        existing = db.query(User).filter(User.email == payload.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email address already registered")
        changes.append(f"email: {user.email} -> {payload.email}")
        user.email = payload.email
    if payload.full_name is not None and payload.full_name != user.full_name:
        changes.append(f"full_name: {user.full_name!r} -> {payload.full_name!r}")
        user.full_name = payload.full_name

    if changes:
        db.commit()
        db.refresh(user)
        record_audit(
            db, request, "user.profile_update", user_id=admin.id, resource_type="user", resource_id=str(user.id),
            detail="; ".join(changes),
        )
    return user


# Not in the pasted chat output — a place to actually read the audit
# trail written by record_audit (app/core/audit.py), otherwise it's
# write-only data no one can see. No dedicated frontend page for this
# yet (see the README) — reachable via /docs for now, or build a page
# against this the same way AdminUsers.tsx was built against /users.
@router.get("/audit-log", response_model=List[AuditLogResponse])
def list_audit_log(
    limit: int = 100,
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    from sqlalchemy.orm import joinedload

    return (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )


# ============================================================
# Account approval — new accounts start inactive (see models/user.py);
# an admin has to explicitly let someone in before they can sign in.
# ============================================================

@router.post("/users/{user_id}/approve", response_model=UserResponse)
def approve_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    record_audit(db, request, "user.approved", user_id=_admin.id, resource_type="user", resource_id=str(user.id))
    return user


# The natural complement to approve — suspend an account that already
# had access (someone leaving, a mistaken sign-up, etc.) without
# deleting their history of issued certificates/invoices, which still
# need to point at a real user row.
@router.post("/users/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't deactivate your own account.")
    user.is_active = False
    # Requested directly, from a security review: deactivating used to
    # only block a NEW login — a token issued before the deactivation
    # stayed valid until its own natural expiry regardless. Bumping
    # token_version (see its own comment on User) makes an already-
    # issued token stop working on this account's very next request,
    # which matters most for exactly the scenario deactivate exists
    # for: an admin has just discovered a compromised or departing
    # account and wants it locked out NOW, not in up to
    # ACCESS_TOKEN_EXPIRE_MINUTES.
    user.token_version += 1
    db.commit()
    db.refresh(user)
    record_audit(db, request, "user.deactivated", user_id=_admin.id, resource_type="user", resource_id=str(user.id))
    return user


# The admin-facing complement to account lockout (core/account_lockout.py):
# a genuine user who trips MAX_FAILED_ATTEMPTS shouldn't have to just
# wait out LOCKOUT_MINUTES if an admin is available to vouch for them
# right now.
@router.post("/users/{user_id}/unlock", response_model=UserResponse)
def unlock_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    unlock_account(db, user)
    record_audit(db, request, "user.unlocked", user_id=_admin.id, resource_type="user", resource_id=str(user.id))
    return user


# Deactivate only suspends sign-in; it doesn't remove the account.
# Requested directly: admin needs to actually delete a user, not just
# activate/deactivate. A hard delete is only safe when nothing else in
# the database points at this row — certificates.issued_by_id and
# quotations/invoices.issued_by_id are real foreign keys with no
# ON DELETE clause, and deliberately so (see the Certificate/finance
# models' own comments: "issued_by is set once... doesn't change" —
# losing that provenance on a real certificate or invoice would be a
# worse outcome than just refusing the delete). So: block the delete
# and point the admin at deactivate instead if this account has ever
# issued a certificate, quotation, or invoice. Audit log rows are the
# one exception — user_id there is nullable specifically so a deleted
# account's past actions can stay in the log without still pointing at
# a row that no longer exists.
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't delete your own account.")

    has_certificates = db.query(Certificate).filter(Certificate.issued_by_id == user.id).first() is not None
    has_quotations = db.query(Quotation).filter(Quotation.issued_by_id == user.id).first() is not None
    has_invoices = db.query(Invoice).filter(Invoice.issued_by_id == user.id).first() is not None
    if has_certificates or has_quotations or has_invoices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has issued certificates or finance documents and can't be deleted — deactivate it instead to preserve those records.",
        )

    deleted_user_id, email = user.id, user.email
    db.query(AuditLog).filter(AuditLog.user_id == user.id).update({AuditLog.user_id: None})
    db.delete(user)
    # record_audit does its own commit, which is what actually persists
    # the nullify + delete above too — kept as one atomic transaction
    # rather than committing the delete separately beforehand.
    record_audit(
        db, request, "user.deleted", user_id=_admin.id, resource_type="user", resource_id=str(deleted_user_id),
        detail=f"deleted {email}",
    )
    return None


# ============================================================
# Password recovery. Passwords are one-way hashed (see hash_password in
# core/security.py) — there is no "look up the password" endpoint and
# there never will be; that's not an oversight, it's the point of
# hashing. What an admin can do instead is force a reset to a new
# temporary password and relay it to the person directly.
# ============================================================

@router.post("/users/{user_id}/reset-password", response_model=PasswordResetResult)
def reset_user_password(
    user_id: int,
    request: Request,
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    temp_password = generate_temporary_password()
    user.hashed_password = hash_password(temp_password)
    user.must_change_password = True
    # Whatever token this account's old password authenticated stays
    # valid otherwise — see User.token_version's own comment. A forced
    # reset should mean the old credential (and anything already signed
    # in against it) stops working right away.
    user.token_version += 1
    db.commit()
    db.refresh(user)

    email_sent = send_password_reset_email(
        to_email=user.email,
        full_name=user.full_name or "",
        temporary_password=temp_password,
        login_url=f"{settings.FRONTEND_URL}/signin",
    )

    # Deliberately no password (temp or otherwise) in the audit detail —
    # the log records that a reset happened and who did it, not the
    # credential itself.
    record_audit(
        db, request, "user.password_reset_by_admin", user_id=_admin.id,
        resource_type="user", resource_id=str(user.id), detail=f"email_sent={email_sent}",
    )
    return PasswordResetResult(temporary_password=temp_password, user=user, email_sent=email_sent)


# Requested directly, from the UX audit: "for a field team that will
# absolutely forget passwords, [no self-service reset] isn't optional
# polish, it's a support-ticket generator waiting to happen." Public —
# no auth dependency, since the whole point is recovering an account you
# can't currently sign into. Reuses the exact same "issue a temporary
# password, force a change on next sign-in" mechanism reset_user_password
# above already uses for an admin-triggered reset (same
# must_change_password flag, same send_password_reset_email), rather
# than introducing a second, parallel reset-token/reset-link mechanism
# for what's functionally the same recovery flow.
#
# Deliberately returns the exact same generic response whether or not
# the email matches a real account — never confirms or denies an
# account's existence (a "no account with that email" response would
# let anyone enumerate registered users by trying addresses one at a
# time). check_rate_limit is the same per-IP limiter /register already
# uses, which also caps how fast someone could repeatedly force-expire a
# real user's password as a nuisance.
@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_database),
):
    check_rate_limit(request, "forgot_password")

    user = db.query(User).filter(User.email == payload.email).first()
    if user and user.is_active:
        temp_password = generate_temporary_password()
        user.hashed_password = hash_password(temp_password)
        user.must_change_password = True
        # See User.token_version's own comment — same reasoning as
        # reset_user_password's admin-triggered version just above.
        user.token_version += 1
        db.commit()
        db.refresh(user)

        email_sent = send_password_reset_email(
            to_email=user.email,
            full_name=user.full_name or "",
            temporary_password=temp_password,
            login_url=f"{settings.FRONTEND_URL}/signin",
        )
        # Same reasoning as reset_user_password's own audit call — the
        # credential itself never appears in the log, only that a reset
        # happened and whether the email actually went out.
        record_audit(
            db, request, "user.password_reset_self_service", user_id=user.id,
            resource_type="user", resource_id=str(user.id), detail=f"email_sent={email_sent}",
        )

    return {"detail": "If that email is registered, we've sent password reset instructions to it."}


# Self-service — used both for a normal "I want to change my password"
# and to clear must_change_password after an admin-issued reset.
@router.post("/change-password", response_model=UserResponse)
def change_password(
    payload: PasswordChange,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters.")

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    # See User.token_version's own comment. This response still
    # succeeds normally — get_current_user already validated the token
    # this request came in on before this handler ran — but that SAME
    # token fails the version check on the very next request. That's
    # deliberate, standard practice for a password change (if the old
    # token had leaked, this is what actually revokes it), and already
    # lands gracefully: api/axios.ts's response interceptor treats any
    # 401 as an expired session and bounces to sign-in with a clear
    # message, not a silent broken page.
    current_user.token_version += 1
    db.commit()
    db.refresh(current_user)
    record_audit(db, request, "user.password_changed", user_id=current_user.id, resource_type="user", resource_id=str(current_user.id))
    return current_user


# Added alongside User.token_version, from a security review: there was
# no way for someone to invalidate a token they suspected was stolen
# (a device lost/left unlocked, a token they noticed logged somewhere
# it shouldn't be) without also changing their password. This bumps
# token_version directly — deliberately including THIS request's own
# token, same reasoning as change_password above (the request already
# succeeded by the time the bump happens; the token just can't be used
# again after). Self-service, no admin needed, since this only ever
# affects the caller's own account.
@router.post("/logout-everywhere")
def logout_everywhere(
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(get_current_user),
):
    current_user.token_version += 1
    db.commit()
    record_audit(db, request, "user.logout_everywhere", user_id=current_user.id, resource_type="user", resource_id=str(current_user.id))
    return {"detail": "Signed out of every device. Sign in again to continue."}


# Not in the pasted chat output — the mechanism behind "others with
# limited administrative role can do some actions on certificate and
# finance section based on role assigned by the main administrator."
# Sets the *extra* permissions for one account, on top of whatever
# their role already grants by default (see core/permissions.py's
# ROLE_DEFAULT_PERMISSIONS) — this can't remove what the role grants,
# only add to it. Meant primarily for LIMITED_ADMIN accounts (which
# start with almost nothing and are built up per-person) but works on
# any account if a specific extra is ever needed.
@router.patch("/users/{user_id}/permissions", response_model=UserResponse)
def update_user_permissions(
    user_id: int,
    payload: PermissionUpdate,
    request: Request,
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    invalid = set(payload.extra_permissions) - ALL_PERMISSIONS
    if invalid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown permission(s): {', '.join(sorted(invalid))}")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.extra_permissions = payload.extra_permissions
    db.commit()
    db.refresh(user)
    record_audit(
        db, request, "user.permissions_changed", user_id=_admin.id, resource_type="user", resource_id=str(user.id),
        detail=f"extra_permissions -> {payload.extra_permissions}",
    )
    return user
