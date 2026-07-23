from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_permission
from app.core.database import get_database
from app.core.permissions import FIN_CATALOG_MANAGE, FIN_DELETE, FIN_EDIT, FIN_VIEW
from app.models.finance_document import Invoice, Quotation
from app.models.finance_item import FinanceItem
from app.models.user import User
from app.schemas.finance import (
    DashboardSummary,
    FinanceItemCreate,
    FinanceItemResponse,
    FinanceItemUpdate,
    InvoiceCreate,
    InvoiceResponse,
    MonthlyRevenuePoint,
    QuotationCreate,
    QuotationResponse,
    RecentTransaction,
)

router = APIRouter(tags=["finance"])


# ============================================================
# Dashboard — computed from real Invoice/Quotation rows, not sample data.
# ============================================================

@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard(
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_VIEW)),
):
    invoices = db.query(Invoice).all()
    quotations = db.query(Quotation).all()

    revenue = sum(inv.total for inv in invoices if inv.status == "paid")
    outstanding = sum(inv.total for inv in invoices if inv.status == "issued")
    pending_quotations = sum(1 for q in quotations if q.status in ("draft", "sent"))

    # Last 6 calendar months, oldest first, revenue = paid invoices issued
    # (created) in that month. "cost" is always 0 — see the schema's
    # comment on why profit_margin isn't fabricated from it.
    now = datetime.now(timezone.utc)
    months: List[MonthlyRevenuePoint] = []
    for i in range(5, -1, -1):
        # (year, month) key i months back from the current month.
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        label = datetime(year, month, 1).strftime("%b %Y")
        month_revenue = sum(
            inv.total for inv in invoices
            if inv.status == "paid" and inv.created_at and inv.created_at.year == year and inv.created_at.month == month
        )
        months.append(MonthlyRevenuePoint(month=label, revenue=month_revenue, cost=0))

    recent = sorted(invoices, key=lambda i: i.created_at or now, reverse=True)[:5]
    recent_transactions = [
        RecentTransaction(id=inv.invoice_no, description=f"Invoice {inv.invoice_no} — {inv.customer}", amount=inv.total)
        for inv in recent
    ]

    return DashboardSummary(
        revenue=revenue,
        outstanding=outstanding,
        pending_quotations=pending_quotations,
        profit_margin=None,
        monthly=months,
        recent_transactions=recent_transactions,
    )


# ============================================================
# Item catalog — "the items provided with the cost ... a list
# with associated id or code". Admin-managed; read access is any
# signed-in Finance/Admin user (they need to search it while building an
# invoice), not public — this is a backend price list, not a services
# page. Soft-deleted via is_active rather than removed outright, so an
# old invoice's line items (which snapshot code/description/price at the
# time, not a live reference) still mean the same thing years later even
# if the catalog entry is later retired.
# ============================================================

@router.get("/items", response_model=List[FinanceItemResponse])
def list_finance_items(
    include_inactive: bool = False,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_VIEW)),
):
    q = db.query(FinanceItem)
    if not include_inactive:
        q = q.filter(FinanceItem.is_active.is_(True))
    return q.order_by(FinanceItem.code).all()


@router.post("/items", response_model=FinanceItemResponse, status_code=status.HTTP_201_CREATED)
def create_finance_item(
    item_in: FinanceItemCreate,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_CATALOG_MANAGE)),
):
    existing = db.query(FinanceItem).filter(FinanceItem.code == item_in.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Item code '{item_in.code}' already exists")
    item = FinanceItem(**item_in.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=FinanceItemResponse)
def update_finance_item(
    item_id: int,
    item_in: FinanceItemUpdate,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_CATALOG_MANAGE)),
):
    item = db.query(FinanceItem).filter(FinanceItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    for field, value in item_in.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


# ============================================================
# Shared helper for quotations and invoices — same upsert +
# optimistic-concurrency pattern as certificates.py's save_certificate.
# ============================================================

def _check_version(existing_version: int, incoming_version: int | None, kind: str):
    if incoming_version is not None and incoming_version != existing_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This {kind} was updated by someone else since you opened it. Reload it and re-apply your changes.",
        )


