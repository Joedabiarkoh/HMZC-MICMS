from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Requested directly: "before you create a certificate job number must
# be created for you and all the certificate that will be created
# within that job number will be grouped under that job number and
# once the job is completed that job number can be closed and no
# other certificate can be created using that job number." A vessel's
# Loose Gear inspection can span hundreds of individual item
# certificates over several days (see LooseGearStandardReportData in
# the frontend's inspection.types.ts) — this is what ties them all
# together as one real, enforced record instead of a guessed string
# each certificate carried independently (the old jobNo free-text
# field, still present on LooseGearStandardReportData for legacy
# certificates predating this table).
#
# next_item_seq is the source of the "-001", "-002"... suffix in each
# certificate's own cert_no (see api/routes/loose_gear_jobs.py's
# reserve_cert_no) — incremented atomically there via SELECT ... FOR
# UPDATE, not computed by counting existing certificates client-side,
# since multiple technicians can be adding items to the same job at
# the same time on a large vessel.
class LooseGearJob(BaseModel):
    __tablename__ = "loose_gear_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_no = Column(String, unique=True, index=True, nullable=False)
    vessel_name = Column(String, nullable=False, index=True)
    imo_no = Column(String, nullable=True)
    # "open" | "closed" — closed rejects new cert-number reservations
    # (see reserve_cert_no) but never blocks editing certificates
    # already issued under it (requested directly: "Yes, still
    # editable" — closing only ever stops NEW items being added).
    status = Column(String, nullable=False, default="open")
    next_item_seq = Column(Integer, nullable=False, default=1)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id])
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    closed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    closed_at = Column(DateTime(timezone=True), nullable=True)
