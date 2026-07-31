from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from app.schemas.user import UserResponse


class ExpiryReminderSettingsResponse(BaseModel):
    emails: List[str]
    updated_at: Optional[datetime] = None
    updated_by: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ExpiryReminderSettingsUpdate(BaseModel):
    emails: List[EmailStr]


# Readable by any signed-in user (invoices/quotations printed by
# Finance/Sales staff need this, not just admins) — see
# read_company_info's permission in api/routes/settings.py, deliberately
# looser than the admin-only expiry-reminder endpoints above.
class CompanyInfoResponse(BaseModel):
    peppol_id: Optional[str] = None
    bank_name: Optional[str] = None
    bank_address: Optional[str] = None
    bank_town: Optional[str] = None
    bank_postcode: Optional[str] = None
    bank_country: Optional[str] = None
    bank_beneficiary: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None
    bank_swift_code: Optional[str] = None
    bank_iban: Optional[str] = None


class CompanyInfoUpdate(BaseModel):
    peppol_id: Optional[str] = None
    bank_name: Optional[str] = None
    bank_address: Optional[str] = None
    bank_town: Optional[str] = None
    bank_postcode: Optional[str] = None
    bank_country: Optional[str] = None
    bank_beneficiary: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None
    bank_swift_code: Optional[str] = None
    bank_iban: Optional[str] = None
