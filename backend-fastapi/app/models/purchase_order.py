from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Purchase orders: what HMZC buys from a vendor, written by one person and
# approved by another before it is sent. Modelled on the approved PO
# "25-0022" (header, vendor block, line items, written-by / approved-by,
# delivery address, standard terms page).
#
# Same storage choices as Quotation/Invoice (finance_document.py): line
# items are a JSON list written and read as a whole, and `version` is the
# optimistic-concurrency counter checked on every save. Two differences
# worth knowing about:
#   * Amounts are stored in the PO's OWN currency (ZAR for a South African
#     vendor, say), not normalised to USD like invoices. A PO is a
#     commitment in whatever currency the vendor quoted; converting it
#     would only add rounding the vendor's own invoice would then disagree
#     with.
#   * `revision` is the printed "Version No" on the PO (bumped when an
#     already-approved PO is changed and must be re-approved), separate
#     from `version`, which is only the concurrency counter.

PO_STATUSES = ("draft", "pending_approval", "approved", "sent", "received", "closed", "cancelled")


class PurchaseOrder(BaseModel):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_no = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, nullable=False, default="draft", index=True)

    # Printed "Version No / Version Date" on the PO.
    revision = Column(Integer, nullable=False, default=1)
    revision_date = Column(Date, nullable=True)

    order_date = Column(Date, nullable=True)
    delivery_date = Column(Date, nullable=True)
    delivery_terms = Column(String, nullable=True)
    quote_ref = Column(String, nullable=True)  # vendor's quote / pro-forma number ("Quote Ref" and "Req No")
    subject = Column(Text, nullable=True)
    # Optional link to the job this purchase is for (plain string, like
    # Expense.vessel_name, rather than a foreign key, so a PO can still be
    # opened after a job is closed or renamed).
    job_no = Column(String, nullable=True, index=True)

    vendor_name = Column(String, nullable=False)
    vendor_vat = Column(String, nullable=True)
    vendor_phone = Column(String, nullable=True)
    vendor_email = Column(String, nullable=True)
    vendor_physical_address = Column(Text, nullable=True)
    vendor_postal_address = Column(Text, nullable=True)

    delivery_address = Column(Text, nullable=True)
    delivery_contact_phone = Column(String, nullable=True)
    delivery_contact_email = Column(String, nullable=True)

    currency = Column(String, nullable=False, default="USD")
    line_items = Column(JSON, nullable=False, default=list)
    subtotal = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)
    notes = Column(Text, nullable=True)

    # "Written / verified by" — snapshot of who wrote it, their position
    # and signature at the moment it was written, so the printed PO stays
    # as it was signed even if the user later changes their saved signature.
    written_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    written_by = relationship("User", foreign_keys=[written_by_id])
    written_by_name = Column(String, nullable=True)
    written_by_title = Column(String, nullable=True)
    written_by_signature_url = Column(String, nullable=True)

    # "Approved by" — same snapshot idea, filled in when it's approved.
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    approved_by_name = Column(String, nullable=True)
    approved_by_title = Column(String, nullable=True)
    approved_by_signature_url = Column(String, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    submitted_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(Date, nullable=True)  # actual delivery date
    closed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String, nullable=True)
    return_reason = Column(String, nullable=True)  # why an approver sent it back to draft

    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Vendor quotes/pro-formas, delivery notes, the vendor's invoice, proof of
# delivery - same idea as InvoiceAttachment (finance_attachment.py), stored
# as real files via core/file_storage.py.
class PurchaseOrderAttachment(BaseModel):
    __tablename__ = "purchase_order_attachments"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False, index=True)
    label = Column(String, nullable=False, default="Other")
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=False)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_by = relationship("User")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
