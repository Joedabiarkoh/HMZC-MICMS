// The Hook Load Test Report — built directly from HMZC's own
// Hook_Test_Report_3.5t.docx (release hook, SWL 3.5 t, hydraulic hook tester).
//
// It is the form a technician fills in when the load test of a Hook
// Re-installation Certificate is done WITH THE HOOK TESTER: selecting
// "Hook tester" under the certificate's Load Test ("Load applied by") brings
// this report up, prints it as its own section of the certificate and exports
// it with the Word copy (see HookReinstallForm / CertificatePreview /
// certificateDocxExport).
//
// The report's one real calculation is the pressure for a given load, read off
// the cylinder's rating plate assuming pressure is proportional to load:
//     pressure (bar) = load (t) × rated pressure (bar) ÷ rated capacity (t)
// For the document's cylinder (20 t at 630 bar) that is 31.5 bar per tonne, so
// a 2.0 × SWL proof load on a 3.5 t hook is 7.0 t = 220.5 bar. The tables
// below are computed from the report's own inputs, so a different hook,
// cylinder or test factor needs no hand arithmetic.

import { parseNumber } from "./parseNumber";
import { HookTesterReport } from "../types/inspection.types";

export function freshHookTesterReport(): HookTesterReport {
  return {
    clientVessel: "",
    equipment: "Lifting / release hook for rescue boat (FRC) davit",
    hookMakerType: "",
    hookSerialCertNo: "",
    swl: "3.5",
    dateOfTest: "",
    placeOfTest: "",
    cylinderModel: "Raptor Pro RC20T-100, 20 t capacity, 100 mm stroke",
    cylinderSerialDate: "20250304-55 / manufactured Mar 2025",
    cylinderCapacity: "20",
    ratedPressure: "630",
    gaugeRange: "0-400 bar",
    gaugeMake: "",
    gaugeSerialNo: "",
    gaugeCertNo: "",
    gaugeCertExpiry: "",
    pumpFrame: "",
    testFactor: "2.0",
    holdMinutes: "5",
    gaugeReadings: {},
    pressureStart: "",
    pressureEnd: "",
    visualConfirmed: false,
    releaseConfirmed: false,
    ndt: "Not carried out",
    result: "",
    company: "HMZC LTD",
    testDate: "",
    witnessedBy: "",
    witnessDate: "",
  };
}

// Reference test factors — the report's section 3 table.
export const HOOK_TESTER_FACTORS: { factor: number; use: string }[] = [
  { factor: 1.0, use: "Function / working-load check" },
  { factor: 1.1, use: "Overload check" },
  { factor: 2.0, use: "Proof load" },
  { factor: 2.2, use: "If class / maker requires 2.2 ×" },
];

// The staged increments of section 4 (% of the test load).
export const HOOK_TESTER_STAGES: { pct: number; label: string }[] = [
  { pct: 25, label: "Increment" },
  { pct: 50, label: "Increment" },
  { pct: 75, label: "Increment" },
  { pct: 100, label: "Full test load - hold" },
];

export const HOOK_TESTER_GAUGE_NOTE =
  "Note: the 0-100 bar gauge used on the davit hydraulics cannot read these pressures and must not be used for this test.";

export const HOOK_TESTER_FACTOR_NOTE =
  "A 2.0 × SWL proof factor is used as the standard for loose gear. If the hook certificate, the maker's manual or the class society specifies another factor (e.g. 2.2 × SWL), select it above — the figures below follow.";

export const HOOK_TESTER_PROCEDURE: string[] = [
  "Visually inspect the hook before testing (body, throat, release lever, safety pin, locking mechanism) for cracks, wear, corrosion and deformation. Record the condition.",
  "Function-test the release and reset mechanism with no load.",
  "Fit the hook in the test rig with the cylinder in line with the hook axis, and zero the gauge.",
  "Apply the load in increments, pausing at each stage and recording the gauge reading in the table below.",
  "Hold the full test load for the required time (typically 5 minutes) and observe the gauge for any pressure drop.",
  "Release the pressure slowly, remove the hook and inspect again. Repeat the function test of the release gear.",
];

export const HOOK_TESTER_CONDITIONS_NOTE =
  "Test conditions: 1 t is taken as 1,000 kg. Calculated pressures come from the cylinder rating plate. Seal friction can shift the actual gauge reading by a few percent, so confirm against the cylinder calibration data where available.";

