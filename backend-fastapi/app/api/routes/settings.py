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
# Company info — HMZC's own PEPPOL ID and supplier bank account details,
# printed on invoices (bank details) / invoices+quotations (PEPPOL ID).
# Read is any signed-in user (Finance/Sales staff print these documents
# daily, not just admins); write stays admin-only, same as every other
# setting in this file.
# ============================================================

_COMPANY_INFO_FIELDS = [
    "peppol_id", "bank_name", "bank_address", "bank_town", "bank_postcode",
    "bank_country", "bank_beneficiary", "bank_account_number", "bank_sort_code",
    "bank_swift_code", "bank_iban", "terms_conditions",
]


def _company_info_response(row) -> CompanyInfoResponse:
    return CompanyInfoResponse(**{field: getattr(row, field) for field in _COMPANY_INFO_FIELDS})


@router.get("/company-info", response_model=CompanyInfoResponse)
def read_company_info(
    db: Session = Depends(get_database),
    _user: User = Depends(get_current_user),
):
    return _company_info_response(get_notification_settings(db))


@router.put("/company-info", response_model=CompanyInfoResponse)
def update_company_info(
    payload: CompanyInfoUpdate,
    request: Request,
    db: Session = Depends(get_database),
    admin: User = Depends(get_current_admin_user),
):
    row = get_notification_settings(db)
    for field in _COMPANY_INFO_FIELDS:
        value = getattr(payload, field)
        setattr(row, field, (value or "").strip() or None)
    row.updated_by_id = admin.id
    db.commit()
    db.refresh(row)
    record_audit(
        db, request, "settings.company_info_changed", user_id=admin.id,
        resource_type="notification_settings", resource_id="1",
        detail=f"peppol_id -> {row.peppol_id or '(none)'}, bank_account_number -> {row.bank_account_number or '(none)'}",
    )
    return _company_info_response(row)
