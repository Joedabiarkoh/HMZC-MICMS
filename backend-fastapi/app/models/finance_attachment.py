from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Requested directly: let supporting documents (service report, PO,
# delivery note, and any other additional document) be uploaded and
# saved against an invoice, then downloaded together as one bundle —
# see api/routes/finance.py's download-all (zip) endpoint. Stores real
# arbitrary files on disk (see core/file_storage.py), unlike
# photo_storage.py's base64-in-JSON approach — these are genuinely
# separate documents a browser <input type="file"> posts directly, not
# an image field embedded in the invoice's own JSON.
#
# `label` is a free-text category ("Service Report", "Purchase Order",
# "Delivery Note", "Other"...) rather than an enum — matches
# FinanceItem.category's own "plain string, not a constrained enum"
# choice elsewhere in this file, so a genuinely new document type
# doesn't need a schema migration to describe.
class InvoiceAttachment(BaseModel):
    __tablename__ = "invoice_attachments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    label = Column(String, nullable=False, default="Other")
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=False)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_by = relationship("User")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
