import io
from pathlib import Path
from typing import Optional

import qrcode
from PIL import Image as PILImage
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
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
MUTED = colors.HexColor("#6B7480")
LINE = colors.HexColor("#DCE1E5")

LOGO_PATH = Path(__file__).resolve().parent.parent / "static" / "hmzc_logo.jpeg"

_styles = getSampleStyleSheet()
_STYLE_NORMAL = ParagraphStyle("InvoiceNormal", parent=_styles["Normal"], fontSize=9, leading=12)
_STYLE_SMALL = ParagraphStyle("InvoiceSmall", parent=_styles["Normal"], fontSize=7.5, leading=10.5, textColor=MUTED)
_STYLE_TITLE = ParagraphStyle("InvoiceTitle", parent=_styles["Heading1"], fontSize=18, textColor=NAVY, spaceAfter=0)
_STYLE_LETTERHEAD = ParagraphStyle("InvoiceLetterhead", parent=_styles["Normal"], fontSize=8.5, leading=12)
_STYLE_SECTION = ParagraphStyle("InvoiceSection", parent=_styles["Normal"], fontSize=8.5, leading=11, textColor=NAVY, spaceBefore=10, spaceAfter=4)


def _qr_image(payload: str, size_mm: float = 20) -> RLImage:
    qr = qrcode.QRCode(border=1, box_size=6)
    qr.add_data(payload)
    qr.make(fit=True)
    img: PILImage.Image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return RLImage(buf, width=size_mm * mm, height=size_mm * mm)


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
    total = doc.total

    # ---- letterhead ----
    letterhead_text = Paragraph(
        "<b>HMZC LTD — Marine Engineering Services</b><br/>"
        "Cabinda HQ: Urbanização 4 De Abril, Cabinda, Angola<br/>"
        "Luanda, Benfica Rua Bento Raimundo.<br/>"
        "admin@hmzchealthinmarine.com | +244 972 320 300"
        + (f"<br/>PEPPOL ID: {company.peppol_id}" if company and company.peppol_id else ""),
        _STYLE_LETTERHEAD,
    )
    logo_cell = RLImage(str(LOGO_PATH), width=34 * mm, height=17 * mm) if LOGO_PATH.is_file() else Paragraph("HMZC", _STYLE_TITLE)
    qr_cell = _qr_image(f"HMZC {kind}\nNo: {doc_no}\nCustomer: {doc.customer or '—'}\nTotal: ${total:.2f}")
    # Column widths were plain point values (80/300/60) while the logo
    # image itself is sized in mm (34mm ≈ 96pt) — 96pt doesn't fit an
    # 80pt-wide column, so the logo overflowed straight into the
    # letterhead text column next to it, visually overlapping the
    # company name/address. Widths now in mm too, sized to actually fit
    # each cell's content with room to spare, and sum to the page's full
    # content width (A4 170mm after this document's 20mm side margins)
    # so nothing is left unaccounted for.
    header = Table([[logo_cell, letterhead_text, qr_cell]], colWidths=[45 * mm, 100 * mm, 25 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (2, 0), (2, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 8),
        ("LEFTPADDING", (1, 0), (1, 0), 4),
    ]))
    story.append(header)
    story.append(Spacer(1, 10))

    # ---- title + status ----
    story.append(Paragraph(("Invoice" if kind == "INVOICE" else "Quotation") + f" &nbsp;&nbsp; <font size=10 color='#1F3B5C'>[{doc.status.upper()}]</font>", _STYLE_TITLE))
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
            Paragraph(f"${float(li.get('unit_price', 0)):.2f}", _STYLE_NORMAL),
            Paragraph(f"{li.get('discount_percent', 0)}%" if li.get("discount_percent") else "—", _STYLE_NORMAL),
            Paragraph(f"${float(li.get('line_total', 0)):.2f}", _STYLE_NORMAL),
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
        ["Subtotal", f"${doc.subtotal:.2f}"],
        ["Discount", f"-${doc.discount_total:.2f}"],
        [Paragraph("<b>Total</b>", _STYLE_NORMAL), Paragraph(f"<b>${doc.total:.2f}</b>", _STYLE_NORMAL)],
    ]
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
    story.append(Paragraph(footer_text, _STYLE_SMALL))

    doc_template.build(story)
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
