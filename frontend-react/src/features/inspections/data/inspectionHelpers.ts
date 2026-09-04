import { INSPECTION_TYPES } from "./inspectionChecklists";
import { FFE_CERT_TYPES } from "./ffeCertTypes";
import { CALIBRATION_CERT_TYPES } from "./calibrationCertTypes";
import { FRC_COMPONENT_ROWS, FRC_FUNCTION_CHECKS } from "./frcServiceReport";
import {
  CalibrationData,
  ChecklistSection,
  ChecklistSectionDef,
  EquipmentTypeKey,
  FFEChecklistResult,
  FRCCheckAnswer,
  FRCServiceReportData,
  FRCSparePartRow,
  InspectionCertificate,
  LooseGearData,
  LooseGearDefectReportData,
  LooseGearDefectRow,
  LooseGearMultipleItemsData,
  LooseGearRegisterRow,
  LooseGearStandardReportData,
  LooseGearStatutoryAnswers,
  LooseGearSubTypeId,
  LooseGearVisualCertData,
  NDTCommonData,
  NDTFooterData,
  MPIData,
  PTData,
  RTData,
  UTData,
  VTData,
  ETData,
  LoadTestData,
  LoadTestRow,
} from "../types/inspection.types";

// Requested directly: items used to default to "good" (matching the
// paper checklists this replaced, which come pre-ticked the same way),
// but that made it impossible to tell "a technician reviewed this and
// it's genuinely fine" apart from "nobody has looked at it yet" — which
// is exactly why there was previously no real per-item progress
// tracking or "this section still has unattended items" warning, only
// an honest "opened this tab at least once" indicator (see
// InspectionWorkspace.tsx's visitedTabs). Blank by default now, and
// every item must be explicitly set before a certificate can be
// finalized (see checklistProgress below and its use in
// getFinalizeBlockers) — the tradeoff being every one of a lifeboat's
// 60+ checklist items now needs an explicit tap instead of only the
// exceptions to "Good," a real cost weighed against the data-integrity
// gain of provably-reviewed items.
export function makeChecklist(sections: ChecklistSectionDef[] = []): ChecklistSection[] {
  return sections.map((sec) => ({
    code: sec.code,
    name: sec.name,
    conditional: !!sec.conditional,
    hydraulicGate: !!sec.hydraulicGate,
    items: sec.items.map((label) => ({ label, status: "" as const, remark: "" })),
    special: (sec.special || []).map((sp) => ({ label: sp.label, presetRemark: sp.presetRemark, status: "" as const, remark: "" })),
  }));
}

export interface ChecklistProgress {
  total: number;
  completed: number;
}

// A hydraulicGate section only applies to rescueboat certificates with
// hydraulicFitted checked (see ChecklistGroup.tsx's own disabled state)
// — excluded from progress/completion entirely when it doesn't apply,
// same as it's already excluded from rendering.
function checklistSectionIsActive(section: ChecklistSection, equipmentType: EquipmentTypeKey, hydraulicFitted?: boolean): boolean {
  if (section.hydraulicGate && equipmentType === "rescueboat" && !hydraulicFitted) return false;
  return true;
}

export function checklistProgress(
  sections: ChecklistSection[] | undefined,
  equipmentType: EquipmentTypeKey,
  hydraulicFitted?: boolean
): ChecklistProgress {
  let total = 0;
  let completed = 0;
  for (const section of sections || []) {
    if (!checklistSectionIsActive(section, equipmentType, hydraulicFitted)) continue;
    for (const item of [...section.items, ...section.special]) {
      total += 1;
      if (item.status !== "") completed += 1;
    }
  }
  return { total, completed };
}

