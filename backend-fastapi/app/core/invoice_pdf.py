import io
from pathlib import Path
from typing import Optional

import qrcode
from PIL import Image as PILImage
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image as RLImage,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.notification_settings import NotificationSettings

# Requested directly: "the invoice command to give include to serve all
# the invoice and the added documents as pdf all together in one
# document or print it" — this builds the invoice/quotation itself as a
# real PDF (reportlab, already a project dependency — no new system
# packages needed, unlike an HTML-to-PDF renderer like WeasyPrint would
# have required), then api/routes/finance.py's PDF endpoint merges it
# with every uploaded supporting document (pypdf) into one file.
#
# Deliberately hand-built with reportlab's platypus flowables rather
# than trying to pixel-match FinanceDocumentPreview.tsx's HTML/CSS —
# it's the same information in the same order (letterhead, ID table,
# line items, totals, bank details, T&C, footer), not a literal
# rendering of that component. Good enough for "here is the invoice as
# one PDF, with its attachments," which is what was actually asked for.

NAVY = colors.HexColor("#1F3B5C")
TEAL = colors.HexColor("#0E7C86")  # --insp-teal — quotation status badge color, matching .insp-badge on screen
MUTED = colors.HexColor("#6B7480")
LINE = colors.HexColor("#DCE1E5")
# Same --insp-accent (--insp-green) used for the letterhead's
# border-bottom everywhere else in the app (theme.css/inspections.css)
# — the PDF's own header previously had no such border at all.
ACCENT = colors.HexColor("#4C7A3A")

# Matches ALLOWED_CURRENCIES in schemas/finance.py and CURRENCIES in the
# frontend's currencies.ts — every stored amount on `doc` is USD (see
# models/finance_document.py's own comment); this maps the document's
# own currency/exchange_rate to the symbol and multiplier used to
# convert those USD figures for display here, matching what
# FinanceDocumentPreview.tsx shows on screen.
_CURRENCY_SYMBOLS = {"USD": "$", "EUR": "€", "GBP": "£", "AOA": "Kz", "GHS": "GH₵"}


def _money(usd_amount: float, currency: str, exchange_rate: float) -> str:
    symbol = _CURRENCY_SYMBOLS.get(currency, currency + " ")
    return f"{symbol}{usd_amount * exchange_rate:,.2f}"


LOGO_PATH = Path(__file__).resolve().parent.parent / "static" / "hmzc_logo.jpeg"
# HMZC's official digital stamp — requested directly: "include this
# stamp to all certificate, and invoice." Invoice-only here (quotations
# weren't asked for); see FinanceDocumentPreview.tsx/CertificatePreview.tsx
# for the on-screen/certificate side of the same request.
STAMP_PATH = Path(__file__).resolve().parent.parent / "static" / "hmzc_stamp.png"

# reportlab's built-in PDF fonts (Helvetica etc.) only cover
# WinAnsiEncoding (Windows-1252) — enough for the accented Portuguese
# characters already in HMZC's own address text, but nothing outside
# that (Cyrillic, Greek, some Latin Extended-A characters a customer or
# vessel name could genuinely contain). DejaVu Sans has much broader
# Unicode coverage; the Dockerfile installs it via fonts-dejavu-core.
# Falls back to Helvetica (unchanged behavior) if the font files aren't
# there — e.g. running this file outside that container — rather than
# hard-failing PDF generation over a missing font.
_FONT_NAME = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
_DEJAVU_DIR = Path("/usr/share/fonts/truetype/dejavu")
try:
    _dejavu_regular = _DEJAVU_DIR / "DejaVuSans.ttf"
    _dejavu_bold = _DEJAVU_DIR / "DejaVuSans-Bold.ttf"
    if _dejavu_regular.is_file() and _dejavu_bold.is_file():
        pdfmetrics.registerFont(TTFont("DejaVuSans", str(_dejavu_regular)))
        pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", str(_dejavu_bold)))
        pdfmetrics.registerFontFamily("DejaVuSans", normal="DejaVuSans", bold="DejaVuSans-Bold", italic="DejaVuSans", boldItalic="DejaVuSans-Bold")
        _FONT_NAME = "DejaVuSans"
        _FONT_BOLD = "DejaVuSans-Bold"
