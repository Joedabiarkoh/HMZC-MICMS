import io
import zipfile
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_permission
from app.core.config import settings
from app.core.database import get_database
from app.core.file_storage import delete_upload, read_upload, save_upload
from app.core.invoice_pdf import build_document_pdf, merge_pdf_with_attachments
from app.core.permissions import FIN_CATALOG_MANAGE, FIN_DELETE, FIN_EDIT, FIN_VIEW
from app.models.expense import Expense
from app.models.finance_attachment import InvoiceAttachment
from app.models.finance_document import Invoice, Quotation
from app.models.finance_item import FinanceItem
from app.models.notification_settings import get_notification_settings
from app.models.user import User
from app.schemas.finance import (
    DashboardSummary,
    ExpenseCreate,
    ExpenseResponse,
    FinanceItemCreate,
    FinanceItemResponse,
    FinanceItemUpdate,
    InvoiceAttachmentResponse,
    InvoiceCreate,
    InvoiceResponse,
    JobCostingRow,
    MonthlyRevenuePoint,
    QuotationCreate,
    QuotationResponse,
    RecentTransaction,
)

router = APIRouter(tags=["finance"])


def _get_invoice_or_404(invoice_no: str, db: Session) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.invoice_no == invoice_no).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return invoice


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


# `:path` (not the plain `{quotation_no}`/`{invoice_no}` used to be
# used everywhere below) — found while testing the new invoice
# attachments feature: quotation_no/invoice_no always contain literal
# "/" (e.g. "INV/HMZC/20260801-001"), and FastAPI's default path
# converter can't match an embedded slash even URL-encoded as %2F —
# Starlette decodes the path before routing, then splits on "/", so a
# %2F-encoded invoice_no was silently splitting across path segments
# and 404ing at the router level, before ever reaching this function.
# This was a real, pre-existing bug (delete never worked for a real
# invoice/quotation number), not something new — fixed here since the
# new attachment routes below inherit the exact same broken pattern.
@router.delete("/quotations/{quotation_no:path}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quotation(quotation_no: str, db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_DELETE))):
    q = db.query(Quotation).filter(Quotation.quotation_no == quotation_no).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    db.delete(q)
    db.commit()


@router.get("/quotations/{quotation_no:path}/pdf")
def download_quotation_pdf(
    quotation_no: str,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_VIEW)),
):
    q = db.query(Quotation).options(joinedload(Quotation.issued_by)).filter(Quotation.quotation_no == quotation_no).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    company = get_notification_settings(db)
    pdf_bytes = build_document_pdf(q, "QUOTATION", company)
    safe_no = quotation_no.replace("/", "_")
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_no}.pdf"'},
    )


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
        existing.conditions = inv_in.conditions
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
        conditions=inv_in.conditions,
        issued_by_id=current_user.id,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


# ============================================================
# Invoice supporting documents — requested directly: "allow other
# supporting document to be uploaded and save or send all together like
# service report, PO, delivery note and any additional supporting
# document". No in-app email exists for invoices today (issuing one
# just flips its status — see save_invoice above; "Print" is the
# browser's own print dialog, no server-side PDF), so "together" is a
# download-all zip bundle here rather than a new outbound-email feature.
# ============================================================

@router.get("/invoices/{invoice_no:path}/attachments", response_model=List[InvoiceAttachmentResponse])
def list_invoice_attachments(
    invoice_no: str,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_VIEW)),
):
    invoice = _get_invoice_or_404(invoice_no, db)
    return (
        db.query(InvoiceAttachment)
        .options(joinedload(InvoiceAttachment.uploaded_by))
        .filter(InvoiceAttachment.invoice_id == invoice.id)
        .order_by(InvoiceAttachment.created_at.desc())
        .all()
    )


