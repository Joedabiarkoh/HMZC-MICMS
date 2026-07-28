import { INSPECTION_TYPES } from "./inspectionChecklists";
import { FFE_CERT_TYPES } from "./ffeCertTypes";
import {
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

export function makeChecklist(sections: ChecklistSectionDef[] = []): ChecklistSection[] {
  return sections.map((sec) => ({
    code: sec.code,
    name: sec.name,
    conditional: !!sec.conditional,
    hydraulicGate: !!sec.hydraulicGate,
    items: sec.items.map((label) => ({ label, status: "good" as const, remark: "" })),
    special: (sec.special || []).map((sp) => ({ label: sp.label, presetRemark: sp.presetRemark, status: "good" as const, remark: "" })),
  }));
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
    crane: "CR", firefighting: "FF", loosegear: "LG",
  };
  const tag = tags[type];
  const count = Array.from(existingNumbers).filter((k) => k.includes(ymd) && k.includes(tag)).length + 1;
  return `CERT/HMZCS/${tag}/${ymd}-${String(count).padStart(3, "0")}`;
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
    location: "",
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

export const LOOSE_GEAR_SUB_TYPES: { id: LooseGearData["subType"]; label: string }[] = [
  { id: "visual_certificate", label: "Visual Certificate of Thorough Examination" },
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
    dateOfExamination: "",
    dateOfReport: "",
    reportNumber: "",
    clientEmployerNameAddress: "",
    premisesAddress: "",
    equipmentDescription: "",
    swl: "",
    dateOfManufacture: "",
    dateOfLastExamination: "",
    statutory: freshLooseGearStatutoryAnswers(),
    reportedByNameAndQualifications: "",
    authenticatedByName: "",
    nextExaminationDue: "",
    authenticatingEmployerNameAddress: "",
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
export function freshLooseGearState(subTypeId: LooseGearData["subType"] = "visual_certificate"): LooseGearData {
  const base: LooseGearData = { subType: subTypeId };
  if (subTypeId === "visual_certificate") base.visualCert = freshLooseGearVisualCertData();
  else if (subTypeId === "standard_report") base.standardReport = freshLooseGearStandardReportData();
  else if (subTypeId === "multiple_items") base.multipleItems = freshLooseGearMultipleItemsData();
  return base;
}
