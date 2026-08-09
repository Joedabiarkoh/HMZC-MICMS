import { INSPECTION_TYPES } from "./inspectionChecklists";
import { FFE_CERT_TYPES } from "./ffeCertTypes";
import { CALIBRATION_CERT_TYPES } from "./calibrationCertTypes";
import {
  CalibrationData,
  ChecklistSection,
  ChecklistSectionDef,
  EquipmentTypeKey,
  FFEChecklistResult,
  InspectionCertificate,
  LooseGearData,
  LooseGearMultipleItemsData,
  LooseGearRegisterRow,
  LooseGearStandardReportData,
  LooseGearStatutoryAnswers,
  LooseGearVisualCertData,
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
export function generateCertNo(type: EquipmentTypeKey, existingNumbers: Set<string>): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const tags: Record<EquipmentTypeKey, string> = {
    lifeboat: "LB", rescueboat: "RB", freefall_dry: "FFD", freefall_tanker: "FFT",
    crane: "CR", firefighting: "FF", loosegear: "LG", calibration: "CAL",
    photo_report: "PR",
  };
  const tag = tags[type];
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
  };
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
    examinerPosition: "",
    leeaIdNumber: "",
  };
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

export function freshLooseGearMultipleItemsData(): LooseGearMultipleItemsData {
  return { jobPoNo: "", inspectedBy: "", colourCode: "", reasonForInspection: "", rows: [] };
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
  return base;
}