@router.post("/invoices/{invoice_no:path}/attachments", response_model=InvoiceAttachmentResponse, status_code=status.HTTP_201_CREATED)
def upload_invoice_attachment(
    invoice_no: str,
    file: UploadFile = File(...),
    label: str = Form("Other"),
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_EDIT)),
):
    invoice = _get_invoice_or_404(invoice_no, db)
    raw = file.file.read()
    stored_filename = save_upload(file, settings.ATTACHMENTS_DIR, raw)
    attachment = InvoiceAttachment(
        invoice_id=invoice.id,
        label=label.strip() or "Other",
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        content_type=file.content_type,
        size_bytes=len(raw),
        uploaded_by_id=current_user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def _get_attachment_or_404(invoice_no: str, attachment_id: int, db: Session) -> InvoiceAttachment:
    invoice = _get_invoice_or_404(invoice_no, db)
    attachment = (
        db.query(InvoiceAttachment)
        .filter(InvoiceAttachment.id == attachment_id, InvoiceAttachment.invoice_id == invoice.id)
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return attachment


@router.get("/invoices/{invoice_no:path}/attachments/{attachment_id}/download")
def download_invoice_attachment(
    invoice_no: str,
    attachment_id: int,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_VIEW)),
):
    attachment = _get_attachment_or_404(invoice_no, attachment_id, db)
    raw = read_upload(settings.ATTACHMENTS_DIR, attachment.stored_filename)
    return StreamingResponse(
        io.BytesIO(raw),
        media_type=attachment.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{attachment.original_filename}"'},
    )


@router.get("/invoices/{invoice_no:path}/attachments/download-all")
def download_all_invoice_attachments(
    invoice_no: str,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_VIEW)),
):
    invoice = _get_invoice_or_404(invoice_no, db)
    attachments = db.query(InvoiceAttachment).filter(InvoiceAttachment.invoice_id == invoice.id).all()
    if not attachments:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No supporting documents have been uploaded for this invoice.")

    buffer = io.BytesIO()
    # Dedupe same-name files (two different uploads both called
    # "PO.pdf") by prefixing the attachment id — better than silently
    # overwriting one inside the zip.
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for a in attachments:
            raw = read_upload(settings.ATTACHMENTS_DIR, a.stored_filename)
            zf.writestr(f"{a.id}_{a.original_filename}", raw)
    buffer.seek(0)

    safe_no = invoice_no.replace("/", "_")
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_no}_attachments.zip"'},
    )


# Requested directly: "serve all the invoice and the added documents as
# pdf all together in one document or print it" — builds the invoice
# itself as a PDF (core/invoice_pdf.py), then merges every supporting
# document onto the end of it (PDFs appended page-for-page, images
# converted to a page, anything else gets a one-page notice instead —
# see merge_pdf_with_attachments's own comment on why). `with_attachments`
# defaults true since "all together" was the actual ask; set to false
# for just the invoice itself with no merging.
@router.get("/invoices/{invoice_no:path}/pdf")
def download_invoice_pdf(
    invoice_no: str,
    with_attachments: bool = True,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_VIEW)),
):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.issued_by))
        .filter(Invoice.invoice_no == invoice_no)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    company = get_notification_settings(db)
    pdf_bytes = build_document_pdf(invoice, "INVOICE", company)

    if with_attachments:
        attachments = db.query(InvoiceAttachment).filter(InvoiceAttachment.invoice_id == invoice.id).all()
        if attachments:
            payloads = [
                (read_upload(settings.ATTACHMENTS_DIR, a.stored_filename), a.content_type, a.original_filename)
                for a in attachments
            ]
            pdf_bytes = merge_pdf_with_attachments(pdf_bytes, payloads)

    safe_no = invoice_no.replace("/", "_")
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_no}.pdf"'},
    )


@router.delete("/invoices/{invoice_no:path}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice_attachment(
    invoice_no: str,
    attachment_id: int,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_EDIT)),
):
    attachment = _get_attachment_or_404(invoice_no, attachment_id, db)
    delete_upload(settings.ATTACHMENTS_DIR, attachment.stored_filename)
    db.delete(attachment)
    db.commit()