// Was `existing: Record<string, InspectionCertificate>` — changed to
// just the set of cert_no strings once list_certificates started
// filtering non-view_all accounts to their own certificates (see the
// "each person only sees what they issued" permission change). Counting
// against the full certificates dict would have meant counting only
// what THIS user can see, not the whole company's issuance for the
// day — a guaranteed numbering collision between two technicians who
// each create a certificate on the same day. See listCertificateNumbers
// in inspection.api.ts for where the caller gets the full, unfiltered
// set this now expects.
// Requested directly: give the new Load Test/NDT Loose Gear report
// types (see LooseGearSubTypeId) their own recognizable prefix in the
// Certificate Log instead of sharing Loose Gear's flat "LG" tag — closer
// to how real NDT report numbers are usually structured, and easier to
// find/sort by method. Every OTHER loosegear sub-type (Visual
// Certificate, Standard Report, Multiple Items) keeps "LG", unchanged.
const LOOSE_GEAR_SUBTYPE_TAGS: Partial<Record<LooseGearSubTypeId, string>> = {
  load_test: "LT", mpi: "MT", pt: "PT", rt: "RT", ut: "UT", vt: "VT", et: "ET",
  // Requested directly: "the defect report should be separate" — its
  // own tag for the same reason the NDT methods each got one, easier to
  // find/sort by report type in the Certificate Log.
  defect_report: "DR",
};

export function generateCertNo(
  type: EquipmentTypeKey,
  existingNumbers: Set<string>,
  looseGearSubType?: LooseGearSubTypeId,
  // Requested directly: give the FRC Service Report its own
  // recognizable prefix instead of sharing Rescue Boat's flat "RB" tag
  // — same reasoning as LOOSE_GEAR_SUBTYPE_TAGS above, easier to find/
  // sort by report type in the Certificate Log. Only ever true when
  // InspectionWorkspace.tsx's "Report Type" toggle has switched a
  // Rescue Boat draft to the FRC Service Report — see
  // InspectionCertificate.frcServiceReport's own comment.
  frcService?: boolean
): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const tags: Record<EquipmentTypeKey, string> = {
    lifeboat: "LB", rescueboat: "RB", freefall_dry: "FFD", freefall_tanker: "FFT",
    crane: "CR", firefighting: "FF", loosegear: "LG", calibration: "CAL",
    // photo_report (no longer offered for new certs, see TYPE_GROUPS
    // in InspectionWorkspace.tsx) keeps its old tag so this map stays
    // exhaustive over EquipmentTypeKey — it just never gets hit by a
    // brand-new certificate anymore.
    photo_report: "PR", ffe_photo_report: "FPR", calibration_photo_report: "CPR",
  };
  const tag =
    (type === "loosegear" && looseGearSubType && LOOSE_GEAR_SUBTYPE_TAGS[looseGearSubType]) ||
    (type === "rescueboat" && frcService && "FRC") ||
    tags[type];
  const count = Array.from(existingNumbers).filter((k) => k.includes(ymd) && k.includes(tag)).length + 1;
  // Requested directly: "CERT/HMZCS/RB/20260807-001 this certificate
  // number for all certificate take out the (S)" — was HMZCS, now
  // HMZC. Only affects newly-generated numbers going forward;
  // certificates already issued keep their original number as
  // printed/on file, never rewritten retroactively.
  return `CERT/HMZC/${tag}/${ymd}-${String(count).padStart(3, "0")}`;
}

