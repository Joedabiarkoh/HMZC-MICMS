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
  | "loosegear";

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

export interface EquipmentTypeConfig {
  kind: "boat" | "crane" | "ffe" | "placeholder";
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