# `DELETE /invoices/{invoice_no:path}` has to be registered AFTER every
# .../attachments/... route above, not just after the invoice CRUD
# routes it's grouped with elsewhere in this file — a bare trailing
# `:path` converter (nothing after `{invoice_no}` in this route's own
# template) matches the rest of ANY path starting with "/invoices/",
# including "/invoices/X/attachments/1". Starlette tries routes in
# registration order and stops at the first match, so with this
# declared first (as it originally was, grouped with save_invoice/
# list_invoices above), every attachment sub-route was being swallowed
# by this one instead — attachment_id got folded into invoice_no, the
# lookup failed, and every attachment route 404'd with "Invoice not
# found". Found by actually calling DELETE .../attachments/{id} while
# testing, not by inspection — the analogous GET/POST routes above
# happen to not collide since there's no bare `GET /invoices/{invoice_no:path}`
# route for them to lose to, so only DELETE was actually broken by this.
@router.delete("/invoices/{invoice_no:path}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(invoice_no: str, db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_DELETE))):
    inv = db.query(Invoice).filter(Invoice.invoice_no == invoice_no).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    # Found while testing the new PDF feature: deleting an invoice that
    # had attachments crashed with an uncaught ForeignKeyViolation (500)
    # — invoice_attachments.invoice_id isn't ON DELETE CASCADE, and
    # nothing removed the child rows/files first. Same cleanup-before-
    # delete pattern delete_boarding_submission and certificate deletion
    # already use elsewhere in this app.
    attachments = db.query(InvoiceAttachment).filter(InvoiceAttachment.invoice_id == inv.id).all()
    for a in attachments:
        delete_upload(settings.ATTACHMENTS_DIR, a.stored_filename)
        db.delete(a)
    db.delete(inv)
    db.commit()


# ============================================================
# Expenses — a simple company-wide ledger (see models/expense.py).
# No version/optimistic-concurrency check like quotations/invoices:
# expenses are simple log entries, not collaboratively-edited documents
# someone else might be mid-edit on when a second save comes in.
# ============================================================

@router.get("/expenses", response_model=List[ExpenseResponse])
def list_expenses(db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    return (
        db.query(Expense)
        .options(joinedload(Expense.logged_by))
        .order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        .all()
    )


@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_EDIT)),
):
    expense = Expense(
        category=expense_in.category,
        amount=expense_in.amount,
        expense_date=expense_in.expense_date,
        note=expense_in.note,
        vessel_name=expense_in.vessel_name,
        logged_by_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_DELETE))):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    db.delete(expense)
    db.commit()


# ============================================================
# Job Costing — profit per vessel, matched by vessel_name string
# (see JobCostingRow's own comment on why this is loose, company-wide,
# all-time matching rather than a tight per-visit join). Revenue is
# paid-invoice totals only, the same definition Dashboard's own
# `revenue` figure already uses, so the two stay consistent with each
# other rather than defining "revenue" two different ways in one app.
# ============================================================

@router.get("/job-costing", response_model=List[JobCostingRow])
def job_costing(db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    invoices = db.query(Invoice).filter(Invoice.status == "paid").all()
    expenses = db.query(Expense).filter(Expense.vessel_name.isnot(None), Expense.vessel_name != "").all()

    revenue_by_vessel: dict[str, float] = {}
    for inv in invoices:
        if inv.vessel_name:
            revenue_by_vessel[inv.vessel_name] = revenue_by_vessel.get(inv.vessel_name, 0) + inv.total

    cost_by_vessel: dict[str, float] = {}
    for exp in expenses:
        cost_by_vessel[exp.vessel_name] = cost_by_vessel.get(exp.vessel_name, 0) + exp.amount

    vessel_names = set(revenue_by_vessel) | set(cost_by_vessel)
    rows = [
        JobCostingRow(
            vessel_name=name,
            revenue=revenue_by_vessel.get(name, 0),
            cost=cost_by_vessel.get(name, 0),
            profit=revenue_by_vessel.get(name, 0) - cost_by_vessel.get(name, 0),
        )
        for name in vessel_names
    ]
    rows.sort(key=lambda r: r.profit)
    return rows
