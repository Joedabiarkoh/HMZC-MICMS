from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Requested directly: "create a section for suppliers boarding, allow
# for the document to be downloaded and uploaded after it has been
# filled" — a completed New Supplier Form (see the static template
# served by api/routes/suppliers.py's /template endpoint, copied
# unmodified from the reference document rather than rebuilt, so its
# dropdown data-validation isn't lost) gets uploaded here as one
# submission per supplier boarded. This is deliberately a simple
# submissions log (a real file per row, who uploaded it, when), not a
# full Supplier entity/register — there was no Supplier concept
# anywhere in this app before this, and the request was specifically
# "download the form, fill it in, upload it back," not "manage a
# supplier's ongoing record."
class SupplierBoardingSubmission(BaseModel):
    __tablename__ = "supplier_boarding_submissions"

    id = Column(Integer, primary_key=True, index=True)
    supplier_name = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=False)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_by = relationship("User")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
