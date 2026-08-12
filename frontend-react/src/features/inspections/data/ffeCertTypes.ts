// Firefighting Equipment (FFE) certificate sub-types — built from 27
// real HMZC certificate templates (Downloads/FFE certificate/*.docx),
// then updated and extended from a second batch of 18 templates
// (Downloads/Cert. Simples/*.docx) that superseded some of the
// originals and added others HMZC hadn't supplied before. Several
// templates were near-duplicates of each other (three CO2 variants
// differing only in which space they protect; three Foam System
// variants differing only in "Distribution Lines" vs "Monitors"; two
// Life Jacket templates that were the same certificate with a different
// row count) — merged into one config each rather than kept as
// separate, functionally-identical sub-types, with a free-text field
// covering what actually varied (e.g. CO2's "Protected Space(s)").
//
// Every source template (both batches) header-tables its vessel
// identity as "Class / Flag", not "Class" alone — FFEForm.tsx and
// CertificatePreview.tsx's harmonized header were updated to match.
//
// Every sub-type here is one of four repeating shapes (archetypes) the
// source templates fell into:
//   "items"     — a register of individual serialized items (fire
//                 extinguishers, BA sets, suits...), one incrementable
//                 row per unit actually inspected.
//   "system"    — a fixed installation (CO2, foam, watermist, wet
//                 chemical): fixed technical-description fields about
//                 the ONE system, a fixed inspection checklist, and
//                 (for gas/chemical systems) an incrementable cylinder
//                 register.
//   "checklist" — a small fixed checklist only, no item register
//                 (Fire Detection, Foam Applicator).
//   "readings"  — a fixed set of measured-value rows against a
//                 reference maximum (Air Quality Test).
//
// The header itself is NOT part of this config — every FFE certificate
// uses the same harmonized 3-row header (Vessel/Certificate No, IMO
// No/Date, Class/Place of Service), handled once in FFEForm.tsx rather
// than repeated per sub-type here.

export interface FFEColumn {
  key: string;
  label: string;
}

export interface FFEChecklistItemDef {
  no: string;
  description: string;
}

export type FFEArchetype = "items" | "system" | "checklist" | "readings";

export interface FFESubTypeConfig {
  id: string;
  label: string;
  archetype: FFEArchetype;
  workCodes?: string[];
  technicalFields?: { key: string; label: string }[];
  itemColumns?: FFEColumn[];
  itemTableLabel?: string;
  items2Columns?: FFEColumn[];
  items2Label?: string;
  checklistItems?: FFEChecklistItemDef[];
  // Requested directly: "move the cylinder details below the
  // description of inspection for CO2, novec, wet chemical" — the
  // cylinder register (itemColumns/items2Columns) renders after
  // checklistItems ("Description of Inspection/Tests") instead of
  // before it when this is set. Defaults to false/unset everywhere
  // else (e.g. Foam Applicator, BA Trolley & Rescue Set) so their
  // existing item-table-before-checklist order is untouched.
  itemsAfterChecklist?: boolean;
  readingsRows?: { key: string; label: string; maxAllowed: string }[];
  validityYears: 1 | 2;
  note?: string;
  // Requested directly: "move the gas detector A & B into calibration
  // as gas detectors are part of calibration items" — a sub-type moved
  // elsewhere but kept registered here (not deleted) purely so
  // certificates already saved under it still resolve/open correctly
  // (see getFFEConfig — an unrecognized id would silently fall back to
  // Chemical Suit). Filtered out of FFEForm.tsx's sub-type dropdown so
  // it's simply not offered for a brand-new certificate.
  deprecated?: boolean;
}

const SERIAL_MAKE_MODEL_COLS: FFEColumn[] = [
  { key: "serialNo", label: "Serial No" },
  { key: "make", label: "Make" },
  { key: "typeModel", label: "Type/Model" },
  { key: "mfgDate", label: "Mfg Date" },
  { key: "size", label: "Size" },
  { key: "workDone", label: "Work Done" },
  { key: "remarks", label: "Remarks" },
];

