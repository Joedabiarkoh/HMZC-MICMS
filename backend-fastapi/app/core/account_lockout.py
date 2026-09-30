from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.user import User

# A security review flagged that rate_limit.py's per-IP window (see its
# own comment — 10 attempts/minute) caps how FAST someone can guess a
# password, but not how MANY guesses they get against one specific
# account: rotating IPs (or just waiting a minute between tries) lets an
# attacker grind one account's password indefinitely. This adds a
# genuinely different, complementary control — per-ACCOUNT lockout,
# independent of which IP the attempts came from.

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _aware(value: datetime) -> datetime:
    # locked_until is always WRITTEN as datetime.now(timezone.utc) (see
    # register_failed_attempt below), but SQLite (used in tests — real
    # deployments run Postgres) silently drops tzinfo on read-back for a
    # DateTime(timezone=True) column, returning a naive datetime instead
    # of an aware one. Comparing a naive and an aware datetime raises
    # TypeError outright, so re-attach UTC rather than assume the
    # underlying driver preserved it.
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def is_locked(user: User) -> bool:
    return user.locked_until is not None and _aware(user.locked_until) > datetime.now(timezone.utc)


def lock_remaining_seconds(user: User) -> int:
    """Only meaningful when is_locked(user) is True."""
    if user.locked_until is None:
        return 0
    delta = _aware(user.locked_until) - datetime.now(timezone.utc)
    return max(0, int(delta.total_seconds()))


def register_failed_attempt(db: Session, user: User) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
    db.commit()


def reset_failed_attempts(db: Session, user: User) -> None:
    if user.failed_login_attempts == 0 and user.locked_until is None:
        # Skip the write entirely for the overwhelmingly common case (a
        # normal login with no prior failures) — avoids an UPDATE on
        # every single successful login just to write back the same
        # zero/null values it already had.
        return
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()


def unlock_account(db: Session, user: User) -> None:
    """Admin-initiated early unlock — see POST /auth/users/{id}/unlock."""
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)
