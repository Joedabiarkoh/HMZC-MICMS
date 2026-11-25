from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, field_validator

from app.schemas.user import UserResponse

# Currencies a PO can be raised in: the invoice list plus ZAR (the
# approved PO 25-0022 is in rand). Validated here as well as in the
# frontend dropdown, since the code is printed on the document.
ALLOWED_PO_CURRENCIES = {"USD", "EUR", "GBP", "AOA", "GHS", "ZAR"}


class POLineItem(BaseModel):
    finance_item_id: Optional[int] = None
    code: str = ""
    description: str
    quantity: float
    unit: str = ""
    unit_price: float
    line_total: float

    @field_validator("description")
    @classmethod
    def _description_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Each line needs a description")
        return v


class PurchaseOrderSave(BaseModel):
    # Omitted on create -> the server numbers it (YY-NNNN). Sending one
    # lets an existing paper PO number be entered as-is.
    po_no: Optional[str] = None
    version: Optional[int] = None

    order_date: Optional[date] = None
    delivery_date: Optional[date] = None
    delivery_terms: Optional[str] = None
    quote_ref: Optional[str] = None
    subject: Optional[str] = None
    job_no: Optional[str] = None

    vendor_name: str
    vendor_vat: Optional[str] = None
    vendor_phone: Optional[str] = None
    vendor_email: Optional[str] = None
    vendor_physical_address: Optional[str] = None
    vendor_postal_address: Optional[str] = None

    delivery_address: Optional[str] = None
    delivery_contact_phone: Optional[str] = None
    delivery_contact_email: Optional[str] = None

    currency: str = "USD"
    line_items: List[POLineItem]
    subtotal: float
    total: float
    notes: Optional[str] = None

    written_by_title: Optional[str] = None

    @field_validator("vendor_name")
    @classmethod
    def _vendor_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Vendor name is required")
        return v.strip()

    @field_validator("currency")
    @classmethod
    def _currency_allowed(cls, v: str) -> str:
        if v not in ALLOWED_PO_CURRENCIES:
            raise ValueError(f"Currency must be one of {', '.join(sorted(ALLOWED_PO_CURRENCIES))}")
        return v


POAction = Literal["submit", "return", "approve", "send", "receive", "close", "cancel"]


class POTransition(BaseModel):
    action: POAction
    version: Optional[int] = None
    # approve: the approver's position, printed under their signature.
    title: Optional[str] = None
    # return / cancel: why.
    reason: Optional[str] = None
    # receive: the actual delivery date (defaults to today).
    received_date: Optional[date] = None


class PurchaseOrderResponse(BaseModel):
    id: int
    po_no: str
    status: str
    revision: int
    revision_date: Optional[date] = None
    order_date: Optional[date] = None
    delivery_date: Optional[date] = None
    delivery_terms: Optional[str] = None
    quote_ref: Optional[str] = None
    subject: Optional[str] = None
    job_no: Optional[str] = None

    vendor_name: str
    vendor_vat: Optional[str] = None
    vendor_phone: Optional[str] = None
    vendor_email: Optional[str] = None
    vendor_physical_address: Optional[str] = None
    vendor_postal_address: Optional[str] = None

    delivery_address: Optional[str] = None
    delivery_contact_phone: Optional[str] = None
    delivery_contact_email: Optional[str] = None

    currency: str
    line_items: List[dict]
    subtotal: float
    total: float
    notes: Optional[str] = None

    written_by: Optional[UserResponse] = None
    written_by_name: Optional[str] = None
    written_by_title: Optional[str] = None
    written_by_signature_url: Optional[str] = None
    approved_by: Optional[UserResponse] = None
    approved_by_name: Optional[str] = None
    approved_by_title: Optional[str] = None
    approved_by_signature_url: Optional[str] = None
    approved_at: Optional[datetime] = None

    submitted_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    received_at: Optional[date] = None
    closed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None
    return_reason: Optional[str] = None

    # Computed in the route: an approved/sent PO whose delivery date has
    # passed without it being received.
    is_overdue: bool = False
    attachment_count: int = 0

    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class POAttachmentResponse(BaseModel):
    id: int
    purchase_order_id: int
    label: str
    original_filename: str
    content_type: Optional[str] = None
    size_bytes: int
    uploaded_by: Optional[UserResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True


class POVendorSuggestion(BaseModel):
    """A vendor to pick when raising a PO: details from the most recent PO
    to that vendor, or just the name for a supplier that has only been
    boarded (Supplier Boarding keeps the form, not the contact details)."""
    name: str
    source: Literal["purchase_order", "supplier_boarding"]
    vat: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    physical_address: Optional[str] = None
    postal_address: Optional[str] = None
    currency: Optional[str] = None
