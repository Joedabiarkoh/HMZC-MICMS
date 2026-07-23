from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func

from app.models.base import BaseModel

# The item/product catalog requested directly: "the items provided with
# the cost are supposed to be items list with associated id or code."
# This is deliberately a plain, admin-managed price list — not surfaced
# anywhere as "services HMZC offers," only pulled from when someone
# issuing an invoice or quotation searches/selects a line item. See
# app/api/routes/finance.py for who can read vs write it.
class FinanceItem(BaseModel):
    __tablename__ = "finance_items"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    unit = Column(String, nullable=True)  # e.g. "each", "hour", "set"
    unit_price = Column(Float, nullable=False)
    category = Column(String, nullable=True)  # e.g. "Lifeboat Servicing", "Crane Inspection"
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
