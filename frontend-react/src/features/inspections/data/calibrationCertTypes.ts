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
  // Requested directly: rather than starting the Test Data/Test Result
  // table empty, pre-load it with the actual figures from the real
  // source certificate for this sub-type — every column, not just the
  // fixed ones (e.g. the multi-gas detector's real As-Found/As-Left
  // readings, the pressure calibrator's real 5-point test ladder
  // results). These are reference/example values from one real past
  // calibration, not this instrument's current reading — the technician
  // is expected to overwrite the measured columns with today's actual
  // result before finalizing; they stay fully editable, including
  // adding/removing rows.
  defaultItems2?: Record<string, string>[];
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
    defaultItems2: [
      { range: "0-30% O2", testGas: "Oxygen (O2)", concentration: "12.0%", indicationAsFound: "-", indicationAsLeft: "12.0%", errorAsFound: "-", errorAsLeft: "0.0%", alarmLow: "19.5%", alarmHigh: "23.5%" },
      { range: "0-100% LEL", testGas: "LEL (Methane)", concentration: "50.0% LEL", indicationAsFound: "53.0% LEL", indicationAsLeft: "50.0% LEL", errorAsFound: "+3.0% LEL", errorAsLeft: "0.0% LEL", alarmLow: "10.0% LEL", alarmHigh: "50.0% LEL" },
      { range: "0-200 ppm", testGas: "H2S", concentration: "25.0 ppm", indicationAsFound: "24.0 ppm", indicationAsLeft: "25.0 ppm", errorAsFound: "-1.0 ppm", errorAsLeft: "0.0 ppm", alarmLow: "5.0 ppm", alarmHigh: "100.0 ppm" },
      { range: "0-1000 ppm", testGas: "CO", concentration: "50.0 ppm", indicationAsFound: "52.0 ppm", indicationAsLeft: "50.0 ppm", errorAsFound: "2.0 ppm", errorAsLeft: "0.0 ppm", alarmLow: "25.0 ppm", alarmHigh: "1200 ppm" },
    ],
    note: "Calibration based on BS EN 60079-29-2:2007 and BS EN 50241-1:1999 & manufacturer's procedures. Reference gas composition traceability: NIST traceable.",
    validityYears: 1,
  },
  {
    // Requested directly: "move the gas detector A & B into calibration
    // as gas detectors are part of calibration items" — moved from
    // ffeCertTypes.ts (that file's "gas_detector", now deprecated
    // there but kept registered so already-saved certificates still
    // resolve). Recast into this file's Unit(s) Under Test / Test Data
    // shape rather than the FFE archetype's single item table:
    // itemColumns is the standard shared register (was empty/absent on
    // the FFE version), items2Columns is the original 8-column gas-type
    // calibration data unchanged.
    id: "gas_detector_type_a",
    label: "Gas Detector — Maintenance & Calibration (Type A)",
    technicalFields: [],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit(s) Under Test",
    items2Columns: [
      { key: "gasType", label: "Gas Type" }, { key: "spanReading", label: "Span Reading" },
      { key: "alarmHigh", label: "Alarm Set Point (High)" }, { key: "alarmLow", label: "Alarm Set Point (Low)" },
      { key: "twa", label: "TWA" }, { key: "stel", label: "STEL" }, { key: "cylNo", label: "Cyl #" },
      { key: "calibrationTest", label: "Calibration Test" },
    ],
    items2Label: "Calibration Test Data",
    note: "Add one row per gas type actually fitted — the standard set is Combustible (%LEL), Oxygen (%VOL), Toxic Gas CO (PPM), and Toxic Gas H2S (PPM). Calibration is crucial for detector accuracy/reliability; follow the manufacturer's requirements to prevent premature failures.",
    validityYears: 1,
  },
  {
    // Moved from ffeCertTypes.ts's "gas_detector_type_b" — see
    // gas_detector_type_a's own comment above. Its Instrument Type/
    // Model/Serial Number technicalFields are dropped here in favor of
    // the shared Unit(s) Under Test register (itemColumns) every other
    // Calibration sub-type already uses for exactly that — Work
    // Status/Calibrated Date/Next Recommended Service Date stay as
    // technicalFields since they're facts about the certificate visit,
    // not the instrument itself. defaultItems2 is the real, filled-in
    // reference reading from the actual second source template ("GAS
    // DETECTOR CERTIFICATE #2.docx", a Couper Tide vessel MSA Altair
    // 4X unit, cylinder BC691594).
    id: "gas_detector_type_b",
    label: "Gas Detector — Maintenance & Calibration (Type B)",
    technicalFields: [
      { key: "workStatus", label: "Work Status" }, { key: "calibratedDate", label: "Calibrated Date" },
      { key: "nextServiceDate", label: "Next Recommended Service Date" },
    ],
    itemColumns: UNIT_UNDER_TEST_COLS,
    itemTableLabel: "Unit(s) Under Test",
    items2Columns: [
      { key: "gasType", label: "Gas Type" }, { key: "spanReading", label: "Span Reading" },
      { key: "alarmHigh", label: "Alarm Set Point (High)" }, { key: "alarmLow", label: "Alarm Set Point (Low)" },
      { key: "twa", label: "TWA" }, { key: "stel", label: "STEL" }, { key: "cylNo", label: "Cyl #" },
      { key: "calibrationTest", label: "Calibration Test" },
    ],
    items2Label: "Calibration Test Data",
    defaultItems2: [
      { gasType: "COMBUSTIBLE (%LEL)", spanReading: "58%", alarmHigh: "20%", alarmLow: "10%", twa: "N/A", stel: "N/A", cylNo: "BC691594", calibrationTest: "PASS" },
      { gasType: "OXYGEN (%VOL)", spanReading: "15.0%", alarmHigh: "23.0%", alarmLow: "19.5%", twa: "N/A", stel: "N/A", cylNo: "BC691594", calibrationTest: "PASS" },
      { gasType: "TOXIC GAS CO (PPM)", spanReading: "60 PPM", alarmHigh: "100 PPM", alarmLow: "25 PPM", twa: "25 PPM", stel: "100 PPM", cylNo: "BC691594", calibrationTest: "PASS" },
      { gasType: "TOXIC GAS H2S (PPM)", spanReading: "20 PPM", alarmHigh: "10 PPM", alarmLow: "5 PPM", twa: "10 PPM", stel: "15 PPM", cylNo: "BC691594", calibrationTest: "PASS" },
    ],
    note: "Calibration is crucial for ensuring the accuracy and reliability of detectors. Following the manufacturer's requirements helps maintain the performance and longevity of the equipment, preventing premature failures.",
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
    defaultItems2: [
      { sensorNo: "01", testGas: "Methane (CH4 - LEL)", concentration: "50% LEL", indicationAsFound: "49", indicationAsLeft: "50", errorAsFound: "-1", errorAsLeft: "0" },
    ],
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
    defaultItems2: [
      { procedure: "Alarm Test", instrumentValue: "15 PPM", remarks: "PASS" },
      { procedure: "Alarm Set Points", instrumentValue: "15 PPM", remarks: "GOOD" },
      { procedure: "Data Recording", instrumentValue: "Data Logger - Matching", remarks: "PASS" },
    ],
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
    defaultItems2: [
      { pressure: "0.00 BAR", indication: "0.00 BAR", error: "0.00", result: "PASS" },
      { pressure: "100.00 BAR", indication: "100.00 BAR", error: "0.00", result: "PASS" },
      { pressure: "400.00 BAR", indication: "400.00 BAR", error: "0.00", result: "PASS" },
      { pressure: "500.00 BAR", indication: "500.01 BAR", error: "0.01", result: "PASS" },
      { pressure: "650.00 BAR", indication: "650.01 BAR", error: "0.01", result: "PASS" },
    ],
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
    defaultItems2: [
      { setValue: "25.0", indication: "25.00", deviation: "0.0" },
      { setValue: "100.0", indication: "100.1", deviation: "0.1" },
      { setValue: "300.0", indication: "300.1", deviation: "0.1" },
      { setValue: "450.0", indication: "450.2", deviation: "0.2" },
      { setValue: "550.0", indication: "550.3", deviation: "0.3" },
    ],
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
    defaultItems2: [
      { pressure: "0.00 BAR", indication: "0.00 BAR" },
      { pressure: "20.00 BAR", indication: "20.0 BAR" },
      { pressure: "40.00 BAR", indication: "40.0 BAR" },
      { pressure: "60.00 BAR", indication: "60.0 BAR" },
    ],
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
    defaultItems2: [
      { test: "VECS Oxygen Test", result: "OK" },
      { test: "Gas Detector Sensor", result: "OK" },
    ],
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
    defaultItems2: [
      { no: "1", test: "Data Log", result: "OK" },
      { no: "2", test: "Date and Time", result: "OK" },
      { no: "3", test: "Alarm Check", result: "OK" },
      { no: "4", test: "Zero Calibration", result: "-" },
      { no: "5", test: "Simulation Test", result: "-" },
    ],
    validityYears: 1,
  },
];

export function getCalibrationConfig(id: string): CalibrationSubTypeConfig {
  return CALIBRATION_CERT_TYPES.find((t) => t.id === id) || CALIBRATION_CERT_TYPES[0];
}
