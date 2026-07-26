import { InspectionCertificate } from "../types/inspection.types";

export interface VesselGroup {
  key: string;
  vesselName: string;
  imoNo: string;
  certs: InspectionCertificate[];
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
      group = { key, vesselName, imoNo, certs: [] };
      byVessel.set(key, group);
    }
    group.certs.push(c);
  }

  for (const group of byVessel.values()) {
    group.certs.sort((a, b) => (b.issuedAt || b.savedAt || "").localeCompare(a.issuedAt || a.savedAt || ""));
  }

  return Array.from(byVessel.values()).sort((a, b) => {
    const aLatest = a.certs[0]?.issuedAt || a.certs[0]?.savedAt || "";
    const bLatest = b.certs[0]?.issuedAt || b.certs[0]?.savedAt || "";
    return bLatest.localeCompare(aLatest);
  });
}
