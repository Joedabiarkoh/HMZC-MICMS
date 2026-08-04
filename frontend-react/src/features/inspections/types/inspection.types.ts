// Types for the Inspections / Certificates module.
//
// This is the first real implementation of the "Certificates" page named
// in the architecture diagram (see src/pages/README.md) but never coded
// in the source chat. It ports the checklist system that previously
// existed as a standalone tool (hmzc_certificate_system_v3.html) into
// this project's module conventions, matching how finance.types.ts is
// structured.

export type EquipmentTypeKey =
  | "lifeboat"
  | "rescueboat"
  | "freefall_dry"
  | "freefall_tanker"
  | "crane"
  | "firefighting"
  | "loosegear"
  | "calibration";

export type ChecklistStatus = "good" | "part" | "repair" | "na" | "";

export interface ChecklistItem {
  label: string;
  status: ChecklistStatus;
  remark: string;
}

export interface SpecialChecklistItem extends ChecklistItem {
  presetRemark: string;
}

export interface ChecklistSectionDef {
  code: string;
  name: string;
  items: string[];
  special?: { label: string; presetRemark: string }[];
  conditional?: boolean;
  hydraulicGate?: boolean;
}

export interface ChecklistSection {
  code: string;
  name: string;
  conditional: boolean;
  hydraulicGate: boolean;
  items: ChecklistItem[];
  special: SpecialChecklistItem[];
}

export type EquipResult = "ok" | "expired" | "missing" | "damaged";

export interface EquipmentListItem {
  n: string;
  qty: string;
  unit: string;
  exp?: boolean;
  result: EquipResult;
  remark: string;
}

export interface IdentifiedComponent {
  typeName: string;
  serial: string;
  mfgDate: string;
  manufacturer: string;
}

export interface LoadTestRecord {
  testLoad: string;
  swlPercent: string;
  radius: string;
  duration: string;
  result: "pass" | "fail";
  testCertNo: string;
  remark: string;
}

export type CertificateStatus = "draft" | "final";

/** Full state for one certificate — mirrors the old tool's `state` object. */
export interface InspectionCertificate {
  certNo: string;
  type: EquipmentTypeKey;
  status: CertificateStatus;

  dateOfServicing: string;
  lastServicing: string;
  portServicing: string;
  kindOfServicing: "Annual" | "5-Yearly" | "Post-Repair";

  vesselName: string;
  imoNo: string;
  flag: string;
  location: string;

  // Boat-type fields (lifeboat / rescueboat / freefall_*)
  capacity?: string;
  boat?: IdentifiedComponent;
  release?: IdentifiedComponent;
  davit?: IdentifiedComponent;
  winch?: IdentifiedComponent;
  hydraulicFitted?: boolean;
  boatChecklist?: ChecklistSection[];
  davitChecklist?: ChecklistSection[];
  equip?: EquipmentListItem[];

  // Crane-type fields
  crane?: IdentifiedComponent & { swl: string };
  wireRope?: { typeName: string; diameter: string; length: string; certNo: string; dateInstalled: string };
  checklist?: ChecklistSection[];
  loadTest?: LoadTestRecord;

  // Firefighting-equipment fields (type === "firefighting")
  ffe?: FFEData;

  // Loose Gear & Lifting Equipment fields (type === "loosegear")
  looseGear?: LooseGearData;

  // Calibration fields (type === "calibration")
  calibration?: CalibrationData;

  remarks: string;
  remarksAuto: boolean;
  outstanding: Record<string, string>;
  photos: Record<string, string[]>;

  captainName: string;
  engineerName: string;
  captainSig: string;
  engineerSig: string;

  savedAt: string | null;
  savedBy: string;

  // Populated from the backend (see inspection.api.ts's fromBackend) once
  // a certificate has been synced — this is the authoritative "who issued
  // this and when" for admin visibility, tied to a real user id server-side
  // rather than the free-text savedBy above. Undefined for certificates
  // that only exist in the local offline cache and haven't synced yet.
  issuedBy?: string;
  // The numeric user id behind issuedBy's display name — requested
  // directly: once a certificate is finalized, only the person who
  // originally created it may edit it further (everyone else gets the
  // view-only preview, same as someone without edit permission at all).
  // A display name string can't be compared against the logged-in
  // user's own id, so this is tracked separately.
  issuedById?: number;
  issuedAt?: string;
  // Set once the certificate has been saved to the backend at least once
  // (see inspection.api.ts). Sent back on the next save so the server can
  // detect if someone else saved a newer edit in between — see the 409
  // handling in useInspections.ts's saveCurrent.
  version?: number;
}