except Exception:
    pass

_styles = getSampleStyleSheet()
_STYLE_NORMAL = ParagraphStyle("InvoiceNormal", parent=_styles["Normal"], fontName=_FONT_NAME, fontSize=9, leading=12)
_STYLE_SMALL = ParagraphStyle("InvoiceSmall", parent=_styles["Normal"], fontName=_FONT_NAME, fontSize=7.5, leading=10.5, textColor=MUTED)
_STYLE_TITLE = ParagraphStyle("InvoiceTitle", parent=_styles["Heading1"], fontName=_FONT_BOLD, fontSize=18, textColor=NAVY, spaceAfter=0)
# Matches .insp-letterhead .insp-lh-right in inspections.css exactly:
# right-aligned, 10px/muted-grey, the same letterhead every certificate
# and the on-screen invoice/quotation preview already uses — this PDF's
# header previously used its own left-aligned, unstyled block instead,
# which is what actually made it look different from everything else.
_STYLE_LETTERHEAD = ParagraphStyle("InvoiceLetterhead", parent=_styles["Normal"], fontName=_FONT_NAME, fontSize=9, leading=13.5, textColor=MUTED, alignment=TA_RIGHT)
# Bold now (was inheriting plain Normal) — matches the fontWeight:700
# uppercase section headers actually use on screen (FinanceDocumentPreview.tsx).
_STYLE_SECTION = ParagraphStyle("InvoiceSection", parent=_styles["Normal"], fontName=_FONT_BOLD, fontSize=8.5, leading=11, textColor=NAVY, spaceBefore=10, spaceAfter=4)
_STYLE_BADGE = ParagraphStyle("InvoiceBadge", parent=_styles["Normal"], fontName=_FONT_BOLD, fontSize=9, leading=11, textColor=colors.white, alignment=TA_CENTER)


def _scaled_image(path: Path, max_width_mm: float, max_height_mm: float) -> RLImage:
    """
    Scales an image to fit within max_width_mm x max_height_mm while
    preserving its real aspect ratio — the logo used to be hardcoded to
    34mm x 17mm (a 2:1 box) regardless of its actual ~3.28:1 shape,
    which forced reportlab to stretch it non-uniformly to fill that box
    exactly. Reads the real dimensions from the file itself rather than
    hardcoding a ratio, so a differently-shaped replacement asset can't
    silently reintroduce the same distortion. Shared by the logo and the
    HMZC stamp — same distortion risk, same fix.
    """
    with PILImage.open(path) as im:
        native_w, native_h = im.size
    ratio = native_w / native_h
    width_mm = max_width_mm
    height_mm = width_mm / ratio
    if height_mm > max_height_mm:
        height_mm = max_height_mm
        width_mm = height_mm * ratio
    return RLImage(str(path), width=width_mm * mm, height=height_mm * mm)


def _qr_image(payload: str, size_mm: float = 20) -> RLImage:
    qr = qrcode.QRCode(border=1, box_size=6)
    qr.add_data(payload)
    qr.make(fit=True)
    img: PILImage.Image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return RLImage(buf, width=size_mm * mm, height=size_mm * mm)


def _status_badge(kind: str, status: str) -> Table:
    """
    A colored rounded pill, matching .insp-badge on screen (navy for
    invoices, teal for quotations, white uppercase text) — the PDF
    previously just showed "[ISSUED]" as small plain bracketed text,
    visibly plainer than the real badge every certificate and the
    on-screen preview actually use.
    """
    badge_color = NAVY if kind == "INVOICE" else TEAL
    badge = Table([[Paragraph(status.upper(), _STYLE_BADGE)]])
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), badge_color),
        ("ROUNDEDCORNERS", [9, 9, 9, 9]),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return badge


