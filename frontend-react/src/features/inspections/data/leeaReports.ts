// LEEA report forms (the four documents HMZC needs for LEEA approval):
//   LEEA-030.1a4  Report of Thorough Examination            (sub-type standard_report)
//   LEEA-030.1b4  Report of Thorough Examination - Unsafe   (sub-type unsafe_report)
//   LEEA-030.1c4  Report of Thorough Examination (multiple items) (sub-type multiple_items)
//   LEEA-030.1d   Defect Report List                        (sub-type defect_report)
//
// Pure helpers shared by the form, the print/preview pages and the Word
// export, so the three can never disagree about what a field means.
import type {
  LooseGearDefectReportData,
  LooseGearDefectRow,
  LooseGearExaminationType,
  LooseGearMultipleItemsData,
  LooseGearReasonForInspection,
  LooseGearRegisterRow,
  LooseGearStandardReportData,
  LooseGearYesNo,
} from "../types/inspection.types";

export interface LeeaDocMeta {
  reference: string; // "Document Reference LEEA-030.1a4"
  version: string; // "Version 1 May 2023"
  originator: string; // "Document Originator: Project Officer"
}

// Printed exactly as on the LEEA originals (their version/originator lines
// are part of the controlled document, so they are reproduced as issued).
export const LEEA_DOCS = {
  report: { reference: "LEEA-030.1a4", version: "Version 1 May 2023", originator: "Document Originator: Project Officer" },
  unsafe: { reference: "LEEA-030.1b4", version: "Version 1 May 2023", originator: "Document Originator: Project Officer" },
  multiple: { reference: "LEEA-030.1c4", version: "Version 2    June 2025", originator: "Document Originator: Project Officer" },
  defect: { reference: "LEEA- 030.1d", version: "Version 3  May 2023", originator: "Document Originator: D Hogan" },
} satisfies Record<string, LeeaDocMeta>;

export const LEEA_REPORT_TITLE = "REPORT OF THOROUGH EXAMINATION";
export const LEEA_LOLER_STATEMENT = "This report complies with the requirements of the Lifting Operations and Lifting Equipment Regulations 1998";
export const LEEA_MULTIPLE_STATEMENT = "This report meets the requirements of schedule 1 of regulation 10 of LOLER 1998";

// HMZC as "employer of persons making and authenticating this report" and
// as the "Company Name & Address" on the register - the same details the
// letterhead prints. Pre-filled so a technician only changes it if needed.
export const HMZC_COMPANY_NAME_ADDRESS =
  "HMZC LTD - Marine Engineering Services, Cabinda HQ: Urbanização 4 De Abril, Cabinda, Angola. Luanda, Benfica Rua Bento Raimundo.";
export const HMZC_COMPANY_PHONE = "+244 972 320 300";

// ---- LEEA-030.1a4 / 1b4 -----------------------------------------------

export interface LeeaExamFlags {
  firstExam: LooseGearYesNo; // "first examination after installation or assembly at a new site"
  within6Months: LooseGearYesNo;
  within12Months: LooseGearYesNo;
  underScheme: LooseGearYesNo; // "in accordance with an examination scheme"
  exceptional: LooseGearYesNo; // "after the occurrence of exceptional circumstances"
}

/**
 * One "Examination Type" choice -> the five YES/NO tick pairs on the LEEA
 * form. Nothing chosen leaves every pair unticked (a draft prints blank
 * boxes rather than a wrong answer); an older "standard" report only knows
 * it was not initial / scheme / exceptional, so the two interval boxes stay
 * blank for the examiner to settle.
 */
export function leeaExamFlags(type: LooseGearExaminationType): LeeaExamFlags {
  if (!type) return { firstExam: "", within6Months: "", within12Months: "", underScheme: "", exceptional: "" };
  const yn = (b: boolean): LooseGearYesNo => (b ? "yes" : "no");
  return {
    firstExam: yn(type === "initial"),
    within6Months: type === "standard" ? "" : yn(type === "6monthly"),
    within12Months: type === "standard" ? "" : yn(type === "12monthly"),
    underScheme: yn(type === "under_scheme"),
    exceptional: yn(type === "exceptional"),
  };
}

