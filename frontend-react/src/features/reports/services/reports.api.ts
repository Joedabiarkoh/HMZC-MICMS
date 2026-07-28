import api from "../../../api/axios";
import { CertificatesSummary, ExpiringCertificate, ExpiryReminderRunResult } from "../types/reports.types";

/** Requires certificates.view_all — see core/permissions.py. */
export async function fetchCertificatesSummary(months = 12): Promise<CertificatesSummary> {
  const response = await api.get<CertificatesSummary>("/reports/certificates-summary", { params: { months } });
  return response.data;
}

/** Requires certificates.view_all. */
export async function fetchExpiringCertificates(leadDays?: number): Promise<ExpiringCertificate[]> {
  const response = await api.get<ExpiringCertificate[]>("/reports/expiring-certificates", {
    params: leadDays != null ? { lead_days: leadDays } : {},
  });
  return response.data;
}

/** Admin-only. Manually triggers the same check the daily background job runs. */
export async function runExpiryRemindersNow(): Promise<ExpiryReminderRunResult> {
  const response = await api.post<ExpiryReminderRunResult>("/reports/expiry-reminders/run");
  return response.data;
}
