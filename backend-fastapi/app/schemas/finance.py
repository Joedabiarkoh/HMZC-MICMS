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
