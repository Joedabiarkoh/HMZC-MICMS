import { describe, expect, it } from "vitest";
import { HOOK_ALL_CHECKS, HOOK_CHECK_GROUPS, HOOK_COMPONENT_ROWS, HOOK_LOAD_METHODS, HOOK_TESTER_KEY, getHookBlockers } from "./hookReinstall";
import { computeHookTesterPlan, fmtBar, fmtTonnes, freshHookTesterReport, getHookTesterBlockers, hookTesterDrop } from "./hookTester";
import { freshHookReinstallState } from "./inspectionHelpers";
import { HookReinstallData, HookTesterReport } from "../types/inspection.types";

// The figures below are the ones printed in HMZC's own Hook_Test_Report_3.5t.docx
// (hook SWL 3.5 t, Raptor Pro RC20T-100 cylinder: 20 t at 630 bar = 31.5 bar/t).
describe("hook tester pressure calculation matches the source report", () => {
  const plan = computeHookTesterPlan(freshHookTesterReport())!;

  it("31.5 bar per tonne, 2.0 × SWL = 7.0 t = 220.5 bar", () => {
    expect(plan.barPerTonne).toBe(31.5);
    expect(fmtTonnes(plan.testLoad)).toBe("7.00");
    expect(fmtBar(plan.testPressure)).toBe("220.5");
  });

  it("reference loads for the other test factors (the report's section 3 table)", () => {
    expect(plan.reference.map((r) => [r.factor, fmtTonnes(r.loadT), fmtBar(r.pressureBar)])).toEqual([
      [1.0, "3.50", "110.3"],
      [1.1, "3.85", "121.3"],
      [2.0, "7.00", "220.5"],
      [2.2, "7.70", "242.6"],
    ]);
    expect(plan.reference.filter((r) => r.selected).map((r) => r.factor)).toEqual([2.0]);
  });

  it("the four test stages (the report's section 4 table)", () => {
    expect(plan.stages.map((s) => [s.pct, fmtTonnes(s.loadT), fmtBar(s.pressureBar)])).toEqual([
      [25, "1.75", "55.1"],
      [50, "3.50", "110.3"],
      [75, "5.25", "165.4"],
      [100, "7.00", "220.5"],
    ]);
  });

  it("follows a different test factor, hook or cylinder without hand arithmetic", () => {
    const r = { ...freshHookTesterReport(), testFactor: "2.2" };
    expect(fmtBar(computeHookTesterPlan(r)!.testPressure)).toBe("242.6");
    const big = { ...freshHookTesterReport(), swl: "5", cylinderCapacity: "10", ratedPressure: "700" };
    const p = computeHookTesterPlan(big)!; // 70 bar/t, 10 t proof
    expect([p.barPerTonne, fmtBar(p.testPressure)]).toEqual([70, "700.0"]);
  });

  it("returns no plan until the SWL and the cylinder rating are numbers", () => {
    expect(computeHookTesterPlan({ ...freshHookTesterReport(), swl: "" })).toBeNull();
    expect(computeHookTesterPlan({ ...freshHookTesterReport(), cylinderCapacity: "abc" })).toBeNull();
    expect(computeHookTesterPlan({ ...freshHookTesterReport(), ratedPressure: "0" })).toBeNull();
  });

  it("pressure drop over the hold", () => {
    expect(hookTesterDrop({ ...freshHookTesterReport(), pressureStart: "220", pressureEnd: "218" })).toBe(2);
    expect(hookTesterDrop(freshHookTesterReport())).toBeNull();
  });
});

function completedReport(overrides: Partial<HookTesterReport> = {}): HookTesterReport {
  return {
    ...freshHookTesterReport(),
    gaugeCertNo: "CAL-1",
    gaugeReadings: { "25": "55", "50": "110", "75": "165", "100": "220" },
    pressureStart: "220",
    pressureEnd: "220",
    visualConfirmed: true,
    releaseConfirmed: true,
    result: "pass",
    ...overrides,
  };
}

