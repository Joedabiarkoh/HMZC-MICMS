from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Requested directly: "the job creation number should be for all the
# certificate, so that all certificate issued will stay under that
# job number and easy to track, as the same vessel can be visited on
# different occassion for different POs" — generalized from the
# original Loose-Gear-only Job (a vessel's inspection can span many
# certificates of ANY equipment type — lifeboat, crane, loose gear
# items — issued together under one client PO). Every certificate,
# regardless of type, is now tied to one of these (see
# InspectionCertificate.jobRef, inspection.types.ts).
#
# A certificate's own cert_no is never derived from job_no (see
# models/cert_number_counter.py for how Loose Gear generates its own
# clean "CERT/HMZC/LG/{date}-{seq}" number instead) — job_no exists
# purely as a stable tag every certificate under it carries, for
# grouping/tracking (Certificate Log, PO tracking), independent of
# whatever each certificate's own number looks like.
class Job(BaseModel):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_no = Column(String, unique=True, index=True, nullable=False)
    vessel_name = Column(String, nullable=False, index=True)
    imo_no = Column(String, nullable=True)

    # Requested directly: "include PO required, if PO not available
    # include a section for PO not available now" then "if PO not
    # available allow to enter customer name" — a job always needs
    # SOME way to identify who/what it's for: either a real PO number,
    # or (until one is issued) at least the customer's name. Exactly
    # one of po_number/customer_name is required at creation,
    # enforced in api/routes/jobs.py, not here — po_pending records
    # WHY po_number might be empty (deliberately not yet available)
    # rather than leaving that ambiguous with "just never filled in."
    po_number = Column(String, nullable=True)
    po_pending = Column(Boolean, nullable=False, default=False)
    customer_name = Column(String, nullable=True)

    # "open" | "closed" — closed rejects new cert-number reservations
    # (see reserve_cert_no) but never blocks editing certificates
    # already issued under it (requested directly: "Yes, still
    # editable" — closing only ever stops NEW items being added).
    status = Column(String, nullable=False, default="open")

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id])
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    closed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    closed_at = Column(DateTime(timezone=True), nullable=True)