export const LEEA_EXAM_TYPE_LABELS: Record<Exclude<LooseGearExaminationType, "" | "standard">, string> = {
  initial: "First examination after installation / assembly at a new site",
  "6monthly": "Within an interval of 6 months",
  "12monthly": "Within an interval of 12 months",
  under_scheme: "In accordance with an examination scheme",
  exceptional: "After the occurrence of exceptional circumstances",
};

const NONE = "NONE";

/** The a4/b4 text boxes, with the "(If none state NONE)" boxes filled in. */
export interface LeeaReportView {
  employer: string;
  premises: string[];
  identification: string[];
  swl: string;
  mfgDate: string;
  prevExamDate: string;
  flags: LeeaExamFlags;
  installedCorrectly: LooseGearYesNo;
  defect: string;
  imminentDanger: LooseGearYesNo;
  dangerByDate: string;
  repair: string;
  tests: string;
  observations: string;
  safeToOperate: LooseGearYesNo;
  reporterNameQualifications: string[];
  authenticatorName: string;
  nextExamDate: string;
  reporterEmployer: string;
}

function clean(s: string | undefined | null): string {
  return (s || "").trim();
}

export function normalizedSerialList(d: LooseGearStandardReportData): string[] {
  const list = d.serialNos && d.serialNos.length ? d.serialNos : [];
  const legacy = (d as unknown as { serialNo?: string }).serialNo;
  return (list.length ? list : legacy ? [legacy] : []).map(clean).filter(Boolean);
}

export function buildLeeaReportView(
  d: LooseGearStandardReportData,
  ctx: { vesselName: string; engineerName: string }
): LeeaReportView {
  const serials = normalizedSerialList(d);
  const identification: string[] = [];
  if (clean(d.description)) identification.push(clean(d.description));
  if (clean(d.idNo)) identification.push(`Identification No: ${clean(d.idNo)}`);
  if (serials.length) identification.push(`Serial No(s): ${serials.join(", ")}`);
  if (clean(d.manufacturer)) identification.push(`Manufacturer: ${clean(d.manufacturer)}`);
  if (clean(d.modelDetails)) identification.push(`Model: ${clean(d.modelDetails)}`);
  if (clean(d.itemLocation)) identification.push(`Location: ${clean(d.itemLocation)}`);
  if (clean(d.mbl) || clean(d.factorOfSafety)) {
    identification.push(`MBL: ${clean(d.mbl) || "—"}   Factor of Safety: ${clean(d.factorOfSafety) || "—"}`);
  }
  if (d.prvFitted === "yes") identification.push("P.R.V. fitted");

  // Older reports kept two defect boxes (A: needs attention, B: keep under
  // observation); the LEEA form has one, so a saved (B) is carried along
  // rather than silently dropped from the printout.
  const defectA = clean(d.defectsImmediate);
  const defectB = clean(d.defectsObservation);
  const noneA = !defectA || defectA.toUpperCase() === NONE;
  const noneB = !defectB || defectB.toUpperCase() === NONE;
  const defect = noneA && noneB ? NONE : [noneA ? "" : defectA, noneB ? "" : `Under observation: ${defectB}`].filter(Boolean).join("\n");

  const swl = [clean(d.swl), clean(d.ewl) ? `WLL ${clean(d.ewl)}` : ""].filter(Boolean).join("\n");
  const premises = [clean(d.siteAddress), ctx.vesselName ? `Vessel: ${ctx.vesselName}` : ""].filter(Boolean);

  return {
    employer: clean(d.customerDetails),
    premises,
    identification,
    swl,
    mfgDate: d.mfgDate,
    prevExamDate: d.prevExamDate,
    flags: leeaExamFlags(d.examinationType),
    installedCorrectly: d.examinationType === "initial" ? d.installedCorrectly : "",
    defect,
    imminentDanger: d.defectImmediateDanger,
    dangerByDate: noneA && noneB ? "" : clean(d.defectDangerByDate),
    repair: clean(d.repairParticulars) || (noneA && noneB ? NONE : ""),
    tests: clean(d.testsCarriedOut) || NONE,
    observations: clean(d.additionalComments),
    safeToOperate: d.safeForUse,
    reporterNameQualifications: [ctx.engineerName, clean(d.reportedByQualifications)].filter(Boolean),
    authenticatorName: clean(d.authenticatedByName) || ctx.engineerName,
    nextExamDate: d.nextExamDate,
    reporterEmployer: clean(d.reporterEmployer),
  };
}

