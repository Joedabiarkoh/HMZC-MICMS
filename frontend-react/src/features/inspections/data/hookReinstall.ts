// Fixed content for the Release Hook Re-installation Certificate, built
// directly from HMZC's own HMZC_Hook_Reinstallation_Certificate.docx (revised
// template: no Date of Last Service / Class-Flag fields, no Qty / Next Due
// columns, a "Swivel (if fitted)" row, and the check sheet runs A, B, C —
// the craft / launching-appliance checks were removed)
// (re-installation of the release hook assembly on a lifeboat, rescue
// boat or free-fall boat, followed by its Inspection & Test Check Sheet
// and proof-load test). The wording, order and MSC.402(96) paragraph
// references below are the template's own and are kept verbatim — they
// were not independently re-verified against the IMO text, so any change
// to them should come from HMZC's template, not from here.
//
// What this adds beyond the template (see HookReinstallData's own
// comments): an overall Satisfactory/Not-satisfactory outcome, the
// hook's approval certificate no. and the service provider's
// authorisation reference, an auto-calculated proof load, and finalize
// rules (every check answered, a remark on every NO, outcome consistent
// with the answers) so a half-completed check sheet can't be issued.

import { parseNumber } from "./parseNumber";
import { getHookTesterBlockers } from "./hookTester";
import { HookCheckAnswer, HookCraftType, HookLoadTestData, HookOutcome, HookReinstallData } from "../types/inspection.types";

export const HOOK_CRAFT_TYPES: { key: Exclude<HookCraftType, "">; label: string }[] = [
  { key: "conventional", label: "Conventional Lifeboat" },
  { key: "rescue", label: "Rescue Boat" },
  { key: "freefall", label: "Free Fall Boat" },
];

export const HOOK_REMOVAL_REASONS: { key: string; label: string }[] = [
  { key: "servicing", label: "Servicing / overhaul" },
  { key: "repair", label: "Repair" },
  { key: "replacement", label: "Replacement" },
  { key: "other", label: "Other" },
];

export const HOOK_TYPES = ["On-load release", "Off-load release only"];

/** The "Load applied by" option that opens the Hook Load Test Report. */
export const HOOK_TESTER_KEY = "hooktester";

export const HOOK_LOAD_METHODS: { key: string; label: string }[] = [
  { key: "jib", label: "Jib / crane" },
  { key: "weights", label: "Test weights" },
  { key: "waterbags", label: "Water bags" },
  { key: "persons", label: "Craft with persons" },
  // Brings up the Hook Load Test Report form (data/hookTester.ts).
  { key: HOOK_TESTER_KEY, label: "Hook tester" },
];

// The template's "Components Removed / Installed" table — a fixed list
// by number, like FRC_COMPONENT_ROWS; only the old / new serial numbers are
// filled in per job.
export const HOOK_COMPONENT_ROWS: { key: string; description: string }[] = [
  { key: "hookFwd", description: "Release hook, forward (or free-fall release unit)" },
  { key: "hookAft", description: "Release hook, aft" },
  { key: "interlock", description: "Hydrostatic interlock (if fitted)" },
  { key: "cable", description: "Release cable / linkage and handle" },
  { key: "fastenings", description: "Hook fastenings (bolts, pins, locking devices)" },
  { key: "other", description: "Other parts replaced" },
  { key: "swivel", description: "Swivel (if fitted)" },
];

export interface HookCheckDef {
  key: string;
  label: string;
  ref: string;
}

// The template's "Inspection & Test Check Sheet", sections A–C (the revised
// template dropped the craft / launching-appliance section), in the
// template's own order. Numbered 1–13 on the certificate.
export const HOOK_CHECK_GROUPS: { title: string; checks: HookCheckDef[] }[] = [
  {
    title: "A. Records and Preparation",
    checks: [
      { key: "records", label: "Maintenance records and equipment certificates reviewed", ref: "6.2.2" },
      { key: "craftSupported", label: "Craft supported so hooks are unloaded during re-installation", ref: "6.2.4" },
    ],
  },
  {
    title: "B. Release Gear Examination",
    checks: [
      { key: "activatingDevices", label: "Activating devices checked; no excessive free play", ref: "6.2.4" },
      { key: "interlockCheck", label: "Hydrostatic interlock, where fitted", ref: "6.2.4" },
      { key: "controlCables", label: "Control and release cables", ref: "6.2.4" },
      { key: "hookFastening", label: "Hook fastening (bolts, pins, locking devices)", ref: "6.2.4" },
      { key: "hookUnits", label: "Hook release units: tolerances; vital parts free of defects and cracks", ref: "6.3.3" },
      { key: "gearAdjusted", label: "Release gear adjusted after assembly per manufacturer", ref: "6.3.3" },
    ],
  },
  {
    title: "C. Operational Tests",
    checks: [
      { key: "winchBrakeTest", label: "Annual winch brake test (abrupt brake at max lowering speed)", ref: "6.2.10" },
      { key: "offLoadRelease", label: "Off-load release test", ref: "6.2.6" },
      { key: "onLoadRelease", label: "On-load release test", ref: "6.2.5" },
      { key: "freeFallRelease", label: "Free-fall release function test, no launch; back-up where applicable", ref: "6.2.7" },
      { key: "hooksReset", label: "Hooks reset; craft verified ready for launch", ref: "6.2.7" },
    ],
  },
];

