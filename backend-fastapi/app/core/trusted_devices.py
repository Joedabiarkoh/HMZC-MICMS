import hashlib
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.trusted_device import TrustedDevice

# Requested directly: 2FA asking for a code on every single sign-in was
# "very difficult for some users" on the two roles it's enforced for
# (Admin/Finance) — the same friction every mainstream 2FA-enforcing
# product (Google, GitHub, AWS, most banking apps) solves the same way:
# let someone mark a device as trusted for a while, so a RECOGNIZED
# device only needs the password on future logins, while a NEW device
# still gets the full challenge every time.
#
# Why this doesn't meaningfully weaken 2FA: the actual threat it
# defends against — a leaked or guessed password used from somewhere
# the attacker controls — is untouched. A trusted-device token only
# ever substitutes for the 2FA step on the EXACT device it was issued
# to; it's not a second password and can't be typed in from elsewhere.
# What it removes is re-proving "it's still me, on the same laptop I
# always use," which is friction, not protection.
TRUSTED_DEVICE_DAYS = 30


def _hash(raw_token: str) -> str:
    # Fast, not bcrypt — see TrustedDevice.token_hash's own comment on
    # why a slow password-hash isn't the right tool for a
    # high-entropy random token.
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_trusted_device(db: Session, user_id: int, request: Request) -> str:
    """Issues a new trusted-device token, stores its hash, and returns
    the raw value exactly once — the caller (verify_two_factor) hands
    it straight back to the frontend to store locally; it's never
    recoverable from the database afterward, same reasoning as a
    recovery code or a temporary password."""
    raw_token = token_urlsafe(32)
    device = TrustedDevice(
        user_id=user_id,
        token_hash=_hash(raw_token),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=TRUSTED_DEVICE_DAYS),
    )
    db.add(device)
    db.commit()
    return raw_token


def find_trusted_device(db: Session, user_id: int, raw_token: str) -> Optional[TrustedDevice]:
    """None if the token is missing, unknown, belongs to a different
    account, or has expired — login()'s caller treats all of those
    identically (fall through to the normal 2FA challenge), so this
    doesn't need to distinguish which."""
    if not raw_token:
        return None
    device = db.query(TrustedDevice).filter(TrustedDevice.token_hash == _hash(raw_token), TrustedDevice.user_id == user_id).first()
    if not device:
        return None
    expires_at = device.expires_at if device.expires_at.tzinfo is not None else device.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        return None
    return device


def touch_trusted_device(db: Session, device: TrustedDevice) -> None:
    device.last_used_at = datetime.now(timezone.utc)
    db.commit()


def clear_trusted_devices(db: Session, user_id: int) -> None:
    """Called everywhere User.token_version already gets bumped
    (deactivate, password reset/change, logout-everywhere) — the same
    "something changed, invalidate standing trust" moment applies to a
    device's standing 2FA exemption just as much as to an issued JWT.
    Without this, a password reset could leave a stale trusted device
    still skipping 2FA on the NEW password."""
    db.query(TrustedDevice).filter(TrustedDevice.user_id == user_id).delete()
    db.commit()
