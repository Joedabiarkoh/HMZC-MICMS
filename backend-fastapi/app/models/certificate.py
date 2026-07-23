from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Resolves the gap flagged in the root README's "Next step": certificates
# previously lived only in the browser's localStorage (see
# frontend-react/.../inspection.storage.ts), so "who worked on which
# certificate" was a free-text name, not something an admin could query.
#
# The full certificate content (checklist sections, equipment list,
# photos, signatures) is a nested, document-shaped structure that varies
# by equipment type (see InspectionCertificate in the frontend's
# inspection.types.ts) — modelling every nested piece as its own child
# table would mean a dozen+ tables for something that's never queried
# piece-by-piece server-side. Instead: the fields an admin actually needs
# to query/sort/filter on (cert number, type, vessel, status, who, when)
# are real columns; the rest of the certificate is stored as JSON in
# `payload`, matching the shape the frontend already builds and prints
# from. This is a deliberate, common pattern for document-like records —
# not a shortcut around modelling it properly.
class Certificate(BaseModel):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    cert_no = Column(String, unique=True, index=True, nullable=False)
    equipment_type = Column(String, nullable=False)  # lifeboat / rescueboat / freefall_dry / etc.
    vessel_name = Column(String, nullable=True)
    imo_no = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="draft")  # "draft" | "final"
    date_of_servicing = Column(String, nullable=True)

    issued_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    issued_by = relationship("User")

    payload = Column(JSON, nullable=False)  # full InspectionCertificate object as JSON

    # Added alongside the Finance module's optimistic-concurrency check —
    # same reasoning applies here: two people editing the same certificate
    # (e.g. a technician and an admin) should get a conflict, not a
    # silent overwrite. See save_certificate in api/routes/certificates.py.
    version = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
