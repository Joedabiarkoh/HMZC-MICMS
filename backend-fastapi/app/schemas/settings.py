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
