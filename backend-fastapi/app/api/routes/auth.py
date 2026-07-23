from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_user
from app.core.audit import record_audit
from app.core.database import get_database
from app.core.email import send_account_created_email, send_password_reset_email
from app.core.config import settings
from app.core.permissions import ALL_PERMISSIONS
from app.core.rate_limit import check_rate_limit
from app.core.security import create_access_token, generate_temporary_password, hash_password, verify_password
from app.models.audit_log import AuditLog
from app.models.certificate import Certificate
from app.models.finance_document import Invoice, Quotation
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogResponse
from app.schemas.user import AdminCreateUser, PasswordChange, PasswordResetResult, PermissionUpdate, Token, UserCreate, UserResponse

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


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_database),
):
    check_rate_limit(request, "login")
    # OAuth2PasswordRequestForm's "username" field carries the email —
    # this project logs in by email, not a separate username.
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
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

    access_token = create_access_token({"sub": str(user.id)})
    # Not in the pasted chat output — a login is one of the few events
    # worth a real audit trail entry on a certification platform (see
    # app/core/audit.py for what's scoped in vs deliberately left out).
    record_audit(db, request, "login", user_id=user.id, resource_type="user", resource_id=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
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
    db.commit()
    db.refresh(user)
    record_audit(db, request, "user.deactivated", user_id=_admin.id, resource_type="user", resource_id=str(user.id))
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
    db.commit()
    db.refresh(current_user)
    record_audit(db, request, "user.password_changed", user_id=current_user.id, resource_type="user", resource_id=str(current_user.id))
    return current_user


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
