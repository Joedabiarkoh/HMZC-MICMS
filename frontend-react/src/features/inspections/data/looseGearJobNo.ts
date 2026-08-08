import { InspectionCertificate } from "../types/inspection.types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function vesselSlug(vesselName: string): string {
  return vesselName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 20) || "VESSEL";
}

// Requested directly: "advise before we start implementing" then "go
// ahead" with auto-generated Job No — one vessel visit can produce
// hundreds of individual Loose Gear "Report of Thorough Examination"
// certificates (one per item examined, see StandardReportForm's own
// comment for why these can't just be merged into one record), so
// giving them all the same Job No is what lets the Certificate Log
// group them into one batch instead of a flat list (see
// groupCertificatesByVessel.ts's jobGroups). Reuses whatever Job No
// an existing Standard Report for the SAME vessel, same calendar day,
// already has — rather than minting a fresh one per item — so a whole
// visit naturally shares one job without the technician having to
// type or remember it; only mints a new `LG-{VESSEL}-{YYYYMMDD}` when
// no such report exists yet. Never overwrites a Job No the technician
// already typed/edited themselves — see the empty-jobNo guard at the
// call site in LooseGearForm.tsx.
export function suggestLooseGearJobNo(
  certificates: Record<string, InspectionCertificate>,
  vesselName: string,
  excludeCertNo: string
): string {
  const vessel = vesselName.trim();
  if (!vessel) return "";
  const today = todayISO();
  const existing = Object.values(certificates).find((c) => {
    if (c.certNo === excludeCertNo) return false;
    if (c.type !== "loosegear" || c.looseGear?.subType !== "standard_report") return false;
    if ((c.vesselName || "").trim().toLowerCase() !== vessel.toLowerCase()) return false;
    const createdOn = (c.looseGear.standardReport?.dateOfExamination || c.savedAt || c.issuedAt || "").slice(0, 10);
    if (createdOn !== today) return false;
    return !!c.looseGear.standardReport?.jobNo?.trim();
  });
  if (existing) return existing.looseGear!.standardReport!.jobNo.trim();
  return `LG-${vesselSlug(vessel)}-${today.replace(/-/g, "")}`;
}