export function freshCertificate(type: EquipmentTypeKey, existingNumbers: Set<string>): InspectionCertificate {
  const cfg = INSPECTION_TYPES[type];
  const base: InspectionCertificate = {
    certNo: generateCertNo(type, existingNumbers),
    type,
    status: "draft",
    dateOfServicing: new Date().toISOString().slice(0, 10),
    lastServicing: "",
    portServicing: "",
    kindOfServicing: "Annual",
    vesselName: "",
    imoNo: "",
    flag: "",
    location: "",
    jobRef: "",
    remarks: cfg.remarksTemplate ? cfg.remarksTemplate("") : "",
    remarksAuto: true,
    outstanding: {},
    photos: {},
    captainName: "",
    engineerName: "",
    captainSig: "",
    engineerSig: "",
    fitForPurpose: "",
    savedAt: null,
    savedBy: "",
  };

  if (cfg.kind === "ffe") {
    base.ffe = freshFFEState(FFE_CERT_TYPES[0].id);
  } else if (cfg.kind === "boat") {
    base.capacity = "";
    base.boat = { typeName: "", serial: "", mfgDate: "", manufacturer: "" };
    base.release = { typeName: "", serial: "", mfgDate: "", manufacturer: "" };
    base.davit = { typeName: "", serial: "", mfgDate: "", manufacturer: "" };
    base.winch = { typeName: "", serial: "", mfgDate: "", manufacturer: "" };
    base.hydraulicFitted = false;
    base.boatChecklist = makeChecklist(cfg.boatSections);
    base.davitChecklist = makeChecklist(cfg.davitSections);
    base.equip = (cfg.equipItems || []).map((e) => ({ ...e, result: "ok", remark: e.exp ? "" : "GOOD" }));
  } else if (cfg.kind === "crane") {
    base.crane = { typeName: "", serial: "", swl: "", manufacturer: "", mfgDate: "" };
    base.wireRope = { typeName: "", diameter: "", length: "", certNo: "", dateInstalled: "" };
    base.checklist = makeChecklist(cfg.checklistSections);
    base.loadTest = { testLoad: "", swlPercent: "", radius: "", duration: "", result: "pass", testCertNo: "", remark: "" };
  } else if (cfg.kind === "loosegear") {
    base.looseGear = freshLooseGearState();
  } else if (cfg.kind === "calibration") {
    base.calibration = freshCalibrationState(CALIBRATION_CERT_TYPES[0].id);
  }

  return base;
}

// Rebuilds the FFE-specific state for a given sub-type — called both
// when a brand-new FFE certificate starts and when the sub-type
// selector changes on an existing draft (switching from, say, "Fire
// Extinguisher" to "Fixed CO2 System" needs a completely different set
// of technical fields/checklist, not the old sub-type's leftover data).
export function freshFFEState(subTypeId: string) {
  const cfg = FFE_CERT_TYPES.find((t) => t.id === subTypeId) || FFE_CERT_TYPES[0];
  const technicalValues: Record<string, string> = {};
  for (const f of cfg.technicalFields || []) technicalValues[f.key] = "";

  const checklist: FFEChecklistResult[] = (cfg.checklistItems || []).map((c) => ({
    no: c.no,
    description: c.description,
    result: "" as const,
    comment: "",
  }));

  return {
    subType: cfg.id,
    certClass: "",
    placeOfService: "",
    technicalValues,
    items: [] as Record<string, string>[],
    items2: [] as Record<string, string>[],
    checklist,
    comments: "",
    variant: "",
  };
}

// Rebuilds the checklist when the person picks which specific system
// (Watermist/Sprinkler/Deluge, see FFESystemVariant in ffeCertTypes.ts)
// is actually installed, within the same watermist_system sub-type —
// deliberately NOT freshFFEState/changeSubType, which wipe everything;
// switching the variant must preserve technicalValues, items, items2,
// comments, and the shared checklist rows' own answers untouched. Only
// the variant-specific tail — everything past the sub-type's own fixed
// checklistItems — gets replaced with fresh, unanswered rows for the
// newly picked variant. A full replace of the tail (not an append) so
// switching Watermist -> Sprinkler -> Deluge -> Watermist any number of
// times never accumulates a previous variant's rows alongside the new
// one. A variant's own extra-item answers intentionally do NOT survive
// switching away and back — a Sprinkler-specific answer means nothing
// once the inspector is looking at a Deluge system.
export function changeFFEVariant(ffe: { subType: string; checklist: FFEChecklistResult[] }, variantId: string): { variant: string; checklist: FFEChecklistResult[] } {
  const cfg = FFE_CERT_TYPES.find((t) => t.id === ffe.subType) || FFE_CERT_TYPES[0];
  const variant = cfg.variants?.find((v) => v.id === variantId);
  const sharedCount = cfg.checklistItems?.length || 0;
  const sharedRows = ffe.checklist.slice(0, sharedCount);
  const extraRows: FFEChecklistResult[] = (variant?.extraChecklistItems || []).map((c) => ({
    no: c.no,
    description: c.description,
    result: "" as const,
    comment: "",
  }));
  return { variant: variantId, checklist: [...sharedRows, ...extraRows] };
}

