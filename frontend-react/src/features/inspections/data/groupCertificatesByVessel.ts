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

export interface TypeGroup {
  key: string;
  label: string;
  certs: InspectionCertificate[];
}

export interface JobGroup {
  jobNo: string;
  certs: InspectionCertificate[];
  // Requested directly: "the job creation number should be for all
  // the certificate" — a Job can now cover certificates of several
  // different equipment types issued on the same vessel visit (a
  // lifeboat cert, a crane cert, and a batch of Loose Gear items, all
  // under one PO), so each job is further broken out by report type
  // here, same grouping reportTypeLabel already gives every other
  // level of this file.
  certsByType: TypeGroup[];
}

export interface VesselGroup {
  key: string;
  vesselName: string;
  imoNo: string;
  certs: InspectionCertificate[];
  // Requested directly: "so that all certificate issued will stay
  // under that job number and easy to track, as the same vessel can
  // be visited on different occassion for different POs" — Job (see
  // looseGear... no, cert.jobRef now, backend-fastapi's Job model) is
  // the primary grouping under a vessel: each visit/PO is its own
  // job, and everything issued during it — regardless of equipment
  // type — collapses into that one batch. Legacy certificates that
  // predate the Job feature (empty jobRef) fall into a "(no job)"
  // bucket rather than being silently dropped.
  certsByJob: JobGroup[];
}

function latestTimestamp(certs: InspectionCertificate[]): string {
  return certs[0]?.issuedAt || certs[0]?.savedAt || "";
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
  return Array.from(byType.values()).sort((a, b) => latestTimestamp(b.certs).localeCompare(latestTimestamp(a.certs)));
}

function groupByJobNo(certs: InspectionCertificate[]): JobGroup[] {
  const byJob = new Map<string, InspectionCertificate[]>();
  for (const c of certs) {
    const jobNo = c.jobRef?.trim() || "(no job)";
    const bucket = byJob.get(jobNo);
    if (bucket) bucket.push(c);
    else byJob.set(jobNo, [c]);
  }
  return Array.from(byJob.entries())
    .map(([jobNo, jobCerts]) => ({ jobNo, certs: jobCerts, certsByType: groupByType(jobCerts) }))
    .sort((a, b) => latestTimestamp(b.certs).localeCompare(latestTimestamp(a.certs)));
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
      group = { key, vesselName, imoNo, certs: [], certsByJob: [] };
      byVessel.set(key, group);
    }
    group.certs.push(c);
  }

  for (const group of byVessel.values()) {
    group.certs.sort((a, b) => (b.issuedAt || b.savedAt || "").localeCompare(a.issuedAt || a.savedAt || ""));
    group.certsByJob = groupByJobNo(group.certs);
  }

  return Array.from(byVessel.values()).sort((a, b) => {
    const aLatest = a.certs[0]?.issuedAt || a.certs[0]?.savedAt || "";
    const bLatest = b.certs[0]?.issuedAt || b.certs[0]?.savedAt || "";
    return bLatest.localeCompare(aLatest);
  });
}
