import { InspectionCertificate } from "../types/inspection.types";
import { INSPECTION_TYPES } from "./inspectionChecklists";

const LOOSE_GEAR_SUBTYPE_LABELS: Record<string, string> = {
  standard_report: "Report of Thorough Examination",
  multiple_items: "Report of Thorough Examination (Multiple Items)",
  visual_certificate: "Visual Certificate of Thorough Examination",
};

// Requested directly: "I want it to be grouped based on the report
// type" — Loose Gear's sub-types (see LOOSE_GEAR_SUB_TYPES,
// inspectionHelpers.ts) are functionally different report kinds a
// technician picks between when creating a certificate, not just a
// data variant of one report, so they're split into their own groups
// here rather than lumped under one "Loose Gear & Lifting Equipment"
// bucket.
export function reportTypeLabel(cert: InspectionCertificate): string {
  const base = INSPECTION_TYPES[cert.type]?.typeName || cert.type;
  if (cert.type === "loosegear" && cert.looseGear?.subType) {
    const sub = LOOSE_GEAR_SUBTYPE_LABELS[cert.looseGear.subType];
    if (sub) return `${base} — ${sub}`;
  }
  return base;
}

export interface JobGroup {
  jobNo: string;
  certs: InspectionCertificate[];
}

export interface TypeGroup {
  key: string;
  label: string;
  certs: InspectionCertificate[];
  // Requested directly: "sometimes the items for lifting gear can be
  // over 300 report for the various lifting items on board the vessel
  // ... find a creative way of ... grouping these." A vessel's Loose
  // Gear "Report of Thorough Examination" certs (one full statutory
  // exam per item, see StandardReportForm's own comment for why these
  // can't just be merged into one record) are further grouped by Job
  // No — see suggestLooseGearJobNo (looseGearJobNo.ts) for how that's
  // auto-filled per vessel visit — so 300 individual item reports
  // collapse into a handful of "one visit = one job" batches instead
  // of one flat list. Only ever populated for that one report type;
  // every other type group leaves this undefined.
  jobGroups?: JobGroup[];
}

export interface VesselGroup {
  key: string;
  vesselName: string;
  imoNo: string;
  certs: InspectionCertificate[];
  // Requested directly: as a vessel accumulates more certificates, a
  // single flat list under it stops being scannable — grouped by
  // report type (see reportTypeLabel above), newest activity first.
  certsByType: TypeGroup[];
}

function latestTimestamp(certs: InspectionCertificate[]): string {
  return certs[0]?.issuedAt || certs[0]?.savedAt || "";
}

function groupByJobNo(certs: InspectionCertificate[]): JobGroup[] {
  const byJob = new Map<string, InspectionCertificate[]>();
  for (const c of certs) {
    const jobNo = c.looseGear?.standardReport?.jobNo?.trim() || "(no job no.)";
    const bucket = byJob.get(jobNo);
    if (bucket) bucket.push(c);
    else byJob.set(jobNo, [c]);
  }
  return Array.from(byJob.entries())
    .map(([jobNo, jobCerts]) => ({ jobNo, certs: jobCerts }))
    .sort((a, b) => latestTimestamp(b.certs).localeCompare(latestTimestamp(a.certs)));
}

function groupByType(certs: InspectionCertificate[]): TypeGroup[] {
  const byType = new Map<string, TypeGroup>();
  for (const c of certs) {
    const label = reportTypeLabel(c);
    let group = byType.get(label);
    if (!group) {
      group = { key: label, label, certs: [] };
      byType.set(label, group);
    }
    group.certs.push(c);
  }
  for (const group of byType.values()) {
    const first = group.certs[0];
    if (first?.type === "loosegear" && first.looseGear?.subType === "standard_report") {
      group.jobGroups = groupByJobNo(group.certs);
    }
  }
  return Array.from(byType.values()).sort((a, b) => latestTimestamp(b.certs).localeCompare(latestTimestamp(a.certs)));
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
      group = { key, vesselName, imoNo, certs: [], certsByType: [] };
      byVessel.set(key, group);
    }
    group.certs.push(c);
  }

  for (const group of byVessel.values()) {
    group.certs.sort((a, b) => (b.issuedAt || b.savedAt || "").localeCompare(a.issuedAt || a.savedAt || ""));
    group.certsByType = groupByType(group.certs);
  }

  return Array.from(byVessel.values()).sort((a, b) => {
    const aLatest = a.certs[0]?.issuedAt || a.certs[0]?.savedAt || "";
    const bLatest = b.certs[0]?.issuedAt || b.certs[0]?.savedAt || "";
    return bLatest.localeCompare(aLatest);
  });
}
