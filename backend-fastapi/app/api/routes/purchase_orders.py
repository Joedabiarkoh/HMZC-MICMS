import io
from datetime import date, datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_permission
from app.api.routes.finance import _apply_versioned_update, _check_version
from app.core.audit import record_audit
from app.core.config import settings
from app.core.database import get_database
from app.core.file_storage import delete_upload, read_upload, save_upload
from app.core.invoice_pdf import merge_pdf_with_attachments
from app.core.permissions import FIN_DELETE, FIN_EDIT, FIN_PO_APPROVE, FIN_VIEW, get_user_permissions
from app.core.po_pdf import build_po_pdf
from app.models.notification_settings import get_notification_settings
from app.models.purchase_order import PurchaseOrder, PurchaseOrderAttachment
from app.models.supplier_boarding import SupplierBoardingSubmission
from app.models.user import User, UserRole
from app.schemas.purchase_order import (
    POAttachmentResponse,
    POTransition,
    POVendorSuggestion,
    PurchaseOrderResponse,
    PurchaseOrderSave,
)

router = APIRouter(tags=["purchase-orders"])

# Statuses in which the PO can still be changed. An approved/sent PO can be
# changed too, but doing so cancels the approval (see save_purchase_order).
_EDITABLE = ("draft", "pending_approval", "approved", "sent")
_OPEN_FOR_DELIVERY = ("approved", "sent")


# ---------------------------------------------------------------- helpers

def _get_po_or_404(po_no: str, db: Session) -> PurchaseOrder:
    po = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.written_by), joinedload(PurchaseOrder.approved_by))
        .filter(PurchaseOrder.po_no == po_no)
        .first()
    )
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return po


def _is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def _can_edit(po: PurchaseOrder, user: User) -> bool:
    # Same rule as quotations/invoices: an administrator, or whoever wrote it.
    return _is_admin(user) or po.written_by_id == user.id


def _can_approve(user: User) -> bool:
    return FIN_PO_APPROVE in get_user_permissions(user)


def _present(po: PurchaseOrder, attachment_count: int = 0) -> PurchaseOrderResponse:
    out = PurchaseOrderResponse.model_validate(po)
    out.attachment_count = attachment_count
    out.is_overdue = bool(po.status in _OPEN_FOR_DELIVERY and po.delivery_date and po.delivery_date < date.today())
    return out


def _attachment_counts(db: Session, ids: List[int]) -> Dict[int, int]:
    if not ids:
        return {}
    rows = (
        db.query(PurchaseOrderAttachment.purchase_order_id, func.count(PurchaseOrderAttachment.id))
        .filter(PurchaseOrderAttachment.purchase_order_id.in_(ids))
        .group_by(PurchaseOrderAttachment.purchase_order_id)
        .all()
    )
    return {pid: n for pid, n in rows}


def _next_po_no(db: Session) -> str:
    """YY-NNNN, numbered per calendar year (e.g. 26-0001). Reads the highest
    existing number for the year, so a hand-entered legacy number such as
    25-0022 is continued from rather than clashed with."""
    prefix = datetime.now(timezone.utc).strftime("%y") + "-"
    last = 0
    for (existing,) in db.query(PurchaseOrder.po_no).filter(PurchaseOrder.po_no.like(f"{prefix}%")).all():
        tail = existing[len(prefix):]
        if tail.isdigit():
            last = max(last, int(tail))
    return f"{prefix}{last + 1:04d}"


def _verify_totals(body: PurchaseOrderSave) -> None:
    """Same idea as finance_totals.verify_document_totals for invoices:
    never trust totals sent by a client - recompute them from the lines."""
    if not body.line_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add at least one line item.")
    subtotal = 0.0
    for i, li in enumerate(body.line_items, start=1):
        if li.quantity <= 0 or li.unit_price < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Line {i}: quantity must be above zero and price cannot be negative.")
        expected = round(li.quantity * li.unit_price, 2)
        if abs(expected - li.line_total) > 0.01:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Line {i}: the line total doesn't match quantity x unit price.")
        subtotal += expected
    subtotal = round(subtotal, 2)
    if abs(subtotal - body.subtotal) > 0.01 or abs(subtotal - body.total) > 0.01:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The PO total doesn't match its line items.")


