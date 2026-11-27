"""PDF of the lifesaving-appliance maker/model analysis (core/lsa_analysis.py),
on the shared HMZC letterhead, so it can be handed to a class society or flag
state that asks for it."""
import io
from datetime import datetime
from typing import Optional
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.invoice_pdf import (
    LINE,
    MUTED,
    NAVY,
    _FONT_NAME,
    _STYLE_NORMAL,
    _STYLE_SECTION,
    _STYLE_SMALL,
    _STYLE_TITLE,
    _draw_watermark,
    letterhead_flowables,
)
from app.core.lsa_analysis import CATEGORIES
from app.models.notification_settings import NotificationSettings


_PLURAL = {
    "Lifeboat": "Lifeboats", "Rescue boat": "Rescue boats", "Free-fall lifeboat": "Free-fall lifeboats",
    "Davit": "Davits", "Winch": "Winches", "Release hook": "Release hooks",
}


def _filter_line(f: dict) -> str:
    parts = []
    if f.get("class"):
        parts.append(f"Class: {f['class']}")
    if f.get("flag"):
        parts.append(f"Flag: {f['flag']}")
    if f.get("date_from") or f.get("date_to"):
        parts.append(f"Serviced {f.get('date_from') or '…'} to {f.get('date_to') or '…'}")
    return " · ".join(parts) or "All classes, flags and dates"


def build_lsa_pdf(analysis: dict, company: Optional[NotificationSettings]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
        title="Lifesaving Appliance Analysis",
    )
    story: list = []
    story.extend(letterhead_flowables(company, "HMZC LIFESAVING APPLIANCE ANALYSIS"))
    story.append(Paragraph("Lifesaving Appliance Analysis — Maker &amp; Model", _STYLE_TITLE))
    story.append(Spacer(1, 4))
    story.append(Paragraph(escape(_filter_line(analysis["filters"])), _STYLE_NORMAL))
    story.append(Paragraph(
        f"{analysis['certificates_analysed']} finalized certificate(s) on {analysis['vessels']} vessel(s). "
        f"Generated {datetime.now().strftime('%d/%m/%Y')}.", _STYLE_SMALL))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Built from HMZC's finalized lifesaving-appliance certificates. A certificate counts as having a defect when "
        "its checklist records at least one item as Repair; \"attention\" means at least one item marked Part.",
        _STYLE_SMALL))
    story.append(Spacer(1, 8))

    rows = analysis["rows"]
    if not rows:
        story.append(Paragraph("No lifesaving-appliance certificates match these filters.", _STYLE_NORMAL))

    head = ["Maker", "Model", "Units", "Vessels", "Certs", "Defects", "Attention", "Defect %"]
    widths = [42 * mm, 42 * mm, 13 * mm, 17 * mm, 13 * mm, 16 * mm, 18 * mm, 15 * mm]
    for cat in CATEGORIES:
        cat_rows = [r for r in rows if r["category"] == cat]
        if not cat_rows:
            continue
        data = [[Paragraph(f"<b>{h}</b>", _STYLE_SMALL) for h in head]]
        for r in cat_rows:
            data.append([
                Paragraph(escape(r["maker"]), _STYLE_SMALL),
                Paragraph(escape(r["model"]), _STYLE_SMALL),
                str(r["units"]), str(r["vessels"]), str(r["certificates"]),
                str(r["with_defects"]), str(r["with_attention"]), f"{r['defect_rate']:.0f}%",
            ])
        t = Table(data, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E7ECF1")),
            ("GRID", (0, 0), (-1, -1), 0.5, LINE),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("FONTNAME", (0, 1), (-1, -1), _FONT_NAME),
            ("ALIGN", (2, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(KeepTogether([Paragraph(_PLURAL[cat].upper(), _STYLE_SECTION), t]))
        story.append(Spacer(1, 8))

    def _decorate(canvas_obj, doc_template):
        _draw_watermark(canvas_obj, doc_template)
        canvas_obj.saveState()
        canvas_obj.setFont(_FONT_NAME, 7.5)
        canvas_obj.setFillColor(MUTED)
        canvas_obj.drawString(18 * mm, 10 * mm, "HMZC LTD — Lifesaving Appliance Analysis")
        canvas_obj.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc_template.page}")
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=_decorate, onLaterPages=_decorate)
    return buf.getvalue()
