from typing import List, Optional

from pydantic import BaseModel


class MonthlyCertificateCount(BaseModel):
    month: str  # "Jan 2026" — pre-formatted, same convention as finance's MonthlyRevenuePoint
    count: int


class EquipmentTypeCount(BaseModel):
    equipment_type: str
    count: int


class CertificatesSummary(BaseModel):
    total_finalized: int
    monthly: List[MonthlyCertificateCount]
    by_equipment_type: List[EquipmentTypeCount]


class ExpiringCertificate(BaseModel):
    cert_no: str
    equipment_type: str
    vessel_name: Optional[str] = None
    date_of_servicing: Optional[str] = None
    expiry_date: str
    days_until_expiry: int
    overdue: bool


class ExpiryReminderRunResult(BaseModel):
    skipped: bool
    reminded: int = 0
    reason: Optional[str] = None
    email_failed: Optional[bool] = None


class LSAAnalysisRow(BaseModel):
    category: str
    maker: str
    model: str
    units: int
    vessels: int
    vessel_names: List[str]
    certificates: int
    with_defects: int
    with_attention: int
    repair_items: int
    defect_rate: float


class LSAAnalysis(BaseModel):
    filters: dict
    certificates_analysed: int
    vessels: int
    rows: List[LSAAnalysisRow]
    known_classes: List[str]
    known_flags: List[str]