describe("getHookTesterBlockers", () => {
  it("a completed report has none", () => {
    expect(getHookTesterBlockers(completedReport())).toEqual([]);
  });

  it("a fresh report is blocked on every record the tester must make", () => {
    const text = getHookTesterBlockers(freshHookTesterReport()).join(" | ");
    expect(text).toMatch(/calibration certificate/);
    expect(text).toMatch(/gauge reading missing for 25%, 50%, 75%, 100%/);
    expect(text).toMatch(/start and after the hold/);
    expect(text).toMatch(/Overall result/);
  });

  it("PASS needs the visual and release checks confirmed; FAIL does not", () => {
    expect(getHookTesterBlockers(completedReport({ visualConfirmed: false })).join()).toMatch(/PASS needs/);
    expect(getHookTesterBlockers(completedReport({ releaseConfirmed: false })).join()).toMatch(/PASS needs/);
    expect(getHookTesterBlockers(completedReport({ visualConfirmed: false, result: "fail" }))).toEqual([]);
  });

  it("one missing stage reading names that stage", () => {
    const r = completedReport({ gaugeReadings: { "25": "55", "50": "110", "100": "220" } });
    expect(getHookTesterBlockers(r).join()).toMatch(/missing for 75%/);
  });
});

describe("the certificate's Load test: Hook tester option", () => {
  function certWithChecksDone(): HookReinstallData {
    const d = freshHookReinstallState();
    d.craftType = "rescue";
    d.removedFor = ["servicing"];
    d.checks = Object.fromEntries(HOOK_ALL_CHECKS.map((c) => [c.key, "yes"])) as HookReinstallData["checks"];
    d.outcome = "satisfactory";
    return d;
  }

  it("is offered alongside the other ways of applying the load", () => {
    expect(HOOK_LOAD_METHODS.map((m) => m.key)).toContain(HOOK_TESTER_KEY);
    expect(HOOK_LOAD_METHODS.find((m) => m.key === HOOK_TESTER_KEY)?.label).toBe("Hook tester");
  });

  it("selecting it makes the Hook Tester report part of what must be completed", () => {
    const d = certWithChecksDone();
    d.loadTest.craftMass = "5000"; d.loadTest.personsCount = "20"; d.loadTest.personMass = "75";
    expect(getHookBlockers(d)).toEqual([]); // mass figures alone are enough without the tester
    d.loadTest.loadMethods = [HOOK_TESTER_KEY];
    const problems = getHookBlockers(d).join(" | ");
    expect(problems).toMatch(/Hook Tester: gauge reading missing/);
    d.hookTester = completedReport();
    expect(getHookBlockers(d)).toEqual([]);
  });

  it("with the hook tester, the mass figures are not required for the on-load release at test load", () => {
    const d = certWithChecksDone(); // loadOnLoadRelease = yes, no mass data at all
    expect(getHookBlockers(d).join()).toMatch(/Load Test: craft mass/);
    d.loadTest.loadMethods = [HOOK_TESTER_KEY];
    d.hookTester = completedReport();
    expect(getHookBlockers(d)).toEqual([]);
  });

  it("an older certificate with no hookTester object is treated as an unstarted report", () => {
    const d = certWithChecksDone();
    d.loadTest.loadMethods = [HOOK_TESTER_KEY];
    delete d.hookTester;
    expect(getHookBlockers(d).join()).toMatch(/Hook Tester report has not been started/);
  });
});

describe("the revised certificate template", () => {
  it("has no Craft & Launching Appliance section: groups A, B, C", () => {
    expect(HOOK_CHECK_GROUPS.map((g) => g.title)).toEqual(["A. Records and Preparation", "B. Release Gear Examination", "C. Operational Tests"]);
    expect(HOOK_ALL_CHECKS.map((c) => c.key)).not.toContain("winchBrake");
  });

  it("adds the swivel row and has no Qty / Next Due, Class-Flag or Last-Service fields", () => {
    expect(HOOK_COMPONENT_ROWS.map((c) => c.key)).toContain("swivel");
    const d = freshHookReinstallState();
    expect(d.components.every((c) => c.qty === undefined && c.nextDue === undefined)).toBe(true);
    expect(d.dateOfLastService).toBeUndefined();
    expect(d.classFlag).toBeUndefined();
  });
});
