import io
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.invoice_pdf import (
    ACCENT,
    LINE,
    MUTED,
    NAVY,
    _FONT_BOLD,
    _FONT_NAME,
    _STYLE_BADGE,
    _STYLE_NORMAL,
    _STYLE_SECTION,
    _STYLE_SMALL,
    _STYLE_TITLE,
    _draw_watermark,
    _id_table,
    _scaled_image,
    _terms_flowables,
    letterhead_flowables,
)
from app.core.photo_storage import PHOTOS_DIR
from app.core.po_terms import DEFAULT_PO_TERMS
from app.models.notification_settings import NotificationSettings
from app.models.purchase_order import PurchaseOrder

# The purchase order as a PDF: HMZC letterhead (with registered name and
# NIF), the PO header, vendor, items, the written-by / approved-by
# signatures, the delivery address, and the standard terms on the pages
# after. Laid out after the approved PO 25-0022.

_STATUS_LABELS = {
    "draft": "DRAFT", "pending_approval": "PENDING APPROVAL", "approved": "APPROVED",
    "sent": "SENT", "received": "RECEIVED", "closed": "CLOSED", "cancelled": "CANCELLED",
}
_STATUS_COLORS = {
    "draft": MUTED, "pending_approval": colors.HexColor("#B7791F"), "approved": NAVY,
    "sent": colors.HexColor("#0E7C86"), "received": ACCENT, "closed": ACCENT,
    "cancelled": colors.HexColor("#B3382C"),
}
_STYLE_RIGHT = ParagraphStyle("PORight", parent=_STYLE_NORMAL, alignment=TA_RIGHT)
_STYLE_CENTER_SMALL = ParagraphStyle("POCenterSmall", parent=_STYLE_SMALL, alignment=TA_CENTER)


def _money(amount: float, currency: str) -> str:
    # A PO is in its own currency (no USD normalisation, unlike invoices),
    # so show the ISO code rather than guessing a symbol.
    return f"{currency} {amount:,.2f}"


def _fmt_date(d) -> str:
    return d.strftime("%d/%m/%Y") if d else "—"