// FFE (Firefighting Equipment) — one incrementable row in an item
// register table (e.g. one fire extinguisher, one BA set) or a cylinder
// specification table. Keyed loosely (Record<string,string>) rather than
// a fixed interface because the actual columns vary per FFE sub-type
// (see FFESubTypeConfig.itemColumns in ffeCertTypes.ts) — a fire
// extinguisher's row doesn't have the same fields as a CO2 cylinder's.
export type FFEItemRow = Record<string, string>;

export interface FFEChecklistResult {
  no: string;
  description: string;
  result: "done" | "not_done" | "na" | "";
  comment: string;
}

// Full FFE-specific state, present only when type === "firefighting".
// Deliberately separate from the boat/crane fields above rather than
// reusing them — an FFE certificate (e.g. a fire extinguisher register)
// has nothing in common with a lifeboat's boat/davit/winch identity
// blocks. Kept on the same InspectionCertificate interface (not a
// parallel type) so the existing save/offline-queue/vessel-search
// infrastructure — all keyed on certNo, vesselName, imoNo, type, status
// — works for FFE certificates without any changes.
export interface FFEData {
  subType: string; // key into FFE_CERT_TYPES, see ffeCertTypes.ts
  certClass: string; // harmonized header's "Class" field
  placeOfService: string; // harmonized header's "Place of Service" field
  technicalValues: Record<string, string>; // keyed by FFESubTypeConfig.technicalFields[].key
  items: FFEItemRow[]; // the primary incrementable item/cylinder register
  items2: FFEItemRow[]; // second table — only MO2 Set uses this (set details + cylinder specs)
  checklist: FFEChecklistResult[];
  comments: string;
}

// Calibration (type === "calibration") — built from 8 real HMZC/BTMS
// calibration certificate templates (see calibrationCertTypes.ts's own
// comment). Structurally identical to FFEData above (technical
// reference fields + two incrementable registers + comments) since the
// source templates share that same shape — kept as its own named type
// rather than reusing FFEData directly, so "this is a calibration
// certificate" stays self-documenting rather than looking like a
// mislabeled firefighting one.
export interface CalibrationData {
  subType: string; // key into CALIBRATION_CERT_TYPES, see calibrationCertTypes.ts
  certClass: string; // harmonized header's "Class" field
  placeOfService: string; // harmonized header's "Place of Service" field
  technicalValues: Record<string, string>; // keyed by CalibrationSubTypeConfig.technicalFields[].key
  items: FFEItemRow[]; // "Unit(s) Under Test" register
  items2: FFEItemRow[]; // the calibration results/readings register
  comments: string;
}

// Loose Gear & Lifting Equipment (type === "loosegear") — built from
// three of HMZC's real LOLER 1998 "Report of Thorough Examination"
// templates (Downloads/Report of Thorough Inspection*.docx), preserved
// as three separate selectable sub-types rather than merged into one
// shape — each is a genuinely different form with its own field set,
// the same reason FFE offers ~20 distinct sub-types instead of forcing
// every fire safety certificate through one layout (see ffeCertTypes.ts).
export type LooseGearYesNo = "yes" | "no" | "";

export type LooseGearSubTypeId = "visual_certificate" | "standard_report" | "multiple_items";

// The LOLER 1998 statutory yes/no questions and defect/sign-off block —
// word-for-word identical between the "Visual Certificate" and
// "Standard Report" templates (only their header fields above this
// block differ), so it's shared rather than duplicated twice.
export interface LooseGearStatutoryAnswers {
  firstExaminationAfterInstall: LooseGearYesNo;
  installedCorrectly: LooseGearYesNo; // only meaningful if firstExaminationAfterInstall is "yes"
  examinedWithin6Months: LooseGearYesNo;
  examinedWithin12Months: LooseGearYesNo;
  inAccordanceWithScheme: LooseGearYesNo;
  afterExceptionalCircumstances: LooseGearYesNo;
  defectDescription: string; // "If none state NONE"
  existingOrImminentDanger: LooseGearYesNo; // *reportable defect, per the statutory form's own note
  couldBecomeDangerBy: string; // date, if a defect isn't yet but could become dangerous
  repairParticulars: string;
  testsCarriedOut: string;
  observations: string;
  safeToOperate: LooseGearYesNo;
}

