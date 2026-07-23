from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Quotations and Invoices share the same shape (customer/vessel details,
# a set of line items, subtotal/discount/total, who issued it and when)
# so they're defined together here rather than duplicated across two
# files with copy-pasted drift between them.
#
# Line items are stored as JSON (each: {code, description, quantity,
# unit_price, discount_percent, line_total, finance_item_id}) rather than
# a child table, the same deliberate choice made for Certificate.payload
# — they're written and read as a whole document, not queried
# item-by-item server-side. If per-line financial reporting/aggregation
# becomes a real requirement later, that's the point to promote line
# items to a real relational child table; JSON is the right call today.
#
# `version` supports the optimistic-concurrency check in
# app/api/routes/finance.py: a PATCH must send back the version it read,
# and the server rejects (409) if someone else has since updated the
# record — rather than one edit silently overwriting another.


class Quotation(BaseModel):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    quotation_no = Column(String, unique=True, index=True, nullable=False)
    customer = Column(String, nullable=False)
    vessel_name = Column(String, nullable=True)
    imo_no = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="draft")  # draft | sent | accepted | rejected

    line_items = Column(JSON, nullable=False, default=list)
    subtotal = Column(Float, nullable=False, default=0)
    discount_total = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)

    issued_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    issued_by = relationship("User")

    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Invoice(BaseModel):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String, unique=True, index=True, nullable=False)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    customer = Column(String, nullable=False)
    vessel_name = Column(String, nullable=True)
    imo_no = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="draft")  # draft | issued | paid | void

    line_items = Column(JSON, nullable=False, default=list)
    subtotal = Column(Float, nullable=False, default=0)
    discount_total = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)

    issued_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    issued_by = relationship("User")

    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