// Rebuilds the Calibration-specific state for a given sub-type — same
// reasoning as freshFFEState above, since a new sub-type has a
// completely different technicalFields/items/items2 column set. Unlike
// FFE, items2 (Test Data/Test Result/Calibration Results) starts
// pre-loaded from the sub-type's defaultItems2 — the fixed test points
// every real certificate for this instrument type actually used (see
// calibrationCertTypes.ts) — rather than empty, so the technician edits
// an already-correct template instead of re-typing it from scratch each
// time. items (Unit(s) Under Test) stays empty since it's genuinely
// specific to the instrument being calibrated, not a fixed template.
export function freshCalibrationState(subTypeId: string): CalibrationData {
  const cfg = CALIBRATION_CERT_TYPES.find((t) => t.id === subTypeId) || CALIBRATION_CERT_TYPES[0];
  const technicalValues: Record<string, string> = {};
  for (const f of cfg.technicalFields || []) technicalValues[f.key] = "";

  const items2 = (cfg.defaultItems2 || []).map((row) => {
    const full: Record<string, string> = {};
    for (const c of cfg.items2Columns) full[c.key] = row[c.key] || "";
    return full;
  });

  return {
    subType: cfg.id,
    certClass: "",
    placeOfService: "",
    technicalValues,
    items: [] as Record<string, string>[],
    items2,
    comments: "",
  };
}

// Requested directly: "keep only this and the multiple items" — the
// legacy Visual Certificate template (LooseGearVisualCertData,
// VisualCertPage, VisualCertForm) is deliberately NOT deleted, just no
// longer offered here: any certificate already saved with
// subType: "visual_certificate" still opens, edits, and prints exactly
// as before (see LooseGearForm.tsx's own conditional render and
// CertificatePreview.tsx's LooseGearCertificatePage), it just can't be
// chosen for a new one anymore.
export const LOOSE_GEAR_SUB_TYPES: { id: LooseGearData["subType"]; label: string }[] = [
  { id: "standard_report", label: "Report of Thorough Examination" },
  { id: "multiple_items", label: "Report of Thorough Examination (Multiple Items)" },
  { id: "load_test", label: "Load Test Report" },
  { id: "mpi", label: "Magnetic Particle Testing (MPI)" },
  { id: "pt", label: "Liquid Penetrant Testing (PT)" },
  { id: "rt", label: "Radiographic Testing (RT)" },
  { id: "ut", label: "Ultrasonic Testing (UT)" },
  { id: "vt", label: "Visual Testing (VT)" },
  { id: "et", label: "Eddy Current Testing (ET)" },
  // Requested directly: "the defect report should be separate, it
  // should not merge with the multiple items list" — its own
  // selectable report type, see LooseGearDefectReportData's own
  // comment in inspection.types.ts.
  { id: "defect_report", label: "Defect Report" },
];

// Requested directly, from a real reference form (LEEA-030.1d): the
// Multiple Items register's per-row Status (was "Result", free text —
// see LooseGearRegisterRow.result's own comment). One shared source
// used by LooseGearForm.tsx's <select>, CertificatePreview.tsx's
// printed legend, and certificateDocxExport.ts's Word export, so the
// three can't drift out of sync with each other.
export const LOOSE_GEAR_STATUS_CODES: { code: string; label: string }[] = [
  { code: "ND", label: "ND – No Defect" },
  { code: "SDR", label: "SDR – See Defect Report" },
  { code: "NF", label: "NF – Not Found" },
  { code: "OBS", label: "OBS – Observation (see Defect Report)" },
];

