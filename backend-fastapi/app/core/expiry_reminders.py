import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_expiry_reminder_email
from app.models.certificate import Certificate
from app.models.notification_settings import get_notification_settings

logger = logging.getLogger("hmzc.expiry_reminders")

# Requested directly: "certificate expiry is 1 year period" — every
# certificate, regardless of equipment type, is treated as expiring
# exactly 365 days after date_of_servicing for the purposes of this
# reminder/dashboard feature. (Individual FFE sub-types carry their own
# `validityYears` in the frontend's ffeCertTypes.ts for what's printed
# on the certificate itself — this is a separate, simpler, explicitly
# requested rule for when staff get reminded, not a change to what's
# printed.)
VALIDITY_DAYS = 365


def configured_reminder_emails(db: Session) -> list[str]:
    """
    The DB-backed setting an administrator edits from Settings (see
    api/routes/settings.py, models/notification_settings.py) takes
    priority — it's what lets the recipient change from inside the app
    whenever the responsible person's role changes, without needing
    server access. Settings.EXPIRY_REMINDER_EMAILS (core/config.py) is
    only consulted as a fallback, for a deployment that set the env var
    and has never touched the in-app setting.
    """
    row_emails = get_notification_settings(db).expiry_reminder_emails
    if row_emails:
        return [email.strip() for email in row_emails.split(",") if email.strip()]
    return settings.expiry_reminder_emails_list


def is_expiry_reminders_configured(db: Session) -> bool:
    return bool(configured_reminder_emails(db))


def parse_date_of_servicing(value: Optional[str]) -> Optional[date]:
    """date_of_servicing is stored as a plain ISO string ("YYYY-MM-DD",
    same shape the frontend's date input produces — see
    inspection.types.ts) rather than a real Date column (see
    Certificate's own comment on why most of a certificate lives in
    payload/simple columns). Returns None for anything missing or not
    in that exact shape rather than raising — a certificate with an
    unparseable date should just be silently excluded from expiry
    tracking, not crash the whole scheduled check over one bad row."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def compute_expiry_date(date_of_servicing: Optional[str]) -> Optional[date]:
    serviced = parse_date_of_servicing(date_of_servicing)
    if serviced is None:
        return None
    return serviced + timedelta(days=VALIDITY_DAYS)


def _finalized_certificates_with_expiry(db: Session) -> list[tuple[Certificate, date]]:
    """Every finalized certificate that has a parseable date_of_servicing,
    paired with its computed expiry date. Drafts are excluded — a
    certificate that was never actually issued has nothing to expire."""
    results = []
    for cert in db.query(Certificate).filter(Certificate.status == "final").all():
        expiry = compute_expiry_date(cert.date_of_servicing)
        if expiry is not None:
            results.append((cert, expiry))
    return results


def list_expiring_certificates(db: Session, lead_days: Optional[int] = None) -> list[dict[str, Any]]:
    """
    For the in-app "Expiring Soon" dashboard — every finalized
    certificate expiring within `lead_days` from today, INCLUDING
    already-overdue ones (no lower bound), sorted most-urgent first.
    Independent of expiry_reminder_sent_at on purpose: a certificate
    should keep showing up here until it's actually renewed, regardless
    of whether the one-time reminder email already went out for it.
    """
    if lead_days is None:
        lead_days = settings.EXPIRY_REMINDER_LEAD_DAYS
    today = date.today()
    horizon = today + timedelta(days=lead_days)

    matches = [
        (cert, expiry) for cert, expiry in _finalized_certificates_with_expiry(db) if expiry <= horizon
    ]
    matches.sort(key=lambda pair: pair[1])

    return [
        {
            "cert_no": cert.cert_no,
            "equipment_type": cert.equipment_type,
            "vessel_name": cert.vessel_name,
            "date_of_servicing": cert.date_of_servicing,
            "expiry_date": expiry.isoformat(),
            "days_until_expiry": (expiry - today).days,
            "overdue": expiry < today,
        }
        for cert, expiry in matches
    ]


def send_expiry_reminders(db: Session) -> dict[str, Any]:
    """
    The scheduled (and admin-manually-triggerable) check: finds every
    finalized certificate expiring within EXPIRY_REMINDER_LEAD_DAYS (or
    already overdue) that hasn't been reminded about yet, sends ONE
    digest email listing all of them, and only then marks each as
    reminded — so a transient SMTP failure means it's simply retried on
    the next run instead of silently never reminding anyone.
    """
    recipient_emails = configured_reminder_emails(db)
    if not recipient_emails:
        return {"skipped": True, "reason": "No expiry reminder recipients configured (see Settings)"}

    lead_days = settings.EXPIRY_REMINDER_LEAD_DAYS
    today = date.today()
    horizon = today + timedelta(days=lead_days)

    candidates = [
        (cert, expiry)
        for cert, expiry in _finalized_certificates_with_expiry(db)
        if expiry <= horizon and cert.expiry_reminder_sent_at is None
    ]
    if not candidates:
        return {"skipped": False, "reminded": 0}

    candidates.sort(key=lambda pair: pair[1])
    payload = [
        {
            "cert_no": cert.cert_no,
            "equipment_type": cert.equipment_type,
            "vessel_name": cert.vessel_name,
            "expiry_date": expiry.isoformat(),
        }
        for cert, expiry in candidates
    ]

    sent = send_expiry_reminder_email(recipient_emails, payload)
    if not sent:
        logger.warning("Expiry reminder email failed to send — will retry on the next scheduled run.")
        return {"skipped": False, "reminded": 0, "email_failed": True}

    now = datetime.now(timezone.utc)
    for cert, _expiry in candidates:
        cert.expiry_reminder_sent_at = now
    db.commit()
    return {"skipped": False, "reminded": len(candidates)}
