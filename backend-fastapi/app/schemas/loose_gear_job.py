from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import UserResponse


class LooseGearJobCreate(BaseModel):
    vessel_name: str
    imo_no: Optional[str] = None


class LooseGearJobResponse(BaseModel):
    id: int
    job_no: str
    vessel_name: str
    imo_no: Optional[str] = None
    status: str
    next_item_seq: int
    created_by: Optional[UserResponse] = None
    created_at: datetime
    closed_by: Optional[UserResponse] = None
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Response for reserving the next item's certificate number under a
# job — just the assigned cert_no, not the whole job record, since
# that's the only thing the frontend needs at that point (see
# LooseGearForm.tsx's job picker).
class LooseGearJobReserveResult(BaseModel):
    cert_no: str
    job_no: str