// Requested directly: "start with 1" of a 3-item list — one config per
// register, consumed by RegisterEditTable/RegisterPreviewTable
// (components/RegisterTable.tsx) for the form and print/preview, and
// by certificateDocxExport.ts's own registerColumnsToDocxRows for the
// Word export. See RegisterTable.tsx's own top comment for the full
// reasoning (the class of bug this replaces, and why it's scoped to
// Loose Gear rather than widening FFE's own ItemTable).
export type RegisterColumnType = "text" | "date" | "select" | "yesno";

export interface RegisterColumn {
  key: string;
  label: string;
  type?: RegisterColumnType; // default "text"
  options?: { value: string; label: string }[]; // required for "select"
  disabledWhen?: (row: Record<string, string>) => boolean;
  disabledPlaceholder?: string;
}

export const MULTIPLE_ITEMS_REGISTER_COLUMNS: RegisterColumn[] = [
  { key: "serialNo", label: "Serial No." },
  { key: "description", label: "Description" },
  { key: "swl", label: "SWL" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "certNoTestDate", label: "Cert No./Test Date" },
  { key: "itemLocation", label: "Location" },
  { key: "typeOfInspection", label: "Type of Inspection" },
  { key: "nextInspectionDate", label: "Next Inspection", type: "date" },
  // Requested directly: "change result to (status) and move it to the
  // end close to safe to use" — see LooseGearRegisterRow.result's own
  // comment on why the field key itself stays `result`.
  { key: "result", label: "Status", type: "select", options: LOOSE_GEAR_STATUS_CODES.map((s) => ({ value: s.code, label: s.label })) },
  { key: "safeToUse", label: "Safe to Use", type: "yesno" },
];

export const DEFECT_REPORT_COLUMNS: RegisterColumn[] = [
  { key: "equipmentIdNo", label: "Equipment ID No." },
  { key: "equipmentDescription", label: "Equipment Description" },
  { key: "defectiveParts", label: "Defective Parts" },
  // "Is the defect an existing or imminent danger" — the source form's
  // own footnote: "*If yes must be reported to HSE."
  { key: "immediateDanger", label: "Immediate Danger *", type: "yesno" },
  {
    key: "whenBecomesDanger",
    label: "When Will It Become a Danger",
    disabledWhen: (row) => row.immediateDanger === "yes",
    disabledPlaceholder: "N/A — immediate danger",
  },
  { key: "repairParticulars", label: "Repair/Renewal/Alteration Particulars" },
];

// The FRC Service Report's own "Spare Parts / Materials Used" table —
// genuinely open-ended (unlike its fixed Components Removed/Installed
// table, see FRC_COMPONENT_ROWS in frcServiceReport.ts), so it reuses
// the same RegisterEditTable/RegisterPreviewTable infrastructure the
// two Loose Gear registers above already do.
export const FRC_SPARE_PARTS_COLUMNS: RegisterColumn[] = [
  { key: "description", label: "Description" },
  { key: "partNo", label: "Part No." },
  { key: "qty", label: "Qty" },
  { key: "unit", label: "Unit" },
];

function freshLooseGearStatutoryAnswers(): LooseGearStatutoryAnswers {
  return {
    firstExaminationAfterInstall: "",
    installedCorrectly: "",
    examinedWithin6Months: "",
    examinedWithin12Months: "",
    inAccordanceWithScheme: "",
    afterExceptionalCircumstances: "",
    defectDescription: "",
    existingOrImminentDanger: "",
    couldBecomeDangerBy: "",
    repairParticulars: "",
    testsCarriedOut: "",
    observations: "",
    safeToOperate: "",
  };
}

