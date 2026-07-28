from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Requested directly: a simple company-wide expense ledger (category,
# amount, date, note) — not tied to a specific vessel/job by default,
# since most expenses (office rent, general supplies) aren't about any
# one job. `vessel_name` is deliberately optional rather than required:
# fill it in when a cost genuinely was for a specific vessel/job (so
# Job Costing below can group it), leave it blank for anything general.
# No foreign key to Certificate/Invoice — vessel_name is a plain string,
# matched loosely against those tables' own vessel_name strings, the
# same "no strict linkage" pattern Finance already uses elsewhere
# (Invoice.vessel_name isn't a foreign key to any vessel table either).
class Expense(BaseModel):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False)  # e.g. "Travel", "Spare Parts", "Subcontractor"
    amount = Column(Float, nullable=False)
    # Plain "YYYY-MM-DD" string, same convention as Certificate.date_of_servicing
    # (see that model's own comment) — matches the frontend date input shape
    # directly rather than introducing a different date-handling convention
    # just for this one table.
    expense_date = Column(String, nullable=False)
    note = Column(String, nullable=True)
    vessel_name = Column(String, nullable=True)

    logged_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    logged_by = relationship("User")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