def _esc(text: Optional[str]) -> str:
    if not text:
        return "—"
    return (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")).replace("\n", "<br/>")


def _signature_image(url: Optional[str]):
    """The signer's saved signature, read from the photos folder by the
    file name at the end of the URL. None when there isn't one (or the
    file is gone), in which case the box just carries the typed name."""
    if not url:
        return None
    name = url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
    if not name or "/" in name or "\\" in name or name in (".", ".."):
        return None
    path = Path(PHOTOS_DIR) / name
    if not path.is_file():
        return None
    try:
        return _scaled_image(path, 40, 14)
    except Exception:
        return None


def _signature_box(heading: str, name: Optional[str], title: Optional[str], signature_url: Optional[str], when: Optional[str] = None) -> Table:
    cells = [Paragraph(f"<b>{heading}</b>", _STYLE_NORMAL), Spacer(1, 2)]
    if name:
        sig = _signature_image(signature_url)
        cells.append(sig if sig is not None else Spacer(1, 14 * mm))
        cells.append(Paragraph(f"<b>{_esc(name)}</b>", _STYLE_NORMAL))
        cells.append(Paragraph(_esc(title) if title else "&nbsp;", _STYLE_SMALL))
        if when:
            cells.append(Paragraph(when, _STYLE_SMALL))
    else:
        cells.append(Spacer(1, 14 * mm))
        cells.append(Paragraph("<i>Awaiting approval</i>", _STYLE_SMALL))
    box = Table([[cells]], colWidths=[80 * mm])
    box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return box


def build_po_pdf(po: PurchaseOrder, company: Optional[NotificationSettings]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
        title=f"Purchase Order {po.po_no}",
    )
    story: list = []

    # ---- letterhead (shared with invoices/quotations) ----
    story.extend(letterhead_flowables(
        company,
        f"HMZC PURCHASE ORDER\nNo: {po.po_no}\nVendor: {po.vendor_name}\nTotal: {_money(po.total, po.currency)}",
    ))

    # ---- title + status ----
    badge = Table([[Paragraph(_STATUS_LABELS.get(po.status, po.status.upper()), _STYLE_BADGE)]])
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), _STATUS_COLORS.get(po.status, NAVY)),
        ("ROUNDEDCORNERS", [9, 9, 9, 9]),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    title_row = Table([[Paragraph("Purchase Order", _STYLE_TITLE), badge]], colWidths=[None, None])
    title_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (1, 0), (1, 0), 10)]))
    story.append(title_row)
    story.append(Spacer(1, 8))

    # ---- PO header ----
    story.append(_id_table([
        ("P O No.", _esc(po.po_no), "Order Date", _fmt_date(po.order_date)),
        ("Quote Ref.", _esc(po.quote_ref), "Delivery Date", _fmt_date(po.delivery_date)),
        ("Version No.", str(po.revision), "Version Date", _fmt_date(po.revision_date)),
        ("Delivery Terms", _esc(po.delivery_terms), "Job No.", _esc(po.job_no)),
    ]))
    story.append(Spacer(1, 10))

    # ---- vendor ----
    story.append(Paragraph("VENDOR", _STYLE_SECTION))
    left = [Paragraph(f"<b>{_esc(po.vendor_name)}</b>", _STYLE_NORMAL)]
    for label, value in (("VAT Number", po.vendor_vat), ("Phone", po.vendor_phone), ("Email", po.vendor_email)):
        left.append(Paragraph(f"<b>{label}:</b> {_esc(value)}", _STYLE_NORMAL))
    right = [
        Paragraph("<b>Physical Address:</b>", _STYLE_NORMAL), Paragraph(_esc(po.vendor_physical_address), _STYLE_NORMAL),
        Spacer(1, 3),
        Paragraph("<b>Postal Address:</b>", _STYLE_NORMAL), Paragraph(_esc(po.vendor_postal_address), _STYLE_NORMAL),
    ]
    vendor = Table([[left, right]], colWidths=[85 * mm, 85 * mm])
    vendor.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(vendor)

    # ---- subject ----
    if po.subject or po.quote_ref:
        story.append(Spacer(1, 8))
        if po.subject:
            story.append(Paragraph(f"<b>SUBJECT:</b> {_esc(po.subject)}", _STYLE_NORMAL))
        if po.quote_ref:
            story.append(Paragraph(f"<b>Req No:</b> {_esc(po.quote_ref)}", _STYLE_NORMAL))
    story.append(Spacer(1, 8))

    # ---- items ----
    header = [Paragraph(f"<b>{h}</b>", _STYLE_NORMAL) for h in ("Item No", "Description", "Qty Ord", "UN", "Unit Price", "Ext Price")]
    rows = [header]
    for i, li in enumerate(po.line_items or [], start=1):
        code = str(li.get("code") or "").strip()
        desc = _esc(li.get("description"))
        if code:
            desc = f"<b>{_esc(code)}</b> — {desc}"
        qty = li.get("quantity", 0)
        rows.append([
            Paragraph(str(i), _STYLE_NORMAL),
            Paragraph(desc, _STYLE_NORMAL),
            Paragraph(f"{qty:g}", _STYLE_NORMAL),
            Paragraph(_esc(li.get("unit")) if li.get("unit") else "", _STYLE_NORMAL),
            Paragraph(_money(float(li.get("unit_price", 0)), po.currency), _STYLE_RIGHT),
            Paragraph(_money(float(li.get("line_total", 0)), po.currency), _STYLE_RIGHT),
        ])
    rows.append(["", "", "", "", Paragraph(f"<b>Total {po.currency}</b>", _STYLE_RIGHT), Paragraph(f"<b>{po.total:,.2f}</b>", _STYLE_RIGHT)])
    items = Table(rows, colWidths=[40, 196, 42, 34, 85, 85], repeatRows=1)
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -2), 0.5, LINE),
        ("LINEABOVE", (4, -1), (-1, -1), 1, NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    # White header text needs the table cells to carry the colour; the
    # header Paragraphs above are plain Normal (black), so recolour them.
    for cell in header:
        cell.style = ParagraphStyle("POHead", parent=_STYLE_NORMAL, textColor=colors.white, fontName=_FONT_BOLD)
    story.append(items)
    story.append(Spacer(1, 14))

    # ---- signatures + delivery address (kept together on one page) ----
    approved_when = po.approved_at.strftime("%d/%m/%Y") if po.approved_at else None
    sigs = Table(
        [[
            _signature_box("Written / verified by:", po.written_by_name, po.written_by_title, po.written_by_signature_url),
            _signature_box("Approved by:", po.approved_by_name, po.approved_by_title, po.approved_by_signature_url, approved_when),
        ]],
        colWidths=[85 * mm, 85 * mm],
    )
    sigs.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))

    delivery_lines = [Paragraph("<b>DELIVERY ADDRESS</b>", _STYLE_NORMAL), Spacer(1, 2), Paragraph(_esc(po.delivery_address), _STYLE_NORMAL)]
    if po.delivery_contact_phone:
        delivery_lines.append(Paragraph(f"<b>Contact:</b> {_esc(po.delivery_contact_phone)}", _STYLE_NORMAL))
    if po.delivery_contact_email:
        delivery_lines.append(Paragraph(f"<b>Email:</b> {_esc(po.delivery_contact_email)}", _STYLE_NORMAL))
    delivery = Table([[delivery_lines]], colWidths=[170 * mm])
    delivery.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    block = [sigs, Spacer(1, 10), delivery]
    if po.notes:
        block += [Spacer(1, 8), Paragraph("<b>Notes</b>", _STYLE_NORMAL), Paragraph(_esc(po.notes), _STYLE_SMALL)]
    story.append(KeepTogether(block))

    # ---- standard terms, on their own page(s) ----
    terms_text = (company.po_terms_conditions if company else None) or DEFAULT_PO_TERMS
    story.append(PageBreak())
    terms = _terms_flowables(terms_text)
    story.append(KeepTogether(terms[:2]) if len(terms) >= 2 else terms[0])
    story.extend(terms[2:])

    def _decorate(canvas_obj, doc_template):
        _draw_watermark(canvas_obj, doc_template)
        canvas_obj.saveState()
        canvas_obj.setFont(_FONT_NAME, 7.5)
        canvas_obj.setFillColor(MUTED)
        canvas_obj.drawString(20 * mm, 10 * mm, f"Purchase Order {po.po_no} — Version {po.revision}")
        canvas_obj.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {doc_template.page}")
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=_decorate, onLaterPages=_decorate)
    return buf.getvalue()