export function freshLooseGearVisualCertData(): LooseGearVisualCertData {
  return {
    clientOwner: "",
    site: "",
    siteLocation: "",
    chargeCodeOrderNo: "",
    poJobNo: "",
    colorCode: "",
    inspectionType: "",
    standard: "",
    itemSerialNo: "",
    itemDescription: "",
    swl: "",
    itemLocation: "",
    previousCertificateNo: "",
    manufacturer: "",
    previousInspectionDate: "",
    testDate: "",
    ecDeclarationAvailable: "",
    ceMarkVisible: "",
    statutory: freshLooseGearStatutoryAnswers(),
    reportedByNameAndQualifications: "",
    authenticatedByName: "",
    nextExaminationDue: "",
    employerNameAddress: "",
  };
}

export function freshLooseGearStandardReportData(): LooseGearStandardReportData {
  return {
    customerDetails: "",
    siteAddress: "",
    dateOfExamination: "",
    dateOfReport: "",
    examinationType: "",
    jobNo: "",
    prevExamDate: "",
    nextExamDate: "",
    installedCorrectly: "",
    idNo: "",
    description: "",
    modelDetails: "",
    serialNos: [""],
    manufacturer: "",
    prvFitted: "",
    mfgDate: "",
    itemLocation: "",
    swl: "",
    ewl: "",
    mbl: "",
    factorOfSafety: "",
    examinationCarriedOut: "Thorough Examination",
    examinationResult: "",
    safeForUse: "",
    defectsImmediate: "",
    defectImmediateDanger: "",
    defectsObservation: "",
    testsCarriedOut: "",
    additionalComments: "",
    result: "",
  };
}

// Found by checking every Loose Gear type for the pattern behind an
// earlier white-page bug (a field added to an already-shipped type, so
// an older certificate's stored JSON simply doesn't have it):
// `serialNo` (a single string) was renamed to `serialNos: string[]` in
// commit 46ee3d0, well after standard_report certificates already
// existed — those older certificates' stored JSON still has the OLD
// key, not the new array, so `data.serialNos.map()`/`.length` throws on
// `undefined`. Worse than a genuinely new field though: the
// technician's serial number is still sitting right there in the
// old JSON under the old key — falling back to `[]` would make it
// silently vanish from view instead of just being empty, so this
// recovers it rather than discarding it.
export function normalizedSerialNos(data: LooseGearStandardReportData): string[] {
  if (data.serialNos && data.serialNos.length) return data.serialNos;
  const legacy = (data as unknown as { serialNo?: string }).serialNo;
  return legacy ? [legacy] : [];
}

export function freshLooseGearRegisterRow(): LooseGearRegisterRow {
  return {
    serialNo: "",
    description: "",
    swl: "",
    manufacturer: "",
    result: "",
    certNoTestDate: "",
    itemLocation: "",
    typeOfInspection: "",
    nextInspectionDate: "",
    safeToUse: "",
  };
}

export function freshLooseGearDefectRow(): LooseGearDefectRow {
  return { equipmentIdNo: "", equipmentDescription: "", defectiveParts: "", immediateDanger: "", whenBecomesDanger: "", repairParticulars: "" };
}

export function freshLooseGearMultipleItemsData(): LooseGearMultipleItemsData {
  return { jobPoNo: "", inspectedBy: "", colourCode: "", reasonForInspection: "", rows: [] };
}

export function freshLooseGearDefectReportData(): LooseGearDefectReportData {
  return { referencedReportNo: "", defects: [], defectObservations: "" };
}

// Shared builders for the Load Test / NDT report types (MPI/PT/RT/UT/VT/ET)
// — see NDTCommonData/NDTFooterData's own comments in inspection.types.ts.
function freshNDTCommonData(): NDTCommonData {
  return { client: "", manufacturer: "", objectOfControl: "", poNo: "", procedureReference: "", drawingNo: "", extentOfTesting: "", acceptanceStandard: "", operator: "" };
}

// "HMZC" matches every one of the source templates' own Serial no.
// default (see the "Serial no.: HMZC" row on all 7).
function freshNDTFooterData(): NDTFooterData {
  return { findingsStatement: "", serialNo: "HMZC", repairsMarkedOnObject: false, repairsMarkedOnSketch: false };
}