def _draw_watermark(canvas_obj, _doc_template) -> None:
    """
    A faint centered logo behind the page content, matching
    .finance-doc-page::before on screen (every certificate and the
    invoice/quotation preview has this) — the PDF previously had none
    at all, a visible gap from the rest of the document family.
    """
    if not LOGO_PATH.is_file():
        return
    with PILImage.open(LOGO_PATH) as im:
        native_w, native_h = im.size
    ratio = native_w / native_h
    page_w, page_h = A4
    width = page_w * 0.56  # matches CSS's background-size: 56%
    height = width / ratio
    x = (page_w - width) / 2
    y = (page_h - height) / 2
    canvas_obj.saveState()
    canvas_obj.setFillAlpha(0.05)
    canvas_obj.drawImage(str(LOGO_PATH), x, y, width=width, height=height, preserveAspectRatio=True, mask=None)
    canvas_obj.restoreState()


def _id_table(rows: list[tuple[str, str, str, str]]) -> Table:
    data = [[Paragraph(f"<b>{a}</b>", _STYLE_NORMAL), Paragraph(b, _STYLE_NORMAL), Paragraph(f"<b>{c}</b>", _STYLE_NORMAL), Paragraph(d, _STYLE_NORMAL)] for a, b, c, d in rows]
    t = Table(data, colWidths=[80, 140, 80, 140])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F6F7")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F4F6F7")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _terms_flowables(terms_conditions: str) -> list:
    flowables = [Paragraph("TERMS AND CONDITIONS", _STYLE_SECTION)]
    for line in terms_conditions.splitlines():
        line = line.strip()
        if not line:
            continue
        idx = line.find(": ")
        if 0 < idx < 60:
            text = f"<b>{line[:idx + 1]}</b>{line[idx + 1:]}"
        else:
            text = line
        flowables.append(Paragraph(text, _STYLE_SMALL))
        flowables.append(Spacer(1, 3))
    return flowables


