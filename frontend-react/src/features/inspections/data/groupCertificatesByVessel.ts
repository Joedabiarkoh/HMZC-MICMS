import { InspectionCertificate } from "../types/inspection.types";

export interface YearGroup {
  year: string; // e.g. "2026", or "Unknown" for a cert with no date_of_servicing on file
  certs: InspectionCertificate[];
}

export interface VesselGroup {
  key: string;
  vesselName: string;
  imoNo: string;
  certs: InspectionCertificate[];
  // Requested directly: as a vessel accumulates more years of service
  // history, a single flat list under it stops being scannable — grouped
  // by the year the servicing actually happened (date_of_servicing, not
  // issuedAt/savedAt — those are administrative record timestamps, not
  // when the work was done), newest year first.
  certsByYear: YearGroup[];
}

function servicingYear(cert: InspectionCertificate): string {
  const year = cert.dateOfServicing?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? year : "Unknown";
}

function groupByYear(certs: InspectionCertificate[]): YearGroup[] {
  const byYear = new Map<string, InspectionCertificate[]>();
  for (const c of certs) {
    const year = servicingYear(c);
    const bucket = byYear.get(year);
    if (bucket) bucket.push(c);
    else byYear.set(year, [c]);
  }
  return Array.from(byYear.entries())
    .map(([year, yearCerts]) => ({ year, certs: yearCerts }))
    .sort((a, b) => (b.year === "Unknown" ? -1 : a.year === "Unknown" ? 1 : b.year.localeCompare(a.year)));
}

// Extracted from CertificateLog.tsx purely to be independently testable
// — behavior is unchanged. Individual certificates shouldn't surface on
// their own in the log, only grouped under their vessel (requested
// directly) — a certificate with no vessel name/IMO on file (old or
// incomplete records) falls into its own "(vessel not recorded)" group
// rather than being silently dropped.
export function groupCertificatesByVessel(
  certificates: Record<string, InspectionCertificate>,
  search: string
): VesselGroup[] {
  const q = search.trim().toLowerCase();
  const filtered = Object.values(certificates).filter((c) => {
    if (!q) return true;
    return (
      c.certNo.toLowerCase().includes(q) ||
      (c.vesselName || "").toLowerCase().includes(q) ||
      (c.imoNo || "").toLowerCase().includes(q) ||
      (c.issuedBy || c.savedBy || "").toLowerCase().includes(q)
    );
  });

  const byVessel = new Map<string, VesselGroup>();
  for (const c of filtered) {
    const vesselName = c.vesselName?.trim() || "";
    const imoNo = c.imoNo?.trim() || "";
    const key = vesselName || imoNo ? `${vesselName}|${imoNo}` : "__unrecorded__";
    let group = byVessel.get(key);
    if (!group) {
      group = { key, vesselName, imoNo, certs: [], certsByYear: [] };
      byVessel.set(key, group);
    }
    group.certs.push(c);
  }

  for (const group of byVessel.values()) {
    group.certs.sort((a, b) => (b.issuedAt || b.savedAt || "").localeCompare(a.issuedAt || a.savedAt || ""));
    group.certsByYear = groupByYear(group.certs);
  }

  return Array.from(byVessel.values()).sort((a, b) => {
    const aLatest = a.certs[0]?.issuedAt || a.certs[0]?.savedAt || "";
    const bLatest = b.certs[0]?.issuedAt || b.certs[0]?.savedAt || "";
    return bLatest.localeCompare(aLatest);
  });
}
