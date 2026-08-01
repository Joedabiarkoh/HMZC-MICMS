from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import UserResponse


class SupplierBoardingSubmissionResponse(BaseModel):
    id: int
    supplier_name: str
    notes: Optional[str] = None
    original_filename: str
    content_type: Optional[str] = None
    size_bytes: int
    uploaded_by: Optional[UserResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True