export const HOOK_TESTER_ACCEPTANCE: string[] = [
  "Gauge pressure stable during the hold, with no drop beyond gauge resolution and no leakage from the cylinder or pump.",
  "No cracking, permanent deformation or damage to the hook, latch or release gear after the test.",
  "Release and reset function operates correctly before and after the test.",
];

export const HOOK_TESTER_RESULT_LABELS: Record<"pass" | "fail" | "", string> = {
  pass: "PASS",
  fail: "FAIL",
  "": "—",
};

/** Rounds to one decimal, treating an exact half as "up" (110.25 → 110.3,
 * 242.55 → 242.6) the way the source report's table does, whatever the
 * floating-point representation of the product happens to be. */
export function fmtBar(n: number): string {
  return (Math.round(n * 10 + 1e-9) / 10).toFixed(1);
}
export function fmtTonnes(n: number): string {
  return (Math.round(n * 100 + 1e-9) / 100).toFixed(2);
}

export interface HookTesterPlan {
  swl: number;
  factor: number;
  barPerTonne: number;
  testLoad: number; // t
  testPressure: number; // bar
  stages: { pct: number; label: string; loadT: number; pressureBar: number }[];
  reference: { factor: number; use: string; loadT: number; pressureBar: number; selected: boolean }[];
}

/** Everything derived from the report's inputs; null until the SWL, test
 * factor and the cylinder's rating (capacity + pressure) are all numeric. */
export function computeHookTesterPlan(r: HookTesterReport): HookTesterPlan | null {
  const swl = parseNumber(r.swl);
  const factor = parseNumber(r.testFactor);
  const capacity = parseNumber(r.cylinderCapacity);
  const rated = parseNumber(r.ratedPressure);
  if (swl === null || factor === null || capacity === null || rated === null || swl <= 0 || factor <= 0 || capacity <= 0 || rated <= 0) return null;
  const barPerTonne = rated / capacity;
  const testLoad = factor * swl;
  return {
    swl,
    factor,
    barPerTonne,
    testLoad,
    testPressure: testLoad * barPerTonne,
    stages: HOOK_TESTER_STAGES.map((s) => {
      const loadT = (testLoad * s.pct) / 100;
      return { ...s, loadT, pressureBar: loadT * barPerTonne };
    }),
    reference: HOOK_TESTER_FACTORS.map((f) => ({
      ...f,
      loadT: f.factor * swl,
      pressureBar: f.factor * swl * barPerTonne,
      selected: Math.abs(f.factor - factor) < 1e-9,
    })),
  };
}

/** Pressure drop over the hold (start − end), or null until both are numeric. */
export function hookTesterDrop(r: HookTesterReport): number | null {
  const a = parseNumber(r.pressureStart);
  const b = parseNumber(r.pressureEnd);
  return a === null || b === null ? null : a - b;
}

/** Why the hook-tester report can't be finalized yet (empty = complete). */
export function getHookTesterBlockers(r: HookTesterReport | undefined): string[] {
  const problems: string[] = [];
  if (!r) return ["Hook Tester report has not been started"];
  if (!computeHookTesterPlan(r)) problems.push("Hook Tester: SWL, test factor and the cylinder's rated capacity and pressure must be numbers");
  if (!r.gaugeCertNo.trim()) problems.push("Hook Tester: the pressure gauge's calibration certificate no. is required (traceability)");
  if (parseNumber(r.holdMinutes) === null) problems.push("Hook Tester: hold time (minutes) is required");
  const missing = HOOK_TESTER_STAGES.filter((s) => parseNumber(r.gaugeReadings[String(s.pct)]) === null);
  if (missing.length) problems.push(`Hook Tester: gauge reading missing for ${missing.map((s) => s.pct + "%").join(", ")}`);
  if (hookTesterDrop(r) === null) problems.push("Hook Tester: gauge reading at the start and after the hold are required");
  if (!r.result) {
    problems.push("Hook Tester: Overall result (PASS / FAIL) must be selected");
  } else if (r.result === "pass" && !(r.visualConfirmed && r.releaseConfirmed)) {
    problems.push("Hook Tester: PASS needs the visual inspection and the release / reset function after the test both confirmed");
  }
  return problems;
}