export function freshMPIData(): MPIData {
  return {
    common: freshNDTCommonData(),
    materialType: "", surface: "", grooveGeometry: "", weldingProcess: "", weldersId: "", objectTemperature: "",
    method: "", methodSMax: "", current: "", fieldStrength: "",
    mediumWetDry: "", mediumType: "", contrastColour: "", fieldIndicator: "",
    magnetizedFor: "",
    footer: freshNDTFooterData(),
  };
}

export function freshPTData(): PTData {
  return {
    common: freshNDTCommonData(),
    materialType: "", surface: "", grooveGeometry: "", weldingProcess: "", weldersId: "", objectTemperature: "",
    penetrantType: "", applicationMethod: "", fluorescent: "",
    penetrantRemover: "", developer: "", penetrationTime: "", developingTime: "",
    footer: freshNDTFooterData(),
  };
}

export function freshRTIndicationRow(): Record<string, string> {
  return { filmImageNo: "", weldLocation: "", indicationType: "", size: "", evaluation: "" };
}

export function freshRTData(): RTData {
  return {
    common: freshNDTCommonData(),
    materialType: "", thickness: "", jointWeldType: "", weldingProcess: "", weldersId: "", technique: "",
    sourceType: "", focalSpotSize: "", kvOrCurie: "", maOrExposureTime: "", sourceToFilmDistance: "", screens: "", filmTypeOrDetector: "", densityRange: "",
    iqiType: "", sensitivityAchieved: "", numberOfExposures: "", viewingConditions: "",
    indications: [],
    footer: freshNDTFooterData(),
  };
}

export function freshUTIndicationRow(): Record<string, string> {
  return { indNo: "", weldLocation: "", length: "", amplitude: "", depth: "", evaluation: "" };
}

export function freshUTData(): UTData {
  return {
    common: freshNDTCommonData(),
    materialType: "", surface: "", grooveGeometry: "", weldingProcess: "", weldersId: "", objectTemperature: "",
    instrumentTypeModel: "", instrumentSerialNo: "", calibrationDueDate: "", referenceBlock: "",
    probeType: "", probeFrequency: "", probeAngle: "", probeSize: "", couplant: "", scanningTechnique: "",
    referenceLevel: "", scanningSensitivity: "", recordingLevel: "", reportingLevel: "", scanCoverage: "", beamAngleCheck: "",
    indications: [],
    footer: freshNDTFooterData(),
  };
}

export function freshVTObservationRow(): Record<string, string> {
  return { itemNo: "", locationWeld: "", observation: "", evaluation: "" };
}

export function freshVTData(): VTData {
  return {
    common: freshNDTCommonData(),
    materialType: "", jointWeldType: "", surfaceCondition: "", weldingProcess: "", weldersId: "", stageOfInspection: "",
    illuminationLevel: "", viewingDistanceAngle: "", aidsUsed: "", directOrRemote: "",
    observations: [],
    footer: freshNDTFooterData(),
  };
}

export function freshETIndicationRow(): Record<string, string> {
  return { indNo: "", weldLocation: "", signalAmplitude: "", phaseAngle: "", evaluation: "" };
}

export function freshETData(): ETData {
  return {
    common: freshNDTCommonData(),
    materialType: "", surface: "", grooveGeometry: "", weldingProcess: "", weldersId: "", objectTemperature: "",
    instrumentTypeModel: "", instrumentSerialNo: "", calibrationDueDate: "", referenceStandardBlock: "",
    probeType: "", frequency: "", gain: "", phaseAngle: "", scanCoverage: "", scanSpeed: "",
    indications: [],
    footer: freshNDTFooterData(),
  };
}

