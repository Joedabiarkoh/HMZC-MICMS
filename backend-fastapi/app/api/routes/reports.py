from collections import Counter
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, require_permission
from app.core.database import get_database
from app.core.lsa_analysis import LSA_TYPES, build_analysis
from app.core.lsa_pdf import build_lsa_pdf
from app.models.notification_settings import get_notification_settings
from app.core.expiry_reminders import list_expiring_certificates, send_expiry_reminders
from app.core.permissions import CERT_VIEW_ALL
from app.models.certificate import Certificate
from app.models.user import User
from app.schemas.reports import (
    CertificatesSummary,
    EquipmentTypeCount,
    ExpiringCertificate,
    ExpiryReminderRunResult,
    LSAAnalysis,
    MonthlyCertificateCount,
)

router = APIRouter(tags=["reports"])

# Not the same population/permission as Finance's own dashboard
# (GET /finance/dashboard, gated on FIN_VIEW) — this is certificates-side
# reporting, which is genuinely new; finance already has a working
# revenue dashboard + chart (ProfitChart.tsx) that this deliberately
# does not duplicate.


@router.get("/certificates-summary", response_model=CertificatesSummary)
def certificates_summary(
    months: int = 12,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_VIEW_ALL)),
):
    finalized = db.query(Certificate).filter(Certificate.status == "final").all()

    now = datetime.now(timezone.utc)
    monthly: List[MonthlyCertificateCount] = []
    for i in range(months - 1, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        label = datetime(year, month, 1).strftime("%b %Y")
        count = sum(
            1 for cert in finalized
            if cert.created_at and cert.created_at.year == year and cert.created_at.month == month
        )
        monthly.append(MonthlyCertificateCount(month=label, count=count))

    type_counts = Counter(cert.equipment_type for cert in finalized)
    by_type = [
        EquipmentTypeCount(equipment_type=equipment_type, count=count)
        for equipment_type, count in sorted(type_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    return CertificatesSummary(total_finalized=len(finalized), monthly=monthly, by_equipment_type=by_type)


@router.get("/expiring-certificates", response_model=List[ExpiringCertificate])
def expiring_certificates(
    lead_days: Optional[int] = None,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_VIEW_ALL)),
):
    return list_expiring_certificates(db, lead_days)


# Admin-only manual trigger — mirrors backup's POST /api/backup/run, for
# the same reason: lets the actual configured behavior be verified (or
# an overdue digest be sent immediately) without waiting for the daily
# scheduled loop in main.py.
@router.post("/expiry-reminders/run", response_model=ExpiryReminderRunResult)
def run_expiry_reminders_now(
    db: Session = Depends(get_database),
    _admin: User = Depends(get_current_admin_user),
):
    return send_expiry_reminders(db)


def _lsa_certificates(db: Session):
    return db.query(Certificate).filter(Certificate.status == "final", Certificate.equipment_type.in_(LSA_TYPES)).all()


# Requested directly: analyse the makers and models of the lifeboats, davits,
# winches and release hooks inspected, and let a class society or flag state
# have that as a report. Lifesaving Appliances certificates only; see
# core/lsa_analysis.py for what is counted.
@router.get("/lifesaving-analysis", response_model=LSAAnalysis)
def lifesaving_analysis(
    class_society: str = "",
    flag: str = "",
    date_from: str = "",
    date_to: str = "",
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_VIEW_ALL)),
):
    return build_analysis(_lsa_certificates(db), class_society, flag, date_from, date_to)


@router.get("/lifesaving-analysis/pdf")
def lifesaving_analysis_pdf(
    class_society: str = "",
    flag: str = "",
    date_from: str = "",
    date_to: str = "",
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_VIEW_ALL)),
):
    analysis = build_analysis(_lsa_certificates(db), class_society, flag, date_from, date_to)
    pdf = build_lsa_pdf(analysis, get_notification_settings(db))
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="HMZC-Lifesaving-Appliance-Analysis.pdf"'},
    )