def build_document_pdf(doc, kind: str, company: Optional[NotificationSettings]) -> bytes:
    """
    Builds the invoice/quotation itself as a standalone PDF. `doc` is an
    Invoice or Quotation row; `kind` is "INVOICE" or "QUOTATION" (bank
    details/T&C only ever render for INVOICE, matching
    FinanceDocumentPreview.tsx's own kind == "INVOICE" gates).
    """
    buf = io.BytesIO()
    doc_template = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"{kind.title()} {doc.invoice_no if kind == 'INVOICE' else doc.quotation_no}",
    )
    story: list = []

    doc_no = doc.invoice_no if kind == "INVOICE" else doc.quotation_no
    currency = getattr(doc, "currency", None) or "USD"
    exchange_rate = getattr(doc, "exchange_rate", None) or 1.0

    # ---- letterhead ----
    # Matches .insp-letterhead's actual layout (inspections.css), the
    # one every certificate and the on-screen invoice/quotation preview
    # already uses: logo on the left; on the right, the address block
    # sits immediately left of the QR code as one right-aligned group
    # (not spread across three even columns) — and the whole thing sits
    # on a 3px accent-green bottom border. The PDF's own header
    # previously matched none of this (evenly-spread 3-column layout,
    # left-aligned unstyled text, no border), which is what actually
    # made it look like a different document from everything else.
    letterhead_text = Paragraph(
        "HMZC LTD — Marine Engineering Services<br/>"
        "Cabinda HQ: Urbanização 4 De Abril, Cabinda, Angola<br/>"
        "Luanda, Benfica Rua Bento Raimundo.<br/>"
        "admin@hmzchealthinmarine.com | +244 972 320 300"
        + (f"<br/>PEPPOL ID: {company.peppol_id}" if company and company.peppol_id else ""),
        _STYLE_LETTERHEAD,
    )
    logo_cell = _scaled_image(LOGO_PATH, 40, 17) if LOGO_PATH.is_file() else Paragraph("HMZC", _STYLE_TITLE)
    qr_cell = _qr_image(f"HMZC {kind}\nNo: {doc_no}\nCustomer: {doc.customer or '—'}\nTotal: {_money(doc.total, currency, exchange_rate)}")

    right_group = Table([[letterhead_text, qr_cell]], colWidths=[97 * mm, 25 * mm])
    right_group.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 10),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
    ]))

    header = Table([[logo_cell, right_group]], colWidths=[45 * mm, 122 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 0),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LINEBELOW", (0, 0), (-1, -1), 2.2, ACCENT),
    ]))
    story.append(header)
    story.append(Spacer(1, 10))

    # ---- title + status badge ----
    title_row = Table([[Paragraph("Invoice" if kind == "INVOICE" else "Quotation", _STYLE_TITLE), _status_badge(kind, doc.status)]], colWidths=[None, None])
    title_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (1, 0), (1, 0), 10)]))
    story.append(title_row)
    story.append(Spacer(1, 8))

    # ---- ID table ----
    story.append(_id_table([
        (("Invoice No." if kind == "INVOICE" else "Quotation No."), doc_no, "Customer", doc.customer or "—"),
        ("Vessel", doc.vessel_name or "—", "IMO No.", doc.imo_no or "—"),
    ]))
    story.append(Spacer(1, 10))

    # ---- line items ----
    header_row = [Paragraph(f"<b>{h}</b>", _STYLE_NORMAL) for h in ["Code", "Description", "Qty", "Unit Price", "Discount", "Line Total"]]
    rows = [header_row]
    for li in (doc.line_items or []):
        rows.append([
            Paragraph(str(li.get("code", "")), _STYLE_NORMAL),
            Paragraph(str(li.get("description", "")), _STYLE_NORMAL),
            Paragraph(str(li.get("quantity", "")), _STYLE_NORMAL),
            Paragraph(_money(float(li.get('unit_price', 0)), currency, exchange_rate), _STYLE_NORMAL),
            Paragraph(f"{li.get('discount_percent', 0)}%" if li.get("discount_percent") else "—", _STYLE_NORMAL),
            Paragraph(_money(float(li.get('line_total', 0)), currency, exchange_rate), _STYLE_NORMAL),
        ])
    items_table = Table(rows, colWidths=[60, 195, 30, 60, 55, 60], repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 8))

    # ---- totals (with per-invoice condition bullets to its left) ----
    totals_data = [
        ["Subtotal", _money(doc.subtotal, currency, exchange_rate)],
        ["Discount", f"-{_money(doc.discount_total, currency, exchange_rate)}"],
        [Paragraph("<b>Total</b>", _STYLE_NORMAL), Paragraph(f"<b>{_money(doc.total, currency, exchange_rate)}</b>", _STYLE_NORMAL)],
    ]
    if currency != "USD":
        totals_data.append(["", Paragraph(f"(USD {doc.total:,.2f} @ {exchange_rate:g})", _STYLE_SMALL)])
    totals_table = Table(totals_data, colWidths=[80, 80], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("LINEABOVE", (0, 2), (-1, 2), 1, NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))

    # Requested directly: short condition bullets ("Overtime rate
    # applies...", "Client is responsible for technician's
    # accommodation, local transportation, and flights") placed to the
    # LEFT of the totals block — quotations only ("put the condition in
    # the quotation not the invoice"; Invoice rows have no `conditions`
    # column at all), and only when the quotation actually has some (a
    # quotation with none just shows totals alone, same as before).
    doc_conditions = getattr(doc, "conditions", None) or [] if kind == "QUOTATION" else []
    if doc_conditions:
        condition_flowables = [Paragraph("<b>Conditions</b>", _STYLE_NORMAL), Spacer(1, 2)]
        for c in doc_conditions:
            condition_flowables.append(Paragraph(f"• {c}", _STYLE_SMALL))
            condition_flowables.append(Spacer(1, 2))
        row = Table([[condition_flowables, totals_table]], colWidths=[290, 165])
        row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (1, 0), (1, 0), "RIGHT"), ("LEFTPADDING", (0, 0), (0, 0), 0)]))
        story.append(row)
    else:
        story.append(totals_table)

    # ---- bank details (invoice only) ----
    has_bank = kind == "INVOICE" and company and any([
        company.bank_name, company.bank_address, company.bank_town, company.bank_postcode,
        company.bank_country, company.bank_beneficiary, company.bank_account_number,
        company.bank_sort_code, company.bank_swift_code, company.bank_iban,
    ])
    if has_bank:
        story.append(Paragraph("SUPPLIER BANK ACCOUNT DETAILS", _STYLE_SECTION))
        bank_rows = [
            ("Bank Name", company.bank_name or "—", "Beneficiary", company.bank_beneficiary or "—"),
            ("Bank Address", company.bank_address or "—", "", ""),
            ("Town", company.bank_town or "—", "Account Number", company.bank_account_number or "—"),
            ("Postcode", company.bank_postcode or "—", "Sort Number", company.bank_sort_code or "—"),
            ("Country", company.bank_country or "—", "Swift Number", company.bank_swift_code or "—"),
        ]
        if company.bank_iban:
            bank_rows.append(("IBAN Code", company.bank_iban, "", ""))
        story.append(_id_table(bank_rows))

    # ---- terms and conditions (invoice only) ----
    if kind == "INVOICE" and company and company.terms_conditions:
        terms = _terms_flowables(company.terms_conditions)
        # Keeps the "TERMS AND CONDITIONS" heading glued to its first
        # clause so it can't end up orphaned alone at the bottom of a
        # page — the rest flows normally across as many pages as needed.
        story.append(KeepTogether(terms[:2]) if len(terms) >= 2 else terms[0])
        story.extend(terms[2:])

    # ---- footer ----
    story.append(Spacer(1, 10))
    issued_line = ""
    if doc.issued_by:
        issued_line = f"Issued by {doc.issued_by.full_name or doc.issued_by.email}"
        if doc.created_at:
            issued_line += f" — {doc.created_at.strftime('%Y-%m-%d %H:%M')}"
    footer_text = (
        (issued_line + "<br/>" if issued_line else "")
        + f"This {kind.lower()} was generated by HMZC LTD's certification platform. "
        + "Prices reflect HMZC's internal price list at the time of issue and are not subject to change once issued"
        + ("." if kind == "INVOICE" else "; a formal invoice will confirm final pricing.")
    )
    footer_para = Paragraph(footer_text, _STYLE_SMALL)

    if kind == "INVOICE" and STAMP_PATH.is_file():
        stamp_row = Table([[footer_para, _scaled_image(STAMP_PATH, 32, 12)]], colWidths=[135 * mm, 32 * mm])
        stamp_row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 8),
            ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ]))
        story.append(stamp_row)
    else:
        story.append(footer_para)

    doc_template.build(story, onFirstPage=_draw_watermark, onLaterPages=_draw_watermark)
    return buf.getvalue()


