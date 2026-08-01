from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.schemas.user import UserResponse


# ---- Dashboard ----
# Was FinanceDashboard.tsx calling GET /finance/dashboard, which had no
# backend route at all — the page has been erroring on load. Built from
# real Invoice/Quotation data where that data exists. `profit_margin` is
# explicitly None rather than a fabricated number: there's no Expense/
# cost-tracking table wired up yet (Expenses.tsx and JobCosting.tsx are
# still backend-pending stubs — see the README), so "profit" isn't a
# real, computable figure yet. Returning 0% would silently claim every
# dollar of revenue is pure profit, which is worse than saying "not
# tracked yet."

class MonthlyRevenuePoint(BaseModel):
    month: str
    revenue: float
    cost: float  # always 0 today — see profit_margin note above


class RecentTransaction(BaseModel):
    id: str
    description: str
    amount: float


class DashboardSummary(BaseModel):
    revenue: float
    outstanding: float
    pending_quotations: int
    profit_margin: Optional[float] = None
    monthly: List[MonthlyRevenuePoint]
    recent_transactions: List[RecentTransaction]


# ---- Catalog ----

class FinanceItemCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    unit: Optional[str] = None
    unit_price: float
    category: Optional[str] = None
    is_active: bool = True


class FinanceItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class FinanceItemResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    unit: Optional[str] = None
    unit_price: float
    category: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Shared line item shape (quotations and invoices) ----

class LineItem(BaseModel):
    finance_item_id: Optional[int] = None
    code: str
    description: str
    quantity: float
    unit_price: float
    discount_percent: float = 0
    line_total: float


# ---- Quotations ----

class QuotationCreate(BaseModel):
    quotation_no: str
    customer: str
    vessel_name: Optional[str] = None
    imo_no: Optional[str] = None
    status: str = "draft"
    line_items: List[LineItem]
    subtotal: float
    discount_total: float
    total: float
    conditions: List[str] = []
    version: Optional[int] = None


class QuotationResponse(BaseModel):
    id: int
    quotation_no: str
    customer: str
    vessel_name: Optional[str] = None
    imo_no: Optional[str] = None
    status: str
    line_items: List[Dict[str, Any]]
    subtotal: float
    discount_total: float
    total: float
    conditions: List[str] = []
    issued_by: Optional[UserResponse] = None
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Invoices ----

class InvoiceCreate(BaseModel):
    invoice_no: str
    quotation_id: Optional[int] = None
    customer: str
    vessel_name: Optional[str] = None
    imo_no: Optional[str] = None
    status: str = "draft"
    line_items: List[LineItem]
    subtotal: float
    discount_total: float
    total: float
    version: Optional[int] = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_no: str
    quotation_id: Optional[int] = None
    customer: str
    vessel_name: Optional[str] = None
    imo_no: Optional[str] = None
    status: str
    line_items: List[Dict[str, Any]]
    subtotal: float
    discount_total: float
    total: float
    issued_by: Optional[UserResponse] = None
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Invoice attachments ----
# Supporting documents (service report, PO, delivery note, other) —
# see models/finance_attachment.py and api/routes/finance.py's
# multipart upload/list/download/download-all/delete endpoints.

class InvoiceAttachmentResponse(BaseModel):
    id: int
    invoice_id: int
    label: str
    original_filename: str
    content_type: Optional[str] = None
    size_bytes: int
    uploaded_by: Optional[UserResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Expenses ----
# vessel_name is optional on purpose — see models/expense.py's own
# comment: most expenses aren't about any one job, only fill it in when
# a cost should count toward Job Costing below.

class ExpenseCreate(BaseModel):
    category: str
    amount: float
    expense_date: str
    note: Optional[str] = None
    vessel_name: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: int
    category: str
    amount: float
    expense_date: str
    note: Optional[str] = None
    vessel_name: Optional[str] = None
    logged_by: Optional[UserResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Job Costing ----
# One row per distinct vessel_name that appears in either a paid
# invoice or a vessel-tagged expense — revenue and cost are summed
# independently (there's no shared foreign key between Invoice and
# Expense, just the matching vessel_name string, the same loose-match
# convention Finance already uses elsewhere) and profit is simply
# revenue - cost. Deliberately company-wide-all-time per vessel, not
# scoped to one particular visit/date — see api/routes/finance.py's
# job_costing() for why a tighter per-visit match isn't attempted.

class JobCostingRow(BaseModel):
    vessel_name: str
    revenue: float
    cost: float
    profit: float
