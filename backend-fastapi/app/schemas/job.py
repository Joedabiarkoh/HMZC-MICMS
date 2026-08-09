from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import UserResponse


class JobCreate(BaseModel):
    vessel_name: str
    imo_no: Optional[str] = None
    po_number: Optional[str] = None
    # Requested directly: "include PO required, if PO not available
    # include a section for PO not available now" — set true when the
    # client hasn't issued a PO yet; validated in create_job (see
    # api/routes/jobs.py) as requiring customer_name in that case,
    # since a job always needs SOME way to identify who it's for.
    po_pending: bool = False
    customer_name: Optional[str] = None


# Requested directly: "if PO not available allow to enter customer
# name" then "PO becomes editable on the open Job" once it's finally
# issued — a technician/admin can come back and fill it in without
# starting a new job.
class JobSetPo(BaseModel):
    po_number: str


class JobResponse(BaseModel):
    id: int
    job_no: str
    vessel_name: str
    imo_no: Optional[str] = None
    po_number: Optional[str] = None
    po_pending: bool
    customer_name: Optional[str] = None
    status: str
    next_item_seq: int
    # Requested directly: "so that all certificate issued will stay
    # under that job number and easy to track" — the real count of
    # certificates tagged with this job_no, across every equipment
    # type. Deliberately NOT next_item_seq - 1: that counter only
    # advances for Loose Gear's own reserve_cert_no calls (see Job
    # model's own comment for why), so it undercounts a job that also
    # has a lifeboat or crane certificate under it. Computed and
    # attached in api/routes/jobs.py, not a real column here.
    certificate_count: int = 0
    created_by: Optional[UserResponse] = None
    created_at: datetime
    closed_by: Optional[UserResponse] = None
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Response for reserving the next item's certificate number under a
# job — only actually used by Loose Gear (see Job's own comment for
# why); every other equipment type just tags jobRef and keeps its own
# existing cert_no scheme.
class JobReserveResult(BaseModel):
    cert_no: str
    job_no: str