const CYLINDER_SPEC_COLS: FFEColumn[] = [
  { key: "serialNo", label: "Serial No" },
  { key: "capacityKg", label: "Capacity (Kg)" },
  { key: "tareWt", label: "Tare Wt (Kg)" },
  { key: "totalWt", label: "Total Wt (Kg)" },
  { key: "workingPressure", label: "Working Pressure" },
  { key: "hydroTestPressure", label: "Hydro Test Pressure" },
  { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
  { key: "workDone", label: "Work Done" },
];

const FIXED_SYSTEM_CHECKLIST_25: FFEChecklistItemDef[] = [
  { no: "1", description: "Release control and distribution valves secured to prevent accidental release" },
  { no: "2", description: "Contents in main cylinder checked by weighing" },
  { no: "3", description: "Contents in main cylinder checked by liquid level indicator" },
  { no: "4", description: "Contents of pilot cylinders checked" },
  { no: "5", description: "All cylinder valves visually inspected" },
  { no: "6", description: "All cylinder clamps and connections checked for tightness" },
  { no: "7", description: "Manifold visually inspected" },
  { no: "8", description: "Manifold tested for leakage, by applying dry working air" },
  { no: "9", description: "Main valve and distribution valves visually inspected" },
  { no: "10", description: "Main valve and distribution valves tested for operation" },
  { no: "11", description: "Time delay unit inspected" },
  { no: "12", description: "Remote release system visually inspected" },
  { no: "13", description: "Remote release system tested" },
  { no: "14", description: "Servo tubing/pilot lines checked for leakages and blockages" },
  { no: "15", description: "Manual release inspected" },
  { no: "16", description: "Release stations visually inspected" },
  { no: "17", description: "Warning alarms (audible/visual) tested" },
  { no: "18", description: "Tested fan stop and fuel shut-off controls connected to the system" },
  { no: "19", description: "10% of cylinders and pilot cylinders/pressure tested every 10 years" },
  { no: "20", description: "Distribution lines and nozzles blown through, by applying dry working air" },
  { no: "21", description: "Internal inspection of control valve carried out as per MSC/Circ.1318 guidelines" },
  { no: "22", description: "All instruction and warning signs on installation inspected" },
  { no: "23", description: "All flexible hoses renewed and check valves in manifold visually inspected every 10 years" },
  { no: "24", description: "Release controls and distribution valves reconnected and system put back in service" },
  { no: "25", description: "Inspection date tags attached" },
];

export const FFE_CERT_TYPES: FFESubTypeConfig[] = [
  // ---------- Archetype: items (serialized personal/portable equipment) ----------
  {
    id: "chemical_suit",
    label: "Chemical Suit",
    archetype: "items",
    workCodes: [
      "1 = Inspected", "2 = Checked condition of Boot and Helmet",
      "3 = Checked condition of Jacket, trousers & Gloves", "4 = Rejected",
    ],
    itemColumns: SERIAL_MAKE_MODEL_COLS,
    validityYears: 1,
  },
  {
    // itemColumns updated from the "FIRE MAN OUTFITS - CERTIFICATE"
    // template (Cert. Simples batch) — replaced Type/Model + Size with
    // Location + Remarks.
    id: "fireman_outfit",
    label: "Fireman Outfit",
    archetype: "items",
    workCodes: [
      "1 = Checked condition of Jacket, trousers & Gloves", "2 = Checked condition of Boot and Helmet",
      "3 = Torch lights checked for proper operation", "4 = Checked condition of Rope and Axe",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "maker", label: "Maker" },
      { key: "manDate", label: "Man. Date" }, { key: "location", label: "Location" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
    note: "Fireman Outfit consists of: Fireman Suit, Trouser, Jacket, Gloves, Helmet, Boots, Fire Axe, Waist Belt, Safety Lamp, Lifeline.",
  },
  {
    id: "immersion_suit",
    label: "Immersion Suit",
    archetype: "items",
    workCodes: [
      "1 = Inspected all parts for serviceability", "2 = Checked sealing tapes at gloves, boots & hood",
      "3 = Checked face seal", "4 = Checked lights & its expiry date",
      "5 = Checked zip for correct function", "6 = Checked reflective tape, whistle, webbing",
      "7 = Pressure tested", "8 = New supply",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "typeModel", label: "Type/Model" }, { key: "lightExpiryDate", label: "Light Expiry Date" },
      { key: "size", label: "Size" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    id: "life_jackets",
    label: "Life Jackets",
    archetype: "items",
    workCodes: [
      "1 = Inspected all parts for serviceability", "2 = Checked sealing tapes and stitches",
      "3 = Checked lights & its expiry date", "4 = Checked reflective tape, whistle, webbing",
      "5 = Rejected", "6 = New supply",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "typeModel", label: "Type/Model" }, { key: "lightExpiryDate", label: "Light Expiry Date" },
      { key: "size", label: "Size" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    // Requested directly, from "CERT -INFLATABLE LIFE JACKET-with
    // table.docx" — same header/work-code shape as the plain Life
    // Jackets sub-type above (identical 6 work codes), but with one
    // extra column (Cyl Cpty) the source template adds between
    // Type/Model and Light Expiry Date, for the CO2 inflation cylinder
    // a solid-foam life jacket doesn't have. Kept as its own sub-type
    // rather than folding into "life_jackets" so that column stays
    // meaningful (it would be a dead/always-blank field on a standard
    // life jacket).
    id: "inflatable_life_jacket",
    label: "Inflatable Life Jacket",
    archetype: "items",
    workCodes: [
      "1 = Inspected all parts for serviceability", "2 = Checked sealing tapes and stitches",
      "3 = Checked lights & its expiry date", "4 = Checked reflective tape, whistle, webbing",
      "5 = Rejected", "6 = New supply",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "typeModel", label: "Type/Model" }, { key: "cylCapacity", label: "Cyl Cpty" },
      { key: "lightExpiryDate", label: "Light Expiry Date" }, { key: "size", label: "Size" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    id: "eebd",
    label: "EEBD Set (with Cylinder)",
    archetype: "items",
    workCodes: [
      "1 = Cylinder Pressure checked", "2 = Visual condition inspected",
      "3 = Reducer valve, Hose, Harness inspected & checked", "4 = Flow checked",
      "5 = Facemask/Hood Inspected", "6 = Serviced", "7 = Repaired", "8 = New EEBD Set",
      "R = Recharge", "HT = Hydro tested",
    ],
    itemColumns: [
      { key: "setSerialNo", label: "Set Serial No" }, { key: "cylSerialNo", label: "Cyl Serial No" },
      { key: "make", label: "Make" }, { key: "capacity", label: "Capacity" },
      { key: "workingPressure", label: "Working Pressure" }, { key: "htPressure", label: "H.T Pressure" },
      { key: "lastHydroTestDate", label: "Last Hydro Test Date" }, { key: "workDone", label: "Work Done" },
      { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    // Updated from the "SCBA CERTIFICATE" template (Cert. Simples batch)
    // — the set/mask/harness itself is now tracked here with a simpler
    // column set (no cylinder capacity/pressure fields), separate from
    // the cylinder's own hydro-test data, which now has its own
    // certificate (see ba_spare_cylinder below, updated from "BA CYL
    // CERTIFICATE" in the same batch). Was one combined 9-column table
    // covering both the set and its cylinder in one row.
    id: "ba_set",
    label: "SCBA / Breathing Apparatus Set",
    archetype: "items",
    workCodes: [
      "1 = Face mask checked/sanitized", "2 = Breathing valve checked",
      "3 = Reducer valve, Hose, Harness inspected & checked", "4 = Functional test carried out",
      "5 = Warning Device Inspected", "6 = Rejected", "7 = Repaired", "8 = New BA Set/Cylinder",
      "I = Inspected", "PR = Pressure Checked", "R = Recharge", "HT = Hydro Tested",
    ],
    itemColumns: [
      { key: "setSerialNo", label: "Set Serial No" }, { key: "make", label: "Make" },
      { key: "type", label: "Type" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    // Updated from "BA CYL CERTIFICATE" (Cert. Simples batch, titled
    // "BREATHING APPARATUS" but cylinder-specification-focused) — added
    // a Remarks column. Covers the cylinder specifically; see ba_set
    // above for the set/mask/harness itself.
    id: "ba_spare_cylinder",
    label: "Breathing Air Spare Cylinders",
    archetype: "items",
    workCodes: [
      "1 = Inspection", "2 = Cylinder Pressure Checked", "3 = Recharge", "4 = Valve Renewal",
      "5 = Valve Repair", "6 = New Cylinder", "7 = Cylinder Hydro tested", "8 = External Maintenance",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "capacity", label: "Capacity" }, { key: "workingPressure", label: "Working Pressure" },
      { key: "hydroTestPressure", label: "Hydro Test Pressure" }, { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    id: "ba_trolley_rescue_set",
    label: "B.A Trolley & Rescue Set",
    archetype: "items",
    workCodes: [
      "1 = Face mask checked/sanitized", "2 = Breathing valve checked",
      "3 = Reducer valve, Hose, Harness inspected & checked", "4 = Functional test carried out",
      "5 = Warning Device Inspected", "6 = Rejected", "7 = Repaired", "8 = New BA Set/Cylinder",
      "I = Inspected", "PR = Pressure Checked", "R = Recharge", "HT = Hydro Tested",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "cylCapacity", label: "Cyl. Capacity" }, { key: "workingPressure", label: "Working Pressure" },
      { key: "htPressure", label: "H.T Pressure" }, { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    itemTableLabel: "BA Cylinder Specifications",
    items2Columns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "type", label: "Type" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    items2Label: "Trolley & Rescue Set Details",
    validityYears: 1,
  },
  {
    id: "lifeboat_air_cylinder",
    label: "Lifeboat Air Cylinder",
    archetype: "items",
    workCodes: [
      "1 = Inspection", "2 = Cylinder Pressure Checked", "3 = Recharge", "4 = Valve Renewal",
      "5 = Valve Repair", "6 = New Cylinder", "7 = Cylinder Hydro tested", "8 = External Maintenance",
      "9 = Painted", "10 = Rejected",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "capacity", label: "Capacity" }, { key: "workingPressure", label: "Working Pressure" },
      { key: "hydroTestPressure", label: "Hydro Test Pressure" }, { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    // itemColumns (set details) updated from "MO2 CERT" (Cert. Simples
    // batch) — replaced Model/Manufacture Year with I/P and O/P
    // (inlet/outlet) Pressure; added Remarks to the cylinder table.
    id: "mo2_set",
    label: "Medical Oxygen Resuscitator (MO2 Set)",
    archetype: "items",
    workCodes: [
      "1 = Face mask checked/sanitized", "2 = Cylinder valve checked", "3 = Regulator unit inspected",
      "4 = Hose inspected", "5 = Visual Inspection", "6 = Rejected", "7 = Repaired", "8 = New MO2 Set/Cylinder",
      "I = Inspected", "PR = Pressure Checked", "R = Recharge", "HT = Hydro Tested",
    ],
    itemColumns: [
      { key: "setNo", label: "Set No" }, { key: "make", label: "Make" },
      { key: "ipPressure", label: "I/P Pressure" }, { key: "opPressure", label: "O/P Pressure" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    itemTableLabel: "Regulator Details",
    items2Columns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "capacity", label: "Capacity" }, { key: "workingPressure", label: "Working Pressure" },
      { key: "htPressure", label: "H.T Pressure" }, { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    items2Label: "Set Cylinder Specifications",
    validityYears: 1,
  },
  {
    // Requested directly: split the previous single "Fire Extinguisher"
    // sub-type (which recorded portable and non-portable units in the
    // same table, distinguished only by a note in Work Done) into two
    // real, separate sub-types — and reformat the item columns to
    // exactly Sl No / Serial No / Make / Type / Capacity / Last Hydro
    // Test Date / Work Done. "Sl No" is the ItemTable's own auto-
    // numbered "#" column (see FFEForm.tsx/CertificatePreview.tsx's
    // FFEItemsTable), not a separate data field. Cartridge Exp./Weight
    // (present in the old combined sub-type) is still dropped, but
    // Remarks was added back on later request.
    id: "portable_fire_extinguisher",
    label: "Portable Fire Extinguisher",
    archetype: "items",
    workCodes: [
      "1 = Inspection", "2 = Service", "3 = Content Checked", "4 = Recharge", "5 = Painted",
      "6 = New Extinguisher", "7 = Hydro Test", "8 = Condemned",
      "F = Foam", "W = Water", "CO2 = Carbon Dioxide", "WC = Wet Chemical", "DCP = Dry Chemical Powder",
      "PK = Purple K", "A+B = Chemical Foam A+B", "AFFF = Aqueous Film Forming Foam", "FP = Flouro Protein",
      "Cart = Cartridge Type", "PRE = Pressure Type", "WT = Weighing", "HT = Hydro Test", "CR = Content Change",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" }, { key: "type", label: "Type" },
      { key: "capacity", label: "Capacity" }, { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    // Renamed from "Non-Portable Fire Extinguisher" on later request —
    // id kept as non_portable_fire_extinguisher so existing saved
    // certificates (which store ffe.subType by id, not label) still
    // resolve correctly; only the displayed label changed.
    id: "non_portable_fire_extinguisher",
    label: "Wheeled Fire Extinguisher",
    archetype: "items",
    workCodes: [
      "1 = Inspection", "2 = Service", "3 = Content Checked", "4 = Recharge", "5 = Painted",
      "6 = New Extinguisher", "7 = Hydro Test", "8 = Condemned",
      "F = Foam", "W = Water", "CO2 = Carbon Dioxide", "WC = Wet Chemical", "DCP = Dry Chemical Powder",
      "PK = Purple K", "A+B = Chemical Foam A+B", "AFFF = Aqueous Film Forming Foam", "FP = Flouro Protein",
      "Cart = Cartridge Type", "PRE = Pressure Type", "WT = Weighing", "HT = Hydro Test", "CR = Content Change",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" }, { key: "type", label: "Type" },
      { key: "capacity", label: "Capacity" }, { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    id: "foam_applicator",
    label: "Foam Applicator",
    archetype: "items",
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "location", label: "Location" }, { key: "make", label: "Make" },
      { key: "type", label: "Type" }, { key: "foamCan", label: "Foam Can" }, { key: "expDate", label: "Exp Date" },
      { key: "remarks", label: "Remarks" },
    ],
    checklistItems: [
      { no: "1", description: "Box" },
      { no: "2", description: "Hose, Pipe, Tube" },
      { no: "3", description: "Connector, Coupling, Filter" },
      { no: "4", description: "Discharging nozzles, Air inlet" },
      { no: "5", description: "Foam Tanks" },
    ],
    validityYears: 1,
  },
  {
    id: "hydrostatic_ba",
    label: "Hydrostatic Test — BA Air Cylinders",
    archetype: "items",
    itemColumns: [
      { key: "make", label: "Make" }, { key: "type", label: "Type" }, { key: "capacity", label: "Capacity" },
      { key: "testPressure", label: "Test Pressure" }, { key: "qty", label: "Qty" }, { key: "testResult", label: "Test Result" },
    ],
    validityYears: 1,
    note: "Standard finding: cylinders hydro tested and found in good condition, unless a row's Test Result says otherwise.",
  },
  {
    id: "hydrostatic_fe",
    label: "Hydrostatic Test — Fire Extinguishers",
    archetype: "items",
    itemColumns: [
      { key: "make", label: "Make" }, { key: "type", label: "Type" }, { key: "capacity", label: "Capacity" },
      { key: "testPressure", label: "Test Pressure" }, { key: "qty", label: "Qty" }, { key: "testResult", label: "Test Result" },
    ],
    validityYears: 1,
    note: "Standard finding: cylinders hydro tested and found in good condition, unless a row's Test Result says otherwise.",
  },

  // ---------- New sub-types added from the Cert. Simples batch (18
  // templates) — none of these had an equivalent in the original 27. ----------
  {
    id: "fire_blanket",
    label: "Fire Blanket",
    archetype: "items",
    workCodes: [
      "1 = Inspected all parts for serviceability", "2 = Check fire blanket containers are not damaged",
      "3 = Check if fire blanket is unobstructed and visible", "4 = Rejected", "5 = New Supply",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" },
      { key: "strapCondition", label: "Strap & All Condition" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    id: "foam_can",
    label: "Foam Can",
    archetype: "items",
    workCodes: [
      "I = Inspection", "PK = Purple K", "F = Foam", "W = Water", "WC = Wet Chemical", "FP = Flouro Protein",
      "A+B = Chemical Foam A+B", "AFFF = Aqueous Film Forming", "NS = New Supply",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" }, { key: "manDate", label: "Man. Date" },
      { key: "type", label: "Type" }, { key: "concentration", label: "Concentration" }, { key: "capacity", label: "Capacity" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
    note: "The foam concentrate is free from PFOA and PFOS, as per the manufacturer's declaration. A copy of the declaration is attached to the certificate for reference.",
  },
  {
    id: "line_thrower",
    label: "Line Thrower",
    archetype: "items",
    workCodes: ["I = Inspected"],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "maker", label: "Maker" }, { key: "manDate", label: "Man. Date" },
      { key: "expireDate", label: "Expire Date" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    id: "bumerang_plt",
    label: "Bumerang PLT R-230 (Line Throwing Rocket)",
    archetype: "items",
    workCodes: ["I = Inspected all parts for serviceability"],
    itemColumns: [
      { key: "maker", label: "Maker" }, { key: "shootingDeviceSerialNo", label: "Shooting Device Serial No" },
      { key: "cylinderSerialNo", label: "Cylinder Serial No" }, { key: "cylinderCapacity", label: "Cylinder Capacity" },
      { key: "workingPressure", label: "Working Pressure" }, { key: "htPressure", label: "H.T Pressure" },
      { key: "lastHT", label: "Last H.T" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    id: "spare_cartridge",
    label: "Spare Cartridge for Fire Extinguisher",
    archetype: "items",
    workCodes: [
      "1 = Inspection", "2 = Service", "3 = Content Checked", "4 = Condemned", "5 = Recharge", "6 = Hydro Test",
      "CO2 = Carbon Dioxide", "WT = Weighing", "AFFF = Aqueous Film Forming",
    ],
    itemColumns: [
      { key: "serialNo", label: "S\\N" }, { key: "make", label: "Make" }, { key: "cartCap", label: "Cart. Cap" },
      { key: "manDate", label: "Man. Date" }, { key: "cartWeight", label: "Cart. Weight (Kg)" },
      { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    validityYears: 1,
  },
  {
    // Requested directly: "move the gas detector A & B into
    // calibration as gas detectors are part of calibration items" —
    // moved to calibrationCertTypes.ts (id gas_detector_type_a there;
    // a Type B was also added there briefly and then removed again
    // before any certificate ever used it — Type A is the only
    // instrument this company actually calibrates). Kept here,
    // deprecated, purely so any certificate already saved with
    // ffe.subType "gas_detector" still resolves/opens correctly — see
    // FFESubTypeConfig.deprecated.
    id: "gas_detector",
    label: "Gas Detector — Maintenance & Calibration (Type A) — moved to Calibration",
    archetype: "items",
    deprecated: true,
    itemColumns: [
      { key: "gasType", label: "Gas Type" }, { key: "spanReading", label: "Span Reading" },
      { key: "alarmHigh", label: "Alarm Set Point (High)" }, { key: "alarmLow", label: "Alarm Set Point (Low)" },
      { key: "twa", label: "TWA" }, { key: "stel", label: "STEL" }, { key: "cylNo", label: "Cyl #" },
      { key: "calibrationTest", label: "Calibration Test" },
    ],
    validityYears: 1,
    note: "Add one row per gas type actually fitted — the standard set is Combustible (%LEL), Oxygen (%VOL), Toxic Gas CO (PPM), and Toxic Gas H2S (PPM). Calibration is crucial for detector accuracy/reliability; follow the manufacturer's requirements to prevent premature failures.",
  },
  {
    // Requested directly: "use the ladder certificate made and search
    // for other best pilot ladder and accommodation ladder inspection/
    // check list and create an inspection and checklist for both."
    // itemColumns match the existing combined "LADDER" certificate's
    // own register shape (Downloads/try folder/LADDER- CERTICATE.pdf —
    // No/S-N/Manufacture/Year of Man./Type/Length-Steps/Location/
    // Remarks), since a vessel can carry more than one pilot ladder.
    // checklistItems researched against SOLAS Ch V Reg 23 and IMO
    // Resolution A.1045(27) "Pilot Transfer Arrangements" (steps
    // 310-350mm apart, side ropes free of knots/splices except above
    // the top step, max 2 replacement steps secured by an approved
    // method, manropes 28-32mm, retrieval line at/above the last
    // spreader) — a superset of the reference certificate's own
    // 9-item list, not a replacement of it.
    id: "pilot_ladder",
    label: "Pilot Ladder",
    archetype: "items",
    itemColumns: [
      { key: "serialNo", label: "S/N" }, { key: "manufacturer", label: "Manufacturer" },
      { key: "yearOfMan", label: "Year of Man." }, { key: "lengthSteps", label: "Length/Steps" },
      { key: "location", label: "Location" }, { key: "remarks", label: "Remarks" },
    ],
    checklistItems: [
      { no: "1", description: "Side ropes clean, in serviceable condition — no cuts, wear, rot, or damage" },
      { no: "2", description: "Side ropes free of knots, splices, or joins, except above the top step" },
      { no: "3", description: "Steps not cracked, broken, bent, or warped" },
      { no: "4", description: "Steps clean, anti-slip surface intact — free of paint, grease, or contamination" },
      { no: "5", description: "Steps horizontal and evenly spaced 310-350mm apart" },
      { no: "6", description: "Spreaders fitted at correct intervals; steps and spreaders lie horizontal when rigged" },
      { no: "7", description: "Step fixtures/seizings secure and tight" },
      { no: "8", description: "No more than 2 replacement steps, each secured by an approved method" },
      { no: "9", description: "Manropes (28-32mm) available, free of knots, joins, and splices" },
      { no: "10", description: "Retrieval line fastened at or above the last spreader step, leading forward" },
      { no: "11", description: "Ladder length adequate for the freeboard/height of transfer" },
      { no: "12", description: "Marking, identification, and date of manufacture visible" },
      { no: "13", description: "Proper storage condition" },
      { no: "14", description: "Ancillary equipment (lifebuoy with self-igniting light, heaving line, handhold stanchions) present and in good condition" },
    ],
    validityYears: 1,
    note: "Reference: SOLAS Chapter V, Regulation 23 and IMO Resolution A.1045(27) (Pilot Transfer Arrangements). A pilot ladder found not to comply must not be used until the defect is rectified.",
  },
  {
    // checklistItems researched against SOLAS/MSC.1/Circ.1331 (Means of
    // Access) guidance on accommodation ladder and gangway surveys —
    // annual survey scope (steps/platforms, support and suspension
    // points, stanchions, safety pins, handrails, turntables, side
    // nets) plus the aluminium-on-steel-fitting corrosion check
    // industry inspection checklists specifically flag.
    id: "accommodation_ladder",
    label: "Accommodation Ladder",
    archetype: "items",
    itemColumns: [
      { key: "serialNo", label: "S/N" }, { key: "manufacturer", label: "Manufacturer" },
      { key: "yearOfMan", label: "Year of Man." }, { key: "lengthSteps", label: "Length/Steps" },
      { key: "location", label: "Location" }, { key: "remarks", label: "Remarks" },
    ],
    checklistItems: [
      { no: "1", description: "Steps/treads — no distortion, cracks, or corrosion" },
      { no: "2", description: "Platform — no distortion, cracks, or corrosion" },
      { no: "3", description: "Side stringers/structure — no distortion, cracks, or corrosion" },
      { no: "4", description: "Underside of ladder inspected for distortion, cracks, or corrosion" },
      { no: "5", description: "Support points (pivots, rollers) free to turn and properly greased" },
      { no: "6", description: "Suspension points (lugs, brackets) — no cracks, corrosion, or deformation" },
      { no: "7", description: "Stanchions upright, not bent, securely fitted; safety pins present and functional" },
      { no: "8", description: "Rigid handrails secure, no damage" },
      { no: "9", description: "Hand ropes inspected along their full length — no fraying or damage" },
      { no: "10", description: "Turntable operates freely and is properly greased" },
      { no: "11", description: "Side nets fitted, no holes or damage, correctly secured" },
      { no: "12", description: "Securing points and winch/winch bed structure — no distortion, cracks, or corrosion" },
      { no: "13", description: "Aluminium-to-mild-steel fittings checked for galvanic corrosion, where applicable" },
      { no: "14", description: "Operational test — deploys and retrieves smoothly under normal use" },
    ],
    validityYears: 1,
    note: "Reference: SOLAS requirements and IMO MSC.1/Circ.1331 (Means of Access) guidance on accommodation ladder/gangway surveys.",
  },
  {
    // Requested directly: "create an inspection and certificate
    // checklist for Gangway... check through the net and ensure you use
    // the right industrial standards." Kept as its own sub-type rather
    // than folded into accommodation_ladder above — MSC.1/Circ.1331
    // itself treats them as two distinct classes of equipment with
    // different angle limits (gangway ≤30° from horizontal vs an
    // accommodation ladder's ≤55°, unless specially rated and marked),
    // since a gangway is typically the shore-set access ramp/brow used
    // for general crew, visitor, stevedore, and surveyor transfer, not
    // just the ship's own pivoting boarding ladder. checklistItems
    // researched against: SOLAS Regulation II-1/3-9 (Means of
    // Embarkation and Disembarkation, in force since 1 Jan 2010); IMO
    // MSC.1/Circ.1331 (Rev.1), Guidelines for Construction,
    // Installation, Maintenance and Inspection/Survey of Means of
    // Embarkation and Disembarkation (structural checks, angle/waterline
    // limits); SOLAS Regulation III/20.7.2 and III/36 (monthly
    // inspection/maintenance and onboard checklist requirement); SOLAS
    // Regulation III/20.4 and MSC.1/Circ.1206/Rev.1 (fall wire
    // inspection and 5-year renewal); and ISO 5488:2015, Ships and
    // marine technology — Accommodation ladders (handrail height,
    // structural design). Structural items 1-10 mirror the mechanical
    // checks every one of these sources requires of ANY means of
    // embarkation/disembarkation; items 11-17 are the gangway-specific
    // safe-use-while-rigged requirements (safety net, lifebuoy,
    // lighting, non-slip surface, angle, waterline clearance, watch)
    // drawn from SOLAS/ISO and P&I Club loss-prevention guidance (e.g.
    // Steamship Mutual RA13, Britannia P&I) for a gangway actually in
    // service at the ship/shore interface — complementing rather than
    // repeating accommodation_ladder's own structural-survey checklist
    // above.
    id: "gangway",
    label: "Gangway",
    archetype: "items",
    itemColumns: [
      { key: "serialNo", label: "S/N" }, { key: "manufacturer", label: "Manufacturer" },
      { key: "yearOfMan", label: "Year of Man." }, { key: "lengthSteps", label: "Length/Steps" },
      { key: "location", label: "Location" }, { key: "remarks", label: "Remarks" },
    ],
    checklistItems: [
      { no: "1", description: "Platform, treads, and structure — no distortion, cracks, or corrosion" },
      { no: "2", description: "Underside of gangway inspected for distortion, cracks, or corrosion" },
      { no: "3", description: "Supporting points and winch bed — no distortion, cracks, or corrosion" },
      { no: "4", description: "Stanchions upright, not bent, securely fitted" },
      { no: "5", description: "Rigid handrails fitted, minimum 1000mm height, firm and complete" },
      { no: "6", description: "Side/guard ropes inspected along their full length — no fraying or damage; kept taut if rope-type" },
      { no: "7", description: "Moving parts (turntable, sheaves, tracks, bearings, rollers) free to turn and properly greased" },
      { no: "8", description: "Winch brake in good condition; brake pads serviceable (where power-operated)" },
      { no: "9", description: "Power supply, control system, and limit switches operate satisfactorily (where power-operated)" },
      { no: "10", description: "Fall wires free of corrosion, kinks, or damage; properly greased; within 5-year renewal (SOLAS III/20.4 / MSC.1/Circ.1206)" },
      { no: "11", description: "Safety net rigged in way of the gangway, free of holes, damage, UV degradation, or contamination" },
      { no: "12", description: "Lifebuoy with self-igniting light and heaving line/quoit positioned at the gangway head" },
      { no: "13", description: "Gangway, embarkation area, and quayside adequately lit for safe transit" },
      { no: "14", description: "Steps and platform free of oil, grease, and obstructions (non-slip condition)" },
      { no: "15", description: "Angle of inclination not more than 30° from horizontal, unless specially designed, constructed, and marked for a steeper angle" },
      { no: "16", description: "Lowest platform less than 600mm above the waterline at lightest seagoing draft" },
      { no: "17", description: "Gangway watch/watchman arrangements in place while rigged for use" },
    ],
    validityYears: 1,
    note: "Reference: SOLAS Regulation II-1/3-9 (Means of Embarkation and Disembarkation); IMO MSC.1/Circ.1331 (Rev.1); SOLAS Regulations III/20.7.2, III/36, and III/20.4 with MSC.1/Circ.1206/Rev.1 (fall wires); and ISO 5488:2015 (Accommodation Ladders). A gangway found not to comply must not be used until the defect is rectified.",
  },
  {
    // Requested directly: "add pilot ladder and gangway load test to the
    // same certificate" — a pilot ladder is routinely rigged together
    // with the gangway/accommodation ladder as one combination transfer
    // arrangement (SOLAS/ISO 5488 both describe an accommodation ladder
    // "used in combination with pilot ladder"), and a 5-yearly gangway
    // survey (SOLAS I/7 & I/8) requires the gangway itself to be
    // operationally load tested — so this covers both in one visit/one
    // certificate rather than as two separate ones. Reuses
    // pilot_ladder's own register/checklist above (items 1-14, verbatim)
    // and adds a proper Gangway Static Load Test: technicalFields for
    // the test's own parameters, a second item register (items2) shaped
    // exactly like the real test data sheet used to run this exact test
    // (NOAA Test Procedure SWBS-623, "Gangway Static Load Test" — one
    // row per ballast-weight location, deflection measured before/after
    // loading), and checklist items 15-21 that encode ISO 7061:2015's
    // own pass/fail method: Type A (solid-deck) gangways loaded to
    // 4000 N/m² evenly distributed, Type B (stepped) gangways loaded to
    // 735 N per step, held 15 minutes, and the test passes only if
    // calculated deflection (measured deflection minus initial sag)
    // does not exceed the gangway's own length (mm) divided by 75.
    id: "pilot_ladder_gangway_load_test",
    label: "Pilot Ladder & Gangway Load Test",
    archetype: "items",
    technicalFields: [
      { key: "gangwayType", label: "Gangway Type (ISO 7061 — Type A solid deck / Type B stepped)" },
      { key: "gangwayLength", label: "Gangway Length Between Connection Points (mm)" },
      { key: "maxAllowableDeflection", label: "Maximum Allowable Deflection (Length ÷ 75, mm)" },
      { key: "testLoadApplied", label: "Test Load Applied (4000 N/m² Type A, or 735 N per step Type B)" },
      { key: "loadHeldDuration", label: "Load Held For" },
      { key: "witnessedBy", label: "Witnessed By (Class/Surveyor)" },
    ],
    itemColumns: [
      { key: "serialNo", label: "S/N" }, { key: "manufacturer", label: "Manufacturer" },
      { key: "yearOfMan", label: "Year of Man." }, { key: "lengthSteps", label: "Length/Steps" },
      { key: "location", label: "Location" }, { key: "remarks", label: "Remarks" },
    ],
    itemTableLabel: "Pilot Ladder Details",
    items2Columns: [
      { key: "location", label: "Location of Ballast Weight" },
      { key: "initialSag1", label: "Initial Sag — Stringer 1 (mm)" },
      { key: "initialSag2", label: "Initial Sag — Stringer 2 (mm)" },
      { key: "avgInitialSag", label: "Average Initial Sag (mm)" },
      { key: "measuredDeflection1", label: "Measured Deflection — Stringer 1 (mm)" },
      { key: "measuredDeflection2", label: "Measured Deflection — Stringer 2 (mm)" },
      { key: "avgMeasuredDeflection", label: "Average Measured Deflection (mm)" },
      { key: "calculatedDeflection", label: "Calculated Deflection (mm)" },
      { key: "result", label: "Pass/Fail" },
    ],
    items2Label: "Gangway Static Load Test — Test Data (ISO 7061)",
    checklistItems: [
      { no: "1", description: "Side ropes clean, in serviceable condition — no cuts, wear, rot, or damage" },
      { no: "2", description: "Side ropes free of knots, splices, or joins, except above the top step" },
      { no: "3", description: "Steps not cracked, broken, bent, or warped" },
      { no: "4", description: "Steps clean, anti-slip surface intact — free of paint, grease, or contamination" },
      { no: "5", description: "Steps horizontal and evenly spaced 310-350mm apart" },
      { no: "6", description: "Spreaders fitted at correct intervals; steps and spreaders lie horizontal when rigged" },
      { no: "7", description: "Step fixtures/seizings secure and tight" },
      { no: "8", description: "No more than 2 replacement steps, each secured by an approved method" },
      { no: "9", description: "Manropes (28-32mm) available, free of knots, joins, and splices" },
      { no: "10", description: "Retrieval line fastened at or above the last spreader step, leading forward" },
      { no: "11", description: "Pilot ladder length adequate for the freeboard/height of transfer" },
      { no: "12", description: "Marking, identification, and date of manufacture visible" },
      { no: "13", description: "Proper storage condition" },
      { no: "14", description: "Ancillary equipment (lifebuoy with self-igniting light, heaving line, handhold stanchions) present and in good condition" },
      { no: "15", description: "Gangway installed/supported per manufacturer's assembly drawings; test area clear of obstructions before testing" },
      { no: "16", description: "Static load applied per ISO 7061:2015 — Type A loaded to 4000 N/m² evenly distributed, or Type B loaded to 735 N per step" },
      { no: "17", description: "Test load held for 15 minutes at each interval before deflection recorded" },
      { no: "18", description: "Calculated deflection (measured deflection minus initial sag) does not exceed gangway length (mm) ÷ 75" },
      { no: "19", description: "Gangway inspected after test — no damage or permanent deformation found; any defect corrected and gangway retested" },
      { no: "20", description: "Safety net, lifebuoy with self-igniting light, adequate lighting, and gangway watch in place for the combined rig" },
      { no: "21", description: "Load test witnessed and gangway formally accepted by class/surveyor" },
    ],
    validityYears: 1,
    note: "Reference — pilot ladder: SOLAS Chapter V, Regulation 23 and IMO Resolution A.1045(27) (Pilot Transfer Arrangements). Reference — gangway load test: ISO 7061:2015 (Ships and Marine Technology — Aluminium Shore Gangways for Seagoing Vessels), ISO 5488:2015 (Accommodation Ladders), IMO MSC.1/Circ.1331 (Rev.1), and SOLAS Regulations I/7 & I/8 (5-yearly operational load test at appliance survey). A pilot ladder or gangway found not to comply must not be used until the defect is rectified.",
  },

  // ---------- Archetype: system (fixed installations) ----------
  {
    // itemColumns given its own array (not the shared CYLINDER_SPEC_COLS
    // other system types below still use) — the "FIXED CO2 CERTIFICATE
    // (EMERG. GENERATOR)" template (Cert. Simples batch) added Make, Gas
    // Type and Remarks, and its source doc actually carries FOUR
    // separate cylinder registers (Main, Pilot-Local, Pilot-Remote, Time
    // Delay). Requested directly: Pilot gets its own real table (items2)
    // as a subhead directly under Main Cylinder Specifications, rather
    // than only being noted in Remarks — Pilot-Remote and Time Delay
    // cylinders are rare enough to stay covered by the Remarks column on
    // whichever table (Main or Pilot) they're closer to, instead of
    // adding two more distinct table shapes for them.
    id: "co2_system",
    label: "Fixed CO2 System",
    archetype: "system",
    workCodes: [
      "R = Refilled", "I = Inspected", "HT = Hydro Tested", "S = Serviced", "P = Painted",
      "N = New", "C = Condemned", "W = Weighed", "LL = Liquid Level", "PC = Pressure Checked",
    ],
    technicalFields: [
      { key: "manufacturer", label: "Manufacturer" }, { key: "mfgDate", label: "Manufacturing Date" },
      { key: "mainCylinders", label: "Number of main cylinders" }, { key: "mainCylinderCapacity", label: "Main cylinders capacity (each)" },
      { key: "pilotCylinders", label: "Number of pilot cylinders" }, { key: "pilotCylinderCapacity", label: "Pilot cylinders capacity (each)" },
      { key: "distributionLines", label: "Number of distribution lines" }, { key: "lastPressureTestDate", label: "Latest cylinder pressure test date" },
      { key: "protectedSpaces", label: "Protected space(s)" }, { key: "hosesFittedDate", label: "Date flexible hoses fitted/renewed" },
      { key: "roomTemperature", label: "CO2 room temperature" },
    ],
    checklistItems: FIXED_SYSTEM_CHECKLIST_25,
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" }, { key: "gasType", label: "Gas Type" },
      { key: "capacityKg", label: "Capacity (Kg)" }, { key: "tareWt", label: "Tare Wt (Kg)" }, { key: "totalWt", label: "Total Wt (Kg)" },
      { key: "workingPressure", label: "Working Pressure" }, { key: "hydroTestPressure", label: "Hydro Test Pressure" },
      { key: "lastHydroTestDate", label: "Last Hydro Test Date" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks (also note Pilot-Remote/Time Delay here)" },
    ],
    itemTableLabel: "Cylinder Specifications — Main",
    // Pilot cylinders get their own register, same shape as Main,
    // rendered immediately below it (see FFEForm.tsx/CertificatePreview.tsx
    // — items2 always follows items directly) so it reads as a subhead
    // under Main Cylinder Specifications rather than a separate section.
    items2Columns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" }, { key: "gasType", label: "Gas Type" },
      { key: "capacityKg", label: "Capacity (Kg)" }, { key: "tareWt", label: "Tare Wt (Kg)" }, { key: "totalWt", label: "Total Wt (Kg)" },
      { key: "workingPressure", label: "Working Pressure" }, { key: "hydroTestPressure", label: "Hydro Test Pressure" },
      { key: "lastHydroTestDate", label: "Last Hydro Test Date" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks (also note Pilot-Remote/Time Delay here)" },
    ],
    items2Label: "Cylinder Specifications — Pilot",
    itemsAfterChecklist: true,
    validityYears: 1,
  },
  {
    id: "foam_system",
    label: "Foam Fire Extinguishing System (Low/High Expansion)",
    archetype: "system",
    technicalFields: [
      { key: "manufacturer", label: "Manufacturer" }, { key: "tanks", label: "No. of tanks" },
      { key: "tankCapacity", label: "Tank capacity" }, { key: "foamType", label: "Foam type" },
      { key: "distributionLinesOrMonitors", label: "No. of distribution lines / monitors" },
      { key: "protectedArea", label: "Protected area" },
    ],
    checklistItems: [
      { no: "1", description: "Foam tank inspected" },
      { no: "2", description: "Foam concentrate quantity checked" },
      { no: "3", description: "Foam sample collected for analysis (fire test applicable only for alcohol-resistant foam)" },
      { no: "4", description: "All connections checked for tightness" },
      { no: "5", description: "Main fire water pump and emergency pump inspected/tested" },
      { no: "6", description: "Sea water control valve inspected/tested" },
      { no: "7", description: "Foam suction valve inspected/tested" },
      { no: "8", description: "All distribution valves inspected/tested" },
      { no: "9", description: "Foam monitors/lines & nozzles inspected/tested" },
      { no: "10", description: "Foam liquid pump inspected/tested" },
      { no: "11", description: "All pressure gauges inspected" },
      { no: "12", description: "Foam mixing ratio test carried out as per MSC.1/Circ.1432" },
      { no: "13", description: "All control panel/remote control panel/local activation panel inspected/tested" },
      { no: "14", description: "All installation operating instructions and details checked" },
      { no: "15", description: "Installation re-connected, sealed, service label applied, left in operational condition" },
    ],
    validityYears: 1,
  },
  {
    id: "watermist_system",
    label: "Watermist System",
    archetype: "system",
    technicalFields: [
      { key: "manufacturer", label: "Manufacturer" }, { key: "tanks", label: "No. of tanks" },
      { key: "tankCapacity", label: "Tank capacity" }, { key: "distributionLines", label: "No. of distribution lines" },
      { key: "protectedArea", label: "Protected area" },
    ],
    checklistItems: [
      { no: "1", description: "Visually inspected all accessible components for proper condition" },
      { no: "2", description: "Activation of the system checked from the local manual activation switch in the protected area" },
      { no: "3", description: "Activation of the system checked from ECR" },
      { no: "4", description: "All control valves in the system and pressure gauges functionally tested" },
      { no: "5", description: "All distribution lines and nozzles blown through dry air" },
      { no: "6", description: "All sprinkler nozzles inspected for physical damage" },
      { no: "7", description: "Solenoid activation inspected/tested" },
      { no: "8", description: "Water mist pump for the system functionally tested for proper pressure and capacity" },
      { no: "9", description: "Checked all panel indications and display" },
      { no: "10", description: "One selection valve and nozzle tested by flowing water through nozzle" },
      { no: "11", description: "Visually inspected the panel for the normal working mode" },
      { no: "12", description: "Solenoid valve activation tested by operating the detectors in protected areas" },
      { no: "13", description: "Audible & visual alarms checked" },
      { no: "14", description: "All instructions and warning signs on installation checked" },
      { no: "15", description: "Applied service label and left in operational condition" },
    ],
    validityYears: 1,
  },
  {
    id: "wet_chemical_system",
    label: "Galley Wet Chemical System",
    archetype: "system",
    technicalFields: [
      { key: "manufacturer", label: "Manufacturer" }, { key: "mfgDate", label: "Manufacturing Date" },
      { key: "typeOfRelease", label: "Type of release" }, { key: "mainCylinders", label: "Number of main cylinders" },
      { key: "mainCylinderCapacity", label: "Main cylinders capacity (each)" }, { key: "cartridges", label: "Number of cartridges/pilot cylinders" },
      { key: "distributionLines", label: "Number of distribution lines" }, { key: "lastPressureTestDate", label: "Latest cylinder pressure test date" },
      { key: "protectedSpaces", label: "Protected space(s)" }, { key: "hosesFittedDate", label: "Date flexible hoses fitted/renewed" },
    ],
    checklistItems: [
      { no: "1", description: "Release control and distribution valves secured to prevent accidental release" },
      { no: "2", description: "Contents in main cylinder checked by weighing" },
      { no: "3", description: "Contents in main cylinder checked by liquid level indicator" },
      { no: "4", description: "Contents of pilot cylinders checked" },
      { no: "5", description: "All cylinder valves visually inspected" },
      { no: "6", description: "All cylinder clamps and connections checked for tightness" },
      { no: "7", description: "Manual release inspected & pull cables and all related fittings inspected" },
      { no: "8", description: "Warning alarms (audible/visual) tested" },
      { no: "9", description: "Tested fan stop and fuel shut-off controls connected to the system" },
      { no: "10", description: "Distribution lines and nozzles visually inspected" },
      { no: "11", description: "System reconnected, sealed and service label attached" },
    ],
    itemColumns: CYLINDER_SPEC_COLS,
    itemTableLabel: "Cylinder Specifications",
    itemsAfterChecklist: true,
    validityYears: 1,
  },
  {
    id: "novec_system",
    label: "Novec Clean Agent System",
    archetype: "system",
    technicalFields: [
      { key: "manufacturer", label: "Manufacturer" }, { key: "mfgDate", label: "Manufacturing Date" },
      { key: "mainCylinders", label: "Number of main cylinders" }, { key: "mainCylinderCapacity", label: "Main cylinders capacity (each)" },
      { key: "distributionLines", label: "Number of distribution lines" }, { key: "lastPressureTestDate", label: "Latest cylinder pressure test date" },
      { key: "protectedSpaces", label: "Protected space(s)" }, { key: "hosesFittedDate", label: "Date flexible hoses fitted/renewed" },
    ],
    checklistItems: FIXED_SYSTEM_CHECKLIST_25,
    itemColumns: CYLINDER_SPEC_COLS,
    itemTableLabel: "Cylinder Specifications",
    itemsAfterChecklist: true,
    validityYears: 1,
    note: "Adapted from this project's standard clean-agent/fixed-gas-system pattern (matches the CO2 System checklist above) — the source template (CERT Novec System Certificate.doc) couldn't be read in this environment (legacy .doc, no Word/LibreOffice available to convert it). Worth checking this against the actual Novec template once it can be opened, in case its checklist genuinely differs from CO2's.",
  },

  // ---------- Archetype: checklist (small, no item register) ----------
  {
    // Updated from "FIRE DETECTION CERTIFICATE" (Cert. Simples batch) —
    // technicalFields expanded (No. of Panels, Remote Display Units,
    // detectors, call points, Area Protected added), and two more
    // checklist items (trickle charger / battery voltage — logged as
    // Comment values on the same Carried Out/Not/N/A row shape as every
    // other item, matching the source template).
    id: "fire_detection_system",
    label: "Fire Detection System",
    archetype: "checklist",
    technicalFields: [
      { key: "make", label: "Make" }, { key: "model", label: "Model" }, { key: "serialNo", label: "Serial No." },
      { key: "zones", label: "No. of Zones" }, { key: "panels", label: "No. of Panels" },
      { key: "remoteDisplayUnits", label: "No. of Remote Display Unit" }, { key: "detectors", label: "No of detectors" },
      { key: "callPoints", label: "No of Call Points" }, { key: "areaProtected", label: "Area Protected" },
    ],
    checklistItems: [
      { no: "1", description: "Inspect the panel and system coverage" },
      { no: "2", description: "Inspect the system to ensure the type of system control panel & functions of the system controller" },
      { no: "3", description: "Verify the fire detection and fire alarm control panel indicators are functional by operating the lamp/indicator test switch" },
      { no: "4", description: "Check all detectors and call points by applying smoke and heat" },
      { no: "5", description: "Tested sounders, alarms" },
      { no: "6", description: "All instruction and warning signs on installation inspected" },
      { no: "7", description: "Inspection date tags attached" },
      { no: "8", description: "Trickle Charger Voltage (record the reading in Comment)" },
      { no: "9", description: "Battery Voltage — when system on battery (record the reading in Comment)" },
    ],
    validityYears: 1,
  },

  // ---------- Archetype: readings ----------
  {
    id: "air_quality_test",
    label: "Air Quality Test (Breathing Air Analysis)",
    archetype: "readings",
    technicalFields: [
      { key: "make", label: "Make" }, { key: "mfgDate", label: "Manufacturing Date" },
      { key: "modelType", label: "Model/Type" }, { key: "serialNo", label: "Serial No" },
      { key: "maxWorkingPressure", label: "Max. Working Pressure" },
    ],
    // Requested directly: show each parameter's limit as a comparison
    // (≤ / = / ≥) rather than a bare number — every one of these 4 is a
    // maximum-allowed-content limit under EN 12021/DIN-3188 (there's no
    // minimum-content parameter among them, e.g. no Oxygen row, which
    // would instead need a target range), so all four are "≤".
    readingsRows: [
      { key: "water_vapour", label: "Water Vapour", maxAllowed: "≤ 35 mg/m³" },
      { key: "oil_vapor", label: "Oil Vapor", maxAllowed: "≤ 0.5 mg/m³" },
      { key: "carbon_dioxide", label: "Carbon Dioxide", maxAllowed: "≤ 500 PPM" },
      { key: "carbon_monoxide", label: "Carbon Monoxide", maxAllowed: "≤ 15 PPM" },
    ],
    validityYears: 1,
    note: "Reference limits per EN 12021 and DIN-3188.",
  },
];

export function getFFEConfig(id: string): FFESubTypeConfig {
  return FFE_CERT_TYPES.find((t) => t.id === id) || FFE_CERT_TYPES[0];
}
