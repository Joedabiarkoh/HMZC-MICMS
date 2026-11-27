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

import { LSAAnalysis, LSAFilters } from "../types/reports.types";

function lsaParams(f: LSAFilters) {
  return { class_society: f.classSociety, flag: f.flag, date_from: f.dateFrom, date_to: f.dateTo };
}

/** Requires certificates.view_all. Lifesaving Appliances certificates only. */
export async function fetchLifesavingAnalysis(f: LSAFilters): Promise<LSAAnalysis> {
  const response = await api.get<LSAAnalysis>("/reports/lifesaving-analysis", { params: lsaParams(f) });
  return response.data;
}

/** One click: downloads the analysis as a PDF for the same filters. */
export async function downloadLifesavingAnalysisPdf(f: LSAFilters): Promise<void> {
  const response = await api.get("/reports/lifesaving-analysis/pdf", { params: lsaParams(f), responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "HMZC-Lifesaving-Appliance-Analysis.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