def _placeholder_page_pdf(text: str) -> bytes:
    buf = io.BytesIO()
    doc_template = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm)
    doc_template.build([Paragraph(text, _STYLE_NORMAL)])
    return buf.getvalue()


def merge_pdf_with_attachments(base_pdf: bytes, attachments: list[tuple[bytes, Optional[str], str]]) -> bytes:
    """
    Appends every attachment onto the end of `base_pdf`, returning one
    combined PDF. `attachments` is a list of (raw_bytes, content_type,
    original_filename). PDFs are appended page-for-page; images
    (jpeg/png/gif/webp) are converted to a single full-page image first;
    anything else can't be embedded without a much heavier dependency
    (e.g. LibreOffice for .docx/.xlsx), so a one-page notice is inserted
    instead, naming the file and saying it's available in the
    supporting-documents "Download All" zip — better than silently
    dropping it from the packet with no trace.
    """
    writer = PdfWriter()
    writer.append(PdfReader(io.BytesIO(base_pdf)))

    for raw, content_type, filename in attachments:
        try:
            if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
                writer.append(PdfReader(io.BytesIO(raw)))
                continue
            if (content_type and content_type.startswith("image/")) or filename.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp")):
                img = PILImage.open(io.BytesIO(raw)).convert("RGB")
                page_buf = io.BytesIO()
                img.save(page_buf, format="PDF")
                writer.append(PdfReader(io.BytesIO(page_buf.getvalue())))
                continue
        except Exception:
            pass  # falls through to the placeholder notice below

        notice = _placeholder_page_pdf(
            f"<b>Attachment: {filename}</b><br/><br/>"
            f"This file type can't be embedded directly in this combined PDF. "
            f"Download it separately from the invoice's Supporting Documents section."
        )
        writer.append(PdfReader(io.BytesIO(notice)))

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
