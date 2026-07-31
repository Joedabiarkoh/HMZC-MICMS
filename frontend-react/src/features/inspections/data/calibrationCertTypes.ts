// Calibration certificate sub-types — built from 8 real HMZC/BTMS
// calibration certificate templates (Downloads/CERT FOR SEA
// CHALLENGER/*.docx): personal multi-gas detector, fixed gas sampling
// system, 15ppm OWS bilge alarm, pressure calibrator (hand pump),
// temperature calibrator, pressure calibrator gauge, VECS O2, and
// ODME. A 9th source file (TEMPERATURE CALIBRATOR.doc) was an
// unreadable legacy binary .doc — skipped since the Temperature
// Calibrator sub-type below is already covered by its .docx
// counterpart (CERT 02 - TEMPERATURE CALIBRATOR _.docx).
//
// Structurally near-identical to Firefighting Equipment's own
// config-driven sub-type system (see ffeCertTypes.ts) — a fixed
// technical-reference block plus one or two incrementable registers —
// so this reuses that exact same proven architecture (CalibrationForm.tsx
// mirrors FFEForm.tsx) as its own division, rather than either
// duplicating FFE's data model under a confusing name or folding
// Calibration into "Firefighting Equipment" itself.
//
// Every source template used the same harmonized 3-row header (Vessel/
// Certificate No, IMO No/Date, Class/Place of Service) as FFE's own
// harmonized header — handled once in CalibrationForm.tsx, not repeated
// per sub-type here. Two older templates (Personal Multi-Gas Detector,
// Pressure Calibrator hand pump — both from a different vessel's
// pre-harmonization certificates) used a "Vessel/Date/Cert No/Temperature/
// Humidity" header instead; harmonized onto the same 3-row header here,
// with their ambient Temperature/Humidity readings folded into
// technicalFields instead (the same treatment Pressure Calibrator
// Gauge's own template already gave its "Ambient Conditions" line).

export interface CalibrationColumn {
  key: string;
  label: string;
}

export interface CalibrationSubTypeConfig {
  id: string;
  label: string;
  technicalFields: { key: string; label: string }[];
  // "Unit(s) Under Test" — consistent columns across every sub-type
  // (Manufacturer/Model/Serial No/Range), since every source template
  // used the same shape for this table, sometimes with more than one
  // row (e.g. a pump + its own gauge, tested together).
  itemColumns: CalibrationColumn[];
  itemTableLabel: string;
  // The actual calibration results/readings — this is what genuinely
  // varies per sub-type (a gas detector's As-Found/As-Left/Alarm
  // columns vs. a pressure gauge's simple Pressure/Indication pair).
  items2Columns: CalibrationColumn[];
  items2Label: string;
  note?: string;
  validityYears: 1 | 2;
}

const UNIT_UNDER_TEST_COLS: CalibrationColumn[] = [
  { key: "manufacturer", label: "Manufacturer" },
  { key: "model", label: "Model" },
  { key: "serialNo", label: "Serial/ID No." },
  { key: "range", label: "Range" },
];

