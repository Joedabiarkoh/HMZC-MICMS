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