def _fields(body: PurchaseOrderSave) -> dict:
    def clean(v):
        v = (v or "").strip()
        return v or None

    return dict(
        order_date=body.order_date,
        delivery_date=body.delivery_date,
        delivery_terms=clean(body.delivery_terms),
        quote_ref=clean(body.quote_ref),
        subject=clean(body.subject),
        job_no=clean(body.job_no),
        vendor_name=body.vendor_name,
        vendor_vat=clean(body.vendor_vat),
        vendor_phone=clean(body.vendor_phone),
        vendor_email=clean(body.vendor_email),
        vendor_physical_address=clean(body.vendor_physical_address),
        vendor_postal_address=clean(body.vendor_postal_address),
        delivery_address=clean(body.delivery_address),
        delivery_contact_phone=clean(body.delivery_contact_phone),
        delivery_contact_email=clean(body.delivery_contact_email),
        currency=body.currency,
        line_items=[li.model_dump() for li in body.line_items],
        subtotal=round(body.subtotal, 2),
        total=round(body.total, 2),
        notes=clean(body.notes),
    )


def _display_name(user: User) -> str:
    return user.full_name or user.email


# ------------------------------------------------------------------- list

@router.get("", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    rows = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.written_by), joinedload(PurchaseOrder.approved_by))
        .order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc())
        .all()
    )
    counts = _attachment_counts(db, [r.id for r in rows])
    return [_present(r, counts.get(r.id, 0)) for r in rows]


@router.get("/vendors", response_model=List[POVendorSuggestion])
def list_vendor_suggestions(db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    """Vendors to pick from when raising a PO. Supplier Boarding only keeps
    the supplier's name and their filled-in form, not structured contact
    details, so details come from the most recent PO to the same vendor;
    a boarded supplier with no PO yet is offered by name alone."""
    suggestions: Dict[str, POVendorSuggestion] = {}
    for po in db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc()).all():
        key = po.vendor_name.strip().lower()
        if key in suggestions:
            continue
        suggestions[key] = POVendorSuggestion(
            name=po.vendor_name,
            source="purchase_order",
            vat=po.vendor_vat,
            phone=po.vendor_phone,
            email=po.vendor_email,
            physical_address=po.vendor_physical_address,
            postal_address=po.vendor_postal_address,
            currency=po.currency,
        )
    for (name,) in db.query(SupplierBoardingSubmission.supplier_name).distinct().all():
        key = (name or "").strip().lower()
        if key and key not in suggestions:
            suggestions[key] = POVendorSuggestion(name=name.strip(), source="supplier_boarding")
    return sorted(suggestions.values(), key=lambda s: s.name.lower())


@router.get("/{po_no}", response_model=PurchaseOrderResponse)
def get_purchase_order(po_no: str, db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    po = _get_po_or_404(po_no, db)
    return _present(po, _attachment_counts(db, [po.id]).get(po.id, 0))


# ------------------------------------------------------------ create/save

@router.post("", response_model=PurchaseOrderResponse)
def save_purchase_order(
    body: PurchaseOrderSave,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_EDIT)),
):
    _verify_totals(body)
    values = _fields(body)
    requested_no = (body.po_no or "").strip()

    existing = db.query(PurchaseOrder).filter(PurchaseOrder.po_no == requested_no).first() if requested_no else None

    if existing:
        if not _can_edit(existing, current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an Administrator or the person who wrote this PO can edit it.")
        if existing.status not in _EDITABLE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"A {existing.status.replace('_', ' ')} purchase order can't be edited.")
        _check_version(existing.version, body.version, "purchase order")

        previous_status = existing.status
        changes = dict(values)
        if body.written_by_title is not None:
            changes["written_by_title"] = (body.written_by_title or "").strip() or None
        if previous_status != "draft":
            # Any change to a PO that was already submitted/approved/sent
            # sends it back to draft and wipes the approval, so what was
            # approved is always what is on the page. An approved or sent
            # PO also gets a new revision number ("Version No" on the print).
            changes.update(
                status="draft",
                submitted_at=None,
                approved_by_id=None, approved_by_name=None, approved_by_title=None,
                approved_by_signature_url=None, approved_at=None,
                sent_at=None, return_reason=None,
            )
            if previous_status in ("approved", "sent"):
                changes.update(revision=existing.revision + 1, revision_date=date.today())
        _apply_versioned_update(db, PurchaseOrder, PurchaseOrder.po_no == existing.po_no, existing.version, changes, "purchase order")
        db.commit()
        if previous_status != "draft":
            record_audit(db, request, "purchase_order.edited_after_submit", user_id=current_user.id,
                         resource_type="purchase_order", resource_id=existing.po_no,
                         detail=f"was {previous_status}; approval cleared")
        db.refresh(existing)
        return _present(existing, _attachment_counts(db, [existing.id]).get(existing.id, 0))

    if requested_no:
        if "/" in requested_no or len(requested_no) > 40:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PO numbers can't contain '/' or be longer than 40 characters.")
        po_no = requested_no
    else:
        po_no = _next_po_no(db)

    po = PurchaseOrder(
        po_no=po_no,
        status="draft",
        revision=1,
        revision_date=date.today(),
        written_by_id=current_user.id,
        written_by_name=_display_name(current_user),
        written_by_title=(body.written_by_title or "").strip() or None,
        written_by_signature_url=current_user.saved_signature_url,
        **values,
    )
    if po.order_date is None:
        po.order_date = date.today()
    db.add(po)
    db.commit()
    db.refresh(po)
    record_audit(db, request, "purchase_order.created", user_id=current_user.id,
                 resource_type="purchase_order", resource_id=po.po_no, detail=f"{po.vendor_name} - {po.currency} {po.total:,.2f}")
    return _present(po, 0)