// The template's "Result at Test Load" rows (L1–L3).
export const HOOK_LOAD_CHECKS: HookCheckDef[] = [
  { key: "loadOnLoadRelease", label: "On-load release satisfactory at test load", ref: "6.2.5, 6.3.3.4" },
  { key: "loadWinchBrake", label: "Dynamic winch brake test at 1.1 × total mass (five-yearly)", ref: "6.3.1" },
  { key: "loadReinspection", label: "Hooks and stressed parts re-inspected after test; no defects", ref: "6.3.2" },
];

export const HOOK_ALL_CHECKS: HookCheckDef[] = [...HOOK_CHECK_GROUPS.flatMap((g) => g.checks), ...HOOK_LOAD_CHECKS];

export const HOOK_OUTCOME_LABELS: Record<HookOutcome, string> = {
  satisfactory: "Satisfactory — release gear fit for service",
  not_satisfactory: "Not satisfactory — defects to be rectified before the craft is used",
  "": "—",
};

export const HOOK_SCOPE_OF_WORK =
  "Re-installation of the release hook assembly on the above survival craft following removal for servicing, overhaul, repair or replacement, carried out in accordance with the manufacturer’s maintenance instructions, SOLAS Chapter III regulation 20, the LSA Code and IMO resolution MSC.402(96). Work included fitting of the hook units and fastenings, connection and adjustment of the release cable / linkage, inspection of vital parts, operational and load testing of the release gear, and re-instatement of the craft to service-ready condition.";

export const HOOK_LOAD_TEST_NOTE =
  "Required after overhaul or re-installation of release gear and at the five-yearly survey (6.3.1, 6.3.3.4). Test load = 1.1 × (craft mass + full complement of persons + equipment).";

export const HOOK_CERTIFICATION_STATEMENT =
  "This certificate confirms that the above work was carried out by qualified personnel in accordance with the equipment manufacturer’s instructions, SOLAS Chapter III and IMO MSC.402(96). It does not replace statutory survey or classification society certification where required. No maintenance or adjustment of release gear is carried out while the hooks are under load (6.2.4).";

export function hookCheckLabel(v?: HookCheckAnswer): string {
  return { yes: "YES", no: "NO", na: "N/A", "": "—" }[v || ""] || "—";
}

function fmtKg(n: number): string {
  // 1 decimal, trailing ".0" dropped — "1375" not "1375.0".
  return String(Math.round(n * 10) / 10);
}

/**
 * Total mass and proof load for the Load Test block:
 *   total mass = craft mass + (persons × mass per person) + equipment
 *   test load  = 1.1 × total mass
 * Returns null for both until the craft mass, number of persons and mass
 * per person are all numeric (equipment may be blank = 0) — a partially
 * filled block never shows a misleadingly low "test load".
 */
export function computeHookLoad(lt: HookLoadTestData): { totalMass: string; testLoad: string } | null {
  const craft = parseNumber(lt.craftMass);
  const persons = parseNumber(lt.personsCount);
  const each = parseNumber(lt.personMass);
  if (craft === null || persons === null || each === null) return null;
  const equipment = parseNumber(lt.equipmentMass) ?? 0;
  const total = craft + persons * each + equipment;
  return { totalMass: fmtKg(total), testLoad: fmtKg(total * 1.1) };
}

/**
 * Reasons this certificate can't be finalized yet (empty = ready). Pure
 * so it is unit-tested directly; InspectionWorkspace's getFinalizeBlockers
 * adds the vessel/engineer/signature checks every certificate type shares.
 */
export function getHookBlockers(data: HookReinstallData | undefined): string[] {
  const problems: string[] = [];
  if (!data) return problems;

  if (!data.craftType) problems.push("Craft Type must be selected");
  if (!data.removedFor.length) problems.push("Reason the hooks were removed must be selected");

  const unanswered = HOOK_ALL_CHECKS.filter((c) => !data.checks[c.key]);
  if (unanswered.length) problems.push(`${unanswered.length} check${unanswered.length === 1 ? "" : "s"} on the Inspection & Test Check Sheet not answered (use N/A if not applicable)`);

  const noWithoutRemark = HOOK_ALL_CHECKS.filter((c) => data.checks[c.key] === "no" && !(data.checkRemarks[c.key] || "").trim());
  if (noWithoutRemark.length) problems.push(`A remark is required for every NO answer (${noWithoutRemark.length} missing)`);

  if (!data.outcome) {
    problems.push("Overall Result (Satisfactory / Not satisfactory) must be selected");
  } else if (data.outcome === "satisfactory" && HOOK_ALL_CHECKS.some((c) => data.checks[c.key] === "no")) {
    problems.push("Overall Result cannot be Satisfactory while any check is answered NO");
  }

  if (data.loadTest.loadMethods.includes(HOOK_TESTER_KEY)) {
    // Load test done with the hook tester: the Hook Load Test Report is the
    // record (its own cylinder rating / gauge readings), not the mass figures.
    problems.push(...getHookTesterBlockers(data.hookTester));
  } else if (data.checks.loadOnLoadRelease === "yes" && !computeHookLoad(data.loadTest)) {
    // A YES on the on-load release at test load asserts a load test was
    // actually done — it needs the mass data that produced the test load.
    problems.push("Load Test: craft mass, number of persons and mass per person are required to record the test load");
  }

  return problems;
}
