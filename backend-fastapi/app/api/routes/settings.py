from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_user
from app.core.audit import record_audit
from app.core.database import get_database
from app.models.notification_settings import get_notification_settings
from app.models.user import User
from app.schemas.settings import (
    CompanyInfoResponse,
    CompanyInfoUpdate,
    ExpiryReminderSettingsResponse,
    ExpiryReminderSettingsUpdate,
)

# Admin-only, same as Users/Audit Log (get_current_admin_user, not a
# permission string) — this is a system-wide setting for the whole
# platform, not something the per-person permission-grant model (see
# core/permissions.py) extends to.
router = APIRouter(tags=["settings"])


def _emails_list(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    return [e.strip() for e in raw.split(",") if e.strip()]


def _response(row) -> ExpiryReminderSettingsResponse:
    return ExpiryReminderSettingsResponse(
        emails=_emails_list(row.expiry_reminder_emails),
        updated_at=row.updated_at,
        updated_by=row.updated_by,
    )


@router.get("/expiry-reminder-emails", response_model=ExpiryReminderSettingsResponse)
def read_expiry_reminder_emails(
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    return _response(get_notification_settings(db))


# Replaces whichever email(s) are currently configured — deliberately
# not additive, since a role change usually means "this person instead
# of that one," not "this person as well as that one." An empty list
# is a valid save: it turns the reminder feature back off, the same as
# never configuring EXPIRY_REMINDER_EMAILS at all.
@router.put("/expiry-reminder-emails", response_model=ExpiryReminderSettingsResponse)
def update_expiry_reminder_emails(
    payload: ExpiryReminderSettingsUpdate,
    request: Request,
    db: Session = Depends(get_database),
    admin: User = Depends(get_current_admin_user),
):
    row = get_notification_settings(db)
    row.expiry_reminder_emails = ",".join(payload.emails) or None
    row.updated_by_id = admin.id
    db.commit()
    db.refresh(row)
    record_audit(
        db, request, "settings.expiry_reminder_emails_changed", user_id=admin.id,
        resource_type="notification_settings", resource_id="1",
        detail=f"emails -> {row.expiry_reminder_emails or '(none)'}",
    )
    return _response(row)


# ============================================================
# Company info — HMZC's own PEPPOL ID, printed on invoices/quotations.
# Read is any signed-in user (Finance/Sales staff print these documents
# daily, not just admins); write stays admin-only, same as every other
# setting in this file.
# ============================================================

@router.get("/company-info", response_model=CompanyInfoResponse)
def read_company_info(
    db: Session = Depends(get_database),
    _user: User = Depends(get_current_user),
):
    row = get_notification_settings(db)
    return CompanyInfoResponse(peppol_id=row.peppol_id)


@router.put("/company-info", response_model=CompanyInfoResponse)
def update_company_info(
    payload: CompanyInfoUpdate,
    request: Request,
    db: Session = Depends(get_database),
    admin: User = Depends(get_current_admin_user),
):
    row = get_notification_settings(db)
    row.peppol_id = (payload.peppol_id or "").strip() or None
    row.updated_by_id = admin.id
    db.commit()
    db.refresh(row)
    record_audit(
        db, request, "settings.company_info_changed", user_id=admin.id,
        resource_type="notification_settings", resource_id="1",
        detail=f"peppol_id -> {row.peppol_id or '(none)'}",
    )
    return CompanyInfoResponse(peppol_id=row.peppol_id)
