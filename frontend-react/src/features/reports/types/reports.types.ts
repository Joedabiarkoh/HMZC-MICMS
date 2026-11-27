// Matches backend-fastapi's app/schemas/reports.py exactly.

export interface MonthlyCertificateCount {
  month: string; // "Jan 2026" — pre-formatted server-side
  count: number;
}

export interface EquipmentTypeCount {
  equipment_type: string;
  count: number;
}

export interface CertificatesSummary {
  total_finalized: number;
  monthly: MonthlyCertificateCount[];
  by_equipment_type: EquipmentTypeCount[];
}

export interface ExpiringCertificate {
  cert_no: string;
  equipment_type: string;
  vessel_name: string | null;
  date_of_servicing: string | null;
  expiry_date: string;
  days_until_expiry: number;
  overdue: boolean;
}

export interface ExpiryReminderRunResult {
  skipped: boolean;
  reminded: number;
  reason?: string | null;
  email_failed?: boolean | null;
}

// Lifesaving Appliances maker/model analysis — see backend core/lsa_analysis.py.
export interface LSAAnalysisRow {
  category: string; // Lifeboat | Rescue boat | Free-fall lifeboat | Davit | Winch | Release hook
  maker: string;
  model: string;
  units: number;
  vessels: number;
  vessel_names: string[];
  certificates: number;
  with_defects: number;
  with_attention: number;
  repair_items: number;
  defect_rate: number;
}

export interface LSAAnalysis {
  filters: { class: string; flag: string; date_from: string; date_to: string };
  certificates_analysed: number;
  vessels: number;
  rows: LSAAnalysisRow[];
  known_classes: string[];
  known_flags: string[];
}

export interface LSAFilters {
  classSociety: string;
  flag: string;
  dateFrom: string;
  dateTo: string;
}
