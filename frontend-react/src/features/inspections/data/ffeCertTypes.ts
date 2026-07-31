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
  readingsRows?: { key: string; label: string; maxAllowed: string }[];
  validityYears: 1 | 2;
  note?: string;
}

const SERIAL_MAKE_MODEL_COLS: FFEColumn[] = [
  { key: "serialNo", label: "Serial No" },
  { key: "make", label: "Make" },
  { key: "typeModel", label: "Type/Model" },
  { key: "mfgDate", label: "Mfg Date" },
  { key: "size", label: "Size" },
  { key: "workDone", label: "Work Done" },
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
      { key: "size", label: "Size" }, { key: "workDone", label: "Work Done" },
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
      { key: "size", label: "Size" }, { key: "workDone", label: "Work Done" },
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
      { key: "workDone", label: "Work Done" },
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
      { key: "workDone", label: "Work Done" },
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
      { key: "workDone", label: "Work Done" },
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
    // FFEItemsTable), not a separate data field — the six columns below
    // are what's actually entered per row. Cartridge Exp./Weight and a
    // free-text Remarks column (present in the old combined sub-type)
    // were dropped to match the exact format requested.
    id: "portable_fire_extinguisher",
    label: "Portable Fire Extinguisher",
    archetype: "items",
    workCodes: [
      "1 = Inspection", "2 = Service", "3 = Content Checked", "4 = Recharge", "5 = Painted",
      "6 = New Extinguisher", "7 = Hydro Test", "8 = Condemned",
      "F = Foam", "W = Water", "CO2 = Carbon Dioxide", "WC = Wet Chemical", "DCP = Dry Chemical Powder",
      "PK = Purple K", "A+B = Chemical Foam A+B", "AFFF = Aqueous Film Forming Foam", "FP = Flouro Protein",
      "Cart = Cartridge Type", "PRE = Pressure Type", "WT = Weighing", "HT = Hydro Test",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" }, { key: "type", label: "Type" },
      { key: "capacity", label: "Capacity" }, { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
      { key: "workDone", label: "Work Done" },
    ],
    validityYears: 1,
  },
  {
    id: "non_portable_fire_extinguisher",
    label: "Non-Portable Fire Extinguisher",
    archetype: "items",
    workCodes: [
      "1 = Inspection", "2 = Service", "3 = Content Checked", "4 = Recharge", "5 = Painted",
      "6 = New Extinguisher", "7 = Hydro Test", "8 = Condemned",
      "F = Foam", "W = Water", "CO2 = Carbon Dioxide", "WC = Wet Chemical", "DCP = Dry Chemical Powder",
      "PK = Purple K", "A+B = Chemical Foam A+B", "AFFF = Aqueous Film Forming Foam", "FP = Flouro Protein",
      "Cart = Cartridge Type", "PRE = Pressure Type", "WT = Weighing", "HT = Hydro Test",
    ],
    itemColumns: [
      { key: "serialNo", label: "Serial No" }, { key: "make", label: "Make" }, { key: "type", label: "Type" },
      { key: "capacity", label: "Capacity" }, { key: "lastHydroTestDate", label: "Last Hydro Test Date" },
      { key: "workDone", label: "Work Done" },
    ],
    validityYears: 1,
  },
  {
    id: "foam_applicator",
    label: "Foam Applicator",
    archetype: "items",
    itemColumns: [
      { key: "location", label: "Location" }, { key: "make", label: "Make" }, { key: "type", label: "Type" },
      { key: "foamCan", label: "Foam Can" }, { key: "expDate", label: "Exp Date" }, { key: "serialNo", label: "Serial No" },
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
    // Doc source (GAS DETECTOR CERTIFICATE) shows a fixed set of 4 gas
    // types with several columns of calibration data each, not a single
    // measured-value-vs-maximum-allowed pair like Air Quality Test's
    // "readings" archetype — modelled as "items" instead so each of the
    // 4 standard gas types (and any others actually fitted) is its own
    // row with all the columns the real calibration certificate needs.
    id: "gas_detector",
    label: "Gas Detector — Maintenance & Calibration",
    archetype: "items",
    itemColumns: [
      { key: "gasType", label: "Gas Type" }, { key: "spanReading", label: "Span Reading" },
      { key: "alarmHigh", label: "Alarm Set Point (High)" }, { key: "alarmLow", label: "Alarm Set Point (Low)" },
      { key: "twa", label: "TWA" }, { key: "stel", label: "STEL" }, { key: "cylNo", label: "Cyl #" },
      { key: "calibrationTest", label: "Calibration Test" },
    ],
    validityYears: 1,
    note: "Add one row per gas type actually fitted — the standard set is Combustible (%LEL), Oxygen (%VOL), Toxic Gas CO (PPM), and Toxic Gas H2S (PPM). Calibration is crucial for detector accuracy/reliability; follow the manufacturer's requirements to prevent premature failures.",
  },

  // ---------- Archetype: system (fixed installations) ----------
  {
    // itemColumns given its own array (not the shared CYLINDER_SPEC_COLS
    // other system types below still use) — the "FIXED CO2 CERTIFICATE
    // (EMERG. GENERATOR)" template (Cert. Simples batch) added Make, Gas
    // Type and Remarks, and its source doc actually carries FOUR
    // separate cylinder registers (Main, Pilot-Local, Pilot-Remote, Time
    // Delay) rather than one combined table — kept as one incrementable
    // table here (consistent with every other multi-cylinder sub-type
    // in this file) with the note below telling the technician to
    // identify which group each row belongs to, rather than adding a
    // fourth distinct table shape just for this one sub-type.
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
      { key: "lastHydroTestDate", label: "Last Hydro Test Date" }, { key: "workDone", label: "Work Done" }, { key: "remarks", label: "Remarks" },
    ],
    itemTableLabel: "Cylinder Specifications (Main / Pilot-Local / Pilot-Remote / Time Delay — note which group in Remarks)",
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
    readingsRows: [
      { key: "water_vapour", label: "Water Vapour", maxAllowed: "35 mg/m³" },
      { key: "oil_vapor", label: "Oil Vapor", maxAllowed: "0.5 mg/m³" },
      { key: "carbon_dioxide", label: "Carbon Dioxide", maxAllowed: "500 PPM" },
      { key: "carbon_monoxide", label: "Carbon Monoxide", maxAllowed: "15 PPM" },
    ],
    validityYears: 1,
    note: "Reference limits per EN 12021 and DIN-3188.",
  },
];

export function getFFEConfig(id: string): FFESubTypeConfig {
  return FFE_CERT_TYPES.find((t) => t.id === id) || FFE_CERT_TYPES[0];
}