// Matches the source template's own row set/order (rows A-G³) — labels
// and description text are fixed (printed on the reference form), only
// `value` is meant to be filled in per test.
export function freshLoadTestRows(): LoadTestRow[] {
  return [
    { label: "A", description: "Insert weight of empty boat + inventory/equipment. (From LB Certificate/ID Plate).", value: "" },
    { label: "B", description: "Insert total No. persons in lifeboat × applicable weight of persons.", value: "" },
    { label: "C", description: "Insert total weight of fully loaded boat incl. total number of persons (C = A + B)", value: "" },
    { label: "D", description: "Insert 10% of total weight. (D = C ÷ 10)", value: "" },
    { label: "E", description: "Insert total of all applicable weights (E = C + D)", value: "" },
    { label: "F", description: "Load to be applied, minus empty boat + inventory/equipment (F = E - A)", value: "" },
    { label: "G¹", description: "Load to be applied per davit arm, when using water bags only (G¹ = E ÷ 2)", value: "" },
    { label: "G²", description: "Load to be applied when using water bags and lifeboat (G² = F ÷ size of water bag)", value: "" },
    { label: "G³", description: "Pressure to be applied per hook, when using hydraulic test kit (G³ = total bar based on F in conversion table)", value: "" },
  ];
}

export function freshLoadTestData(): LoadTestData {
  return { typeOfLsaEquipment: "", lsaLocationOnboard: "", rows: freshLoadTestRows(), remarks: "" };
}

// Rebuilds the loosegear-specific state for a given sub-type — called
// both when a brand-new certificate starts and when the sub-type
// selector changes on an existing draft (switching from, say, the
// single-item "Visual Certificate" to the "Multiple Items" register
// needs a completely different data shape, not the old sub-type's
// leftover fields — same reasoning as freshFFEState above).
export function freshLooseGearState(subTypeId: LooseGearData["subType"] = "standard_report"): LooseGearData {
  const base: LooseGearData = { subType: subTypeId };
  if (subTypeId === "visual_certificate") base.visualCert = freshLooseGearVisualCertData();
  else if (subTypeId === "standard_report") base.standardReport = freshLooseGearStandardReportData();
  else if (subTypeId === "multiple_items") base.multipleItems = freshLooseGearMultipleItemsData();
  else if (subTypeId === "load_test") base.loadTest = freshLoadTestData();
  else if (subTypeId === "mpi") base.mpi = freshMPIData();
  else if (subTypeId === "pt") base.pt = freshPTData();
  else if (subTypeId === "rt") base.rt = freshRTData();
  else if (subTypeId === "ut") base.ut = freshUTData();
  else if (subTypeId === "vt") base.vt = freshVTData();
  else if (subTypeId === "et") base.et = freshETData();
  else if (subTypeId === "defect_report") base.defectReport = freshLooseGearDefectReportData();
  return base;
}

export function freshFRCSparePartRow(): FRCSparePartRow {
  return { description: "", partNo: "", qty: "", unit: "" };
}

// Built when InspectionWorkspace.tsx's "Report Type" toggle switches a
// Rescue Boat draft to the FRC Service Report — see
// InspectionCertificate.frcServiceReport's own comment for why this is
// a data-presence switch rather than a sub-type selector nested inside
// an existing data object the way freshLooseGearState above is.
export function freshFRCServiceReportState(): FRCServiceReportData {
  return {
    subType: "frc_service",
    serviceType: "",
    attendingEngineer: "",
    nextServiceDue: "",
    clientOwner: "",
    vesselType: "",
    contactPerson: "",
    frcMakeModel: "",
    hullSerialNo: "",
    manufacturer: "",
    yearOfManufacture: "",
    seatingCapacity: "",
    davitLaunchingAppliance: "",
    dateOfLastService: "",
    classFlag: "",
    components: FRC_COMPONENT_ROWS.map((c) => ({ key: c.key, oldSerial: "", newSerial: "", qty: "", expiry: "" })),
    checks: Object.fromEntries(FRC_FUNCTION_CHECKS.map((c) => [c.key, "" as FRCCheckAnswer])),
    findingsRemarks: "",
    recommendations: "",
    spareParts: [freshFRCSparePartRow(), freshFRCSparePartRow()],
    clientRepName: "",
    clientRepSig: "",
  };
}