# ------------------------------------------------------------ transitions

def _bad(detail: str, code: int = status.HTTP_400_BAD_REQUEST):
    raise HTTPException(status_code=code, detail=detail)


@router.post("/{po_no}/transition", response_model=PurchaseOrderResponse)
def transition_purchase_order(
    po_no: str,
    body: POTransition,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_EDIT)),
):
    """Moves a PO along its life: submit -> approve -> send -> receive ->
    close, with return (approver sends it back) and cancel as side exits."""
    po = _get_po_or_404(po_no, db)
    _check_version(po.version, body.version, "purchase order")
    now = datetime.now(timezone.utc)
    action = body.action
    reason = (body.reason or "").strip()
    values: dict = {}

    if action == "submit":
        if not _can_edit(po, current_user):
            _bad("Only an Administrator or the person who wrote this PO can submit it.", 403)
        if po.status != "draft":
            _bad("Only a draft can be submitted for approval.")
        values = dict(status="pending_approval", submitted_at=now, return_reason=None)

    elif action in ("approve", "return"):
        if not _can_approve(current_user):
            _bad("Approving a purchase order requires the 'finance.po_approve' permission.", 403)
        if po.status != "pending_approval":
            _bad("Only a PO that is waiting for approval can be approved or returned.")
        if action == "return":
            if not reason:
                _bad("Say why it's being returned, so the writer knows what to fix.")
            values = dict(status="draft", return_reason=reason, submitted_at=None)
        else:
            # The writer can't approve their own PO - that defeats the point
            # of a second signature. An administrator may (small teams, and
            # the director often both writes and approves), and it is
            # written to the audit log.
            if po.written_by_id == current_user.id and not _is_admin(current_user):
                _bad("You wrote this PO, so someone else has to approve it.", 403)
            title = (body.title or "").strip()
            if not title:
                _bad("Enter your position (for example 'Director Manager'); it prints under your signature.")
            values = dict(
                status="approved", approved_at=now, return_reason=None,
                approved_by_id=current_user.id, approved_by_name=_display_name(current_user),
                approved_by_title=title, approved_by_signature_url=current_user.saved_signature_url,
            )

    elif action == "send":
        if po.status != "approved":
            _bad("Only an approved PO can be marked as sent to the vendor.")
        values = dict(status="sent", sent_at=now)

    elif action == "receive":
        if po.status not in ("approved", "sent"):
            _bad("Only an approved or sent PO can be marked as received.")
        values = dict(status="received", received_at=body.received_date or date.today(),
                      sent_at=po.sent_at or now)

    elif action == "close":
        if po.status != "received":
            _bad("Only a received PO can be closed.")
        values = dict(status="closed", closed_at=now)

    elif action == "cancel":
        if po.status in ("closed", "cancelled", "received"):
            _bad(f"A {po.status} purchase order can't be cancelled.")
        if po.status in ("approved", "sent"):
            if not (_is_admin(current_user) or _can_approve(current_user)):
                _bad("Cancelling an approved PO needs an approver or an Administrator.", 403)
        elif not _can_edit(po, current_user):
            _bad("Only an Administrator or the person who wrote this PO can cancel it.", 403)
        if not reason:
            _bad("Say why the PO is being cancelled.")
        values = dict(status="cancelled", cancelled_at=now, cancel_reason=reason)

    _apply_versioned_update(db, PurchaseOrder, PurchaseOrder.po_no == po.po_no, po.version, values, "purchase order")
    db.commit()
    record_audit(db, request, f"purchase_order.{action}", user_id=current_user.id,
                 resource_type="purchase_order", resource_id=po.po_no,
                 detail=reason or None)
    db.refresh(po)
    return _present(po, _attachment_counts(db, [po.id]).get(po.id, 0))