// Template 1 — "Visual Certificate of Thorough Examination", HMZC's own
// branded single-item form (Downloads/Report of Thorough Inspection.docx).
export interface LooseGearVisualCertData {
  clientOwner: string;
  site: string;
  siteLocation: string;
  chargeCodeOrderNo: string;
  poJobNo: string;
  colorCode: string;
  inspectionType: string;
  standard: string; // e.g. "BS EN 14492, EN12385 LOLER 1998 S.I.2307"
  itemSerialNo: string;
  itemDescription: string;
  swl: string;
  itemLocation: string;
  previousCertificateNo: string;
  manufacturer: string;
  previousInspectionDate: string;
  testDate: string;
  ecDeclarationAvailable: LooseGearYesNo;
  ceMarkVisible: LooseGearYesNo;
  statutory: LooseGearStatutoryAnswers;
  reportedByNameAndQualifications: string;
  authenticatedByName: string;
  nextExaminationDue: string;
  employerNameAddress: string;
}

// Template 2 — "Report of Thorough Examination", the plainer/generic
// LOLER wording variant (Downloads/Report of Thorough Inspection -Unsafe.docx),
// a different single-item header from the Visual Certificate above —
// examination/report dates, the CLIENT's employer details, and the
// premises address, rather than HMZC's own Client/Site/Job-No fields.
export interface LooseGearStandardReportData {
  dateOfExamination: string;
  dateOfReport: string;
  reportNumber: string;
  clientEmployerNameAddress: string; // "employer for whom the thorough examination was made"
  premisesAddress: string;
  equipmentDescription: string;
  swl: string;
  dateOfManufacture: string;
  dateOfLastExamination: string;
  statutory: LooseGearStatutoryAnswers;
  reportedByNameAndQualifications: string;
  authenticatedByName: string;
  nextExaminationDue: string;
  authenticatingEmployerNameAddress: string; // "employer OF the person making/authenticating this report" — the inspection company, distinct from clientEmployerNameAddress above
}

// Template 3 — "Report of Thorough Examination (Multiple Items)", the
// register variant for a batch of loose gear (shackles etc.) inspected
// on the same visit (Downloads/Report of Thorough Inspection (multiple
// items)*.docx). One abbreviated row per item, not a full statutory
// declaration each — that per-item depth is what templates 1 and 2 are
// for; this is deliberately the register's own, lighter shape.
export interface LooseGearRegisterRow {
  serialNo: string;
  description: string;
  swl: string;
  manufacturer: string;
  result: string; // e.g. "Satisfactory" / "Unsatisfactory"
  certNoTestDate: string;
  itemLocation: string;
  typeOfInspection: string;
  nextInspectionDate: string;
  safeToUse: LooseGearYesNo;
}

// The source form's own legend: Installation (A) / 6 Monthly (B) /
// 12 Monthly (C) / Written Scheme (D) / Exceptional Circumstance (E) —
// one code for the whole register, not per row, matching how it's laid
// out as a single key/legend table in the source document.
export type LooseGearReasonForInspection = "" | "installation" | "6monthly" | "12monthly" | "written_scheme" | "exceptional";

export interface LooseGearMultipleItemsData {
  jobPoNo: string;
  inspectedBy: string;
  colourCode: string;
  reasonForInspection: LooseGearReasonForInspection;
  rows: LooseGearRegisterRow[];
}

// vesselName/imoNo/certNo/dateOfServicing/location live on
// InspectionCertificate itself (same convention FFE already uses) —
// only the sub-type actually selected has its data object populated.
export interface LooseGearData {
  subType: LooseGearSubTypeId;
  visualCert?: LooseGearVisualCertData;
  standardReport?: LooseGearStandardReportData;
  multipleItems?: LooseGearMultipleItemsData;
}

export interface EquipmentTypeConfig {
  kind: "boat" | "crane" | "ffe" | "loosegear" | "calibration";
  typeName: string;
  label: string;
  statementIntro?: string;
  remarksTemplate?: (location: string) => string;
  sideOptions?: string[];
  boatTitle?: string;
  boatSections?: ChecklistSectionDef[];
  davitTitle?: string;
  davitSections?: ChecklistSectionDef[];
  equipListTitle?: string;
  equipItems?: { n: string; qty: string; unit: string; exp?: boolean }[];
  checklistTitle?: string;
  checklistSections?: ChecklistSectionDef[];
  divisionNote?: string;
  // Minimum photos required per checklist section before a certificate
  // can be finalized — keyed by the same keys used in
  // InspectionCertificate.photos ("boatChecklist", "davitChecklist",
  // "checklist"). Previously the UI only said "(required before
  // finalizing)" in text with nothing actually checking it — see
  // handleSave's enforcement in InspectionWorkspace.tsx. These specific
  // counts are a reasonable starting point, not confirmed HMZC policy —
  // adjust per section once HMZC specifies real minimums per equipment
  // type.
  minPhotos?: Record<string, number>;
}