export const CALIBRATION_CERT_TYPES: CalibrationSubTypeConfig[] = [
  {
    id: "multigas_detector",
    label: "Personal Multi-Gas Detector",
    technicalFields: [
      { key: "testGas", label: "Test Gas" },
      { key: "testGasManufacturer", label: "Test Gas Manufacturer" },
      { key: "ambientTemperature", label: "Ambient Temperature" },
      { key: "ambientHumidity", label: "Ambient Humidity" },
    ],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit(s) Under Test",
    items2Columns: [
      { key: "range", label: "Range" }, { key: "testGas", label: "Test Gas" },
      { key: "concentration", label: "Concentration" },
      { key: "indicationAsFound", label: "Indication (As Found)" }, { key: "indicationAsLeft", label: "Indication (As Left)" },
      { key: "errorAsFound", label: "Error (As Found)" }, { key: "errorAsLeft", label: "Error (As Left)" },
      { key: "alarmLow", label: "Alarm Low" }, { key: "alarmHigh", label: "Alarm High" },
    ],
    items2Label: "Test Data",
    note: "Calibration based on BS EN 60079-29-2:2007 and BS EN 50241-1:1999 & manufacturer's procedures. Reference gas composition traceability: NIST traceable.",
    validityYears: 1,
  },
  {
    id: "fixed_gas_sampling",
    label: "Fixed Gas Sampling System",
    technicalFields: [
      { key: "testGas", label: "Test Gas" },
      { key: "testGasManufacturer", label: "Test Gas Manufacturer" },
    ],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit(s) Under Test",
    items2Columns: [
      { key: "sensorNo", label: "Sensor No." }, { key: "testGas", label: "Test Gas" },
      { key: "concentration", label: "Concentration" },
      { key: "indicationAsFound", label: "Indication (As Found)" }, { key: "indicationAsLeft", label: "Indication (As Left)" },
      { key: "errorAsFound", label: "Error (As Found)" }, { key: "errorAsLeft", label: "Error (As Left)" },
    ],
    items2Label: "Test Result",
    note: "Calibration based on BS EN 60079-29-2:2007 & manufacturer's procedures.",
    validityYears: 1,
  },
  {
    id: "ows_15ppm",
    label: "15 PPM Bilge Alarm / Oily Water Separator (OWS)",
    technicalFields: [],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit Under Test",
    items2Columns: [
      { key: "procedure", label: "Procedure" },
      { key: "instrumentValue", label: "Instrument Value" },
      { key: "remarks", label: "Remarks" },
    ],
    items2Label: "Test Procedure",
    note: "System adjusted to zero in fresh water and tested per manufacturer's standard test procedure. Zero ppm re-confirmed after test with fresh water.",
    validityYears: 1,
  },
  {
    id: "pressure_calibrator_pump",
    label: "Pressure Calibrator / Hand Pump",
    technicalFields: [
      { key: "calEquipment", label: "Calibration Equipment" },
      { key: "calEquipmentManufacturer", label: "Calibration Equipment Manufacturer" },
      { key: "ambientTemperature", label: "Ambient Temperature" },
      { key: "ambientHumidity", label: "Ambient Humidity" },
    ],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit(s) Under Test",
    items2Columns: [
      { key: "pressure", label: "Pressure" }, { key: "indication", label: "Indication" },
      { key: "error", label: "Error" }, { key: "result", label: "Pass/Fail" },
    ],
    items2Label: "Calibration Results",
    note: "Hand-held pressure test pump pressure tested — instrument found to have no leak or drop in pressure.",
    validityYears: 1,
  },
  {
    id: "temperature_calibrator",
    label: "Temperature Calibrator",
    technicalFields: [
      { key: "standardInstrument", label: "Standard Instrument" },
      { key: "standardInstrumentManufacturer", label: "Standard Instrument Manufacturer" },
    ],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit Under Test",
    items2Columns: [
      { key: "setValue", label: "Set Value (°C)" }, { key: "indication", label: "Indication (°C)" },
      { key: "deviation", label: "Deviation (°C)" },
    ],
    items2Label: "Calibration Results",
    validityYears: 1,
  },
  {
    id: "pressure_calibrator_gauge",
    label: "Pressure Calibrator Gauge",
    technicalFields: [
      { key: "calEquipment", label: "Calibration Equipment" },
      { key: "calEquipmentManufacturer", label: "Calibration Equipment Manufacturer" },
      { key: "ambientConditions", label: "Ambient Conditions" },
    ],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit(s) Under Test",
    items2Columns: [
      { key: "pressure", label: "Pressure" }, { key: "indication", label: "Indication" },
    ],
    items2Label: "Calibration Results",
    note: "Hand-held pressure test pump pressure tested — instrument found to have no leak or drop in pressure.",
    validityYears: 1,
  },
  {
    id: "vecs_o2",
    label: "Vapour Emission Control System (VECS) — O2",
    technicalFields: [
      { key: "testGas", label: "Test Gas" },
      { key: "testGasManufacturer", label: "Test Gas Manufacturer" },
    ],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit Under Test",
    items2Columns: [
      { key: "test", label: "Test" }, { key: "result", label: "Result" },
    ],
    items2Label: "Test Data",
    note: "Calibration based on BS EN 60079-29-2:2007. Instrument adjusted to indicate 20.9% O2 in fresh air, re-confirmed after test on purging with fresh air.",
    validityYears: 1,
  },
  {
    id: "odme",
    label: "Oil Discharge Monitoring Equipment (ODME)",
    technicalFields: [],
    itemColumns: [
      { key: "manufacturer", label: "Manufacturer" }, { key: "model", label: "Model" }, { key: "serialNo", label: "Serial/ID No." },
    ],
    itemTableLabel: "Unit Under Test",
    items2Columns: [
      { key: "no", label: "No." }, { key: "test", label: "Test" }, { key: "result", label: "Result" },
    ],
    items2Label: "Test Result",
    validityYears: 1,
  },
];

export function getCalibrationConfig(id: string): CalibrationSubTypeConfig {
  return CALIBRATION_CERT_TYPES.find((t) => t.id === id) || CALIBRATION_CERT_TYPES[0];
}