# ----------------------------------------------------------------- delete

@router.delete("/{po_no}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(
    po_no: str,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_DELETE)),
):
    po = _get_po_or_404(po_no, db)
    # A PO that was approved/sent/received is a record of a commitment -
    # it's cancelled, not deleted. Only an abandoned draft (or an already
    # cancelled PO) can go.
    if po.status not in ("draft", "cancelled"):
        _bad("Only a draft or cancelled purchase order can be deleted. Cancel it instead.")
    for att in db.query(PurchaseOrderAttachment).filter(PurchaseOrderAttachment.purchase_order_id == po.id).all():
        delete_upload(settings.ATTACHMENTS_DIR, att.stored_filename)
        db.delete(att)
    db.delete(po)
    db.commit()
    record_audit(db, request, "purchase_order.deleted", user_id=current_user.id, resource_type="purchase_order", resource_id=po_no)


# -------------------------------------------------------------------- pdf

@router.get("/{po_no}/pdf")
def download_po_pdf(
    po_no: str,
    with_attachments: bool = False,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(FIN_VIEW)),
):
    po = _get_po_or_404(po_no, db)
    company = get_notification_settings(db)
    pdf_bytes = build_po_pdf(po, company)
    if with_attachments:
        atts = db.query(PurchaseOrderAttachment).filter(PurchaseOrderAttachment.purchase_order_id == po.id).order_by(PurchaseOrderAttachment.id).all()
        pdf_bytes = merge_pdf_with_attachments(
            pdf_bytes,
            [(read_upload(settings.ATTACHMENTS_DIR, a.stored_filename), a.content_type, a.original_filename) for a in atts],
        )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="PO-{po.po_no}.pdf"'},
    )


# ------------------------------------------------------------ attachments

@router.get("/{po_no}/attachments", response_model=List[POAttachmentResponse])
def list_po_attachments(po_no: str, db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    po = _get_po_or_404(po_no, db)
    return (
        db.query(PurchaseOrderAttachment)
        .options(joinedload(PurchaseOrderAttachment.uploaded_by))
        .filter(PurchaseOrderAttachment.purchase_order_id == po.id)
        .order_by(PurchaseOrderAttachment.created_at.desc(), PurchaseOrderAttachment.id.desc())
        .all()
    )


@router.post("/{po_no}/attachments", response_model=POAttachmentResponse, status_code=status.HTTP_201_CREATED)
def upload_po_attachment(
    po_no: str,
    file: UploadFile = File(...),
    label: str = Form("Other"),
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_EDIT)),
):
    po = _get_po_or_404(po_no, db)
    if not _can_edit(po, current_user):
        _bad("Only an Administrator or the person who wrote this PO can add documents to it.", 403)
    raw = file.file.read()
    stored = save_upload(file, settings.ATTACHMENTS_DIR, raw)
    att = PurchaseOrderAttachment(
        purchase_order_id=po.id,
        label=label.strip() or "Other",
        original_filename=file.filename or stored,
        stored_filename=stored,
        content_type=file.content_type,
        size_bytes=len(raw),
        uploaded_by_id=current_user.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


def _get_attachment_or_404(po_no: str, attachment_id: int, db: Session) -> PurchaseOrderAttachment:
    po = _get_po_or_404(po_no, db)
    att = (
        db.query(PurchaseOrderAttachment)
        .filter(PurchaseOrderAttachment.id == attachment_id, PurchaseOrderAttachment.purchase_order_id == po.id)
        .first()
    )
    if not att:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return att


@router.get("/{po_no}/attachments/{attachment_id}/download")
def download_po_attachment(po_no: str, attachment_id: int, db: Session = Depends(get_database), _user: User = Depends(require_permission(FIN_VIEW))):
    att = _get_attachment_or_404(po_no, attachment_id, db)
    raw = read_upload(settings.ATTACHMENTS_DIR, att.stored_filename)
    return StreamingResponse(
        io.BytesIO(raw),
        media_type=att.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{att.original_filename}"'},
    )


@router.delete("/{po_no}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_po_attachment(
    po_no: str,
    attachment_id: int,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(FIN_EDIT)),
):
    po = _get_po_or_404(po_no, db)
    if not _can_edit(po, current_user):
        _bad("Only an Administrator or the person who wrote this PO can remove its documents.", 403)
    att = _get_attachment_or_404(po_no, attachment_id, db)
    delete_upload(settings.ATTACHMENTS_DIR, att.stored_filename)
    db.delete(att)
    db.commit()