// ---- LEEA-030.1c4 (multiple items) ------------------------------------

export const LEEA_REASON_CODES: { value: Exclude<LooseGearReasonForInspection, "">; code: string; label: string }[] = [
  { value: "installation", code: "A", label: "Installation" },
  { value: "6monthly", code: "B", label: "6 Monthly" },
  { value: "12monthly", code: "C", label: "12 Monthly" },
  { value: "written_scheme", code: "D", label: "Written Scheme" },
  { value: "exceptional", code: "E", label: "Exceptional Circumstance" },
];

export function reasonCode(r: LooseGearReasonForInspection | undefined): string {
  return LEEA_REASON_CODES.find((x) => x.value === r)?.code || "";
}

/** A row's own reason, else the register's overall reason (older registers). */
export function rowReason(row: LooseGearRegisterRow, register: LooseGearMultipleItemsData): LooseGearReasonForInspection {
  return row.reason || register.reasonForInspection || "";
}

/** Register "Reason for Examination" -> the Examination Type of an individual report. */
export function examinationTypeFromReason(r: LooseGearReasonForInspection | undefined): LooseGearExaminationType {
  switch (r) {
    case "installation": return "initial";
    case "6monthly": return "6monthly";
    case "12monthly": return "12monthly";
    case "written_scheme": return "under_scheme";
    case "exceptional": return "exceptional";
    default: return "";
  }
}

export function isBlankRegisterRow(r: LooseGearRegisterRow): boolean {
  return !r.description.trim() && !r.serialNo.trim();
}

/** Rows that need a Defect Report List entry: status SDR/OBS, or marked not safe. */
export function rowNeedsDefectEntry(r: LooseGearRegisterRow): boolean {
  return r.result === "SDR" || r.result === "OBS" || r.safeToUse === "no";
}

export function defectRowsFromRegister(rows: LooseGearRegisterRow[]): LooseGearDefectRow[] {
  return rows
    .filter((r) => !isBlankRegisterRow(r) && rowNeedsDefectEntry(r))
    .map((r) => ({
      equipmentIdNo: r.serialNo,
      equipmentDescription: r.description,
      defectiveParts: "",
      immediateDanger: "" as LooseGearYesNo,
      whenBecomesDanger: "",
      repairParticulars: "",
    }));
}

/** "Defect / Observation sheet attached?" - yes when any row refers to one. */
export function defectSheetAttached(rows: LooseGearRegisterRow[]): boolean {
  return rows.some((r) => !isBlankRegisterRow(r) && (r.result === "SDR" || r.result === "OBS"));
}

export function freshDefectDataFromRegister(registerCertNo: string, rows: LooseGearRegisterRow[]): LooseGearDefectReportData {
  return { referencedReportNo: registerCertNo, defects: defectRowsFromRegister(rows), defectObservations: "" };
}

/** How many printed pages' worth of blank-looking rows the LEEA grid shows at minimum. */
export const LEEA_MIN_REGISTER_ROWS = 14;
export const LEEA_MIN_DEFECT_ROWS = 13;