def _can_edit(record_issued_by_id: int | None, current_user: User) -> bool:
    # Admins can edit any finance record; a Finance-role user can edit
    # their own. Matches the "admin must have power to work on the
    # invoice and quotation" requirement without also letting any
    # Finance user silently rewrite someone else's issued invoice.
    return current_user.role == "admin" or record_issued_by_id == current_user.id


# ============================================================
# Quotations
# ============================================================

@router.get("/quotations", response_model=List[QuotationResponse])
def list_quotations(db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    return (
        db.query(Quotation)
        .options(joinedload(Quotation.issued_by))
        .order_by(Quotation.created_at.desc())
        .all()
    )


@router.post("/quotations", response_model=QuotationResponse)
def save_quotation(
    q_in: QuotationCreate,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_EDIT)),
):
    existing = db.query(Quotation).filter(Quotation.quotation_no == q_in.quotation_no).first()
    if existing:
        if not _can_edit(existing.issued_by_id, current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an Administrator or the original issuer can edit this quotation.")
        _check_version(existing.version, q_in.version, "quotation")
        existing.customer = q_in.customer
        existing.vessel_name = q_in.vessel_name
        existing.imo_no = q_in.imo_no
        existing.status = q_in.status
        existing.line_items = [li.model_dump() for li in q_in.line_items]
        existing.subtotal = q_in.subtotal
        existing.discount_total = q_in.discount_total
        existing.total = q_in.total
        existing.version += 1
        db.commit()
        db.refresh(existing)
        return existing

    quotation = Quotation(
        quotation_no=q_in.quotation_no,
        customer=q_in.customer,
        vessel_name=q_in.vessel_name,
        imo_no=q_in.imo_no,
        status=q_in.status,
        line_items=[li.model_dump() for li in q_in.line_items],
        subtotal=q_in.subtotal,
        discount_total=q_in.discount_total,
        total=q_in.total,
        issued_by_id=current_user.id,
    )
    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    return quotation


@router.delete("/quotations/{quotation_no}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quotation(quotation_no: str, db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_DELETE))):
    q = db.query(Quotation).filter(Quotation.quotation_no == quotation_no).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    db.delete(q)
    db.commit()


# ============================================================
# Invoices
# ============================================================

@router.get("/invoices", response_model=List[InvoiceResponse])
def list_invoices(db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    return (
        db.query(Invoice)
        .options(joinedload(Invoice.issued_by))
        .order_by(Invoice.created_at.desc())
        .all()
    )


@router.post("/invoices", response_model=InvoiceResponse)
def save_invoice(
    inv_in: InvoiceCreate,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_EDIT)),
):
    existing = db.query(Invoice).filter(Invoice.invoice_no == inv_in.invoice_no).first()
    if existing:
        if not _can_edit(existing.issued_by_id, current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an Administrator or the original issuer can edit this invoice.")
        _check_version(existing.version, inv_in.version, "invoice")
        existing.quotation_id = inv_in.quotation_id
        existing.customer = inv_in.customer
        existing.vessel_name = inv_in.vessel_name
        existing.imo_no = inv_in.imo_no
        existing.status = inv_in.status
        existing.line_items = [li.model_dump() for li in inv_in.line_items]
        existing.subtotal = inv_in.subtotal
        existing.discount_total = inv_in.discount_total
        existing.total = inv_in.total
        existing.version += 1
        db.commit()
        db.refresh(existing)
        return existing

    invoice = Invoice(
        invoice_no=inv_in.invoice_no,
        quotation_id=inv_in.quotation_id,
        customer=inv_in.customer,
        vessel_name=inv_in.vessel_name,
        imo_no=inv_in.imo_no,
        status=inv_in.status,
        line_items=[li.model_dump() for li in inv_in.line_items],
        subtotal=inv_in.subtotal,
        discount_total=inv_in.discount_total,
        total=inv_in.total,
        issued_by_id=current_user.id,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete("/invoices/{invoice_no}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(invoice_no: str, db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_DELETE))):
    inv = db.query(Invoice).filter(Invoice.invoice_no == invoice_no).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    db.delete(inv)
    db.commit()
