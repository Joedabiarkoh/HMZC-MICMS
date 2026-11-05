import { describe, expect, it } from "vitest";
import { HOOK_ALL_CHECKS, HOOK_CHECK_GROUPS, HOOK_LOAD_CHECKS, computeHookLoad, getHookBlockers } from "./hookReinstall";
import { freshCertificate, freshHookReinstallState, generateCertNo } from "./inspectionHelpers";
import { INSPECTION_TYPES } from "./inspectionChecklists";
import { HookReinstallData } from "../types/inspection.types";

// A fully completed, valid certificate — each test below breaks exactly
// one thing, so a failure points at the rule that regressed.
function completed(overrides: Partial<HookReinstallData> = {}): HookReinstallData {
  const base = freshHookReinstallState();
  return {
    ...base,
    craftType: "conventional",
    removedFor: ["servicing"],
    checks: Object.fromEntries(HOOK_ALL_CHECKS.map((c) => [c.key, "yes"])) as HookReinstallData["checks"],
    loadTest: { ...base.loadTest, craftMass: "5000", personsCount: "20", personMass: "75", equipmentMass: "200" },
    outcome: "satisfactory",
    ...overrides,
  };
}

describe("computeHookLoad", () => {
  it("test load is 1.1 × (craft + persons × mass + equipment)", () => {
    // 5000 + 20×75 + 200 = 6700 ; ×1.1 = 7370
    expect(computeHookLoad(completed().loadTest)).toEqual({ totalMass: "6700", testLoad: "7370" });
  });

  it("treats blank equipment as zero", () => {
    const lt = { ...completed().loadTest, equipmentMass: "" };
    expect(computeHookLoad(lt)).toEqual({ totalMass: "6500", testLoad: "7150" });
  });

  it("accepts comma decimals and unit suffixes", () => {
    const lt = { ...completed().loadTest, craftMass: "1 250,5 kg", personsCount: "2", personMass: "75", equipmentMass: "0" };
    expect(computeHookLoad(lt)?.totalMass).toBe("1400.5");
  });

  it("returns null until craft mass, persons and mass per person are all numeric", () => {
    const base = completed().loadTest;
    expect(computeHookLoad({ ...base, craftMass: "" })).toBeNull();
    expect(computeHookLoad({ ...base, personsCount: "" })).toBeNull();
    expect(computeHookLoad({ ...base, personMass: "abc" })).toBeNull();
  });
});

describe("getHookBlockers", () => {
  it("a fully completed certificate has no blockers", () => {
    expect(getHookBlockers(completed())).toEqual([]);
  });

  it("a brand-new certificate is blocked on every required decision", () => {
    const problems = getHookBlockers(freshHookReinstallState()).join(" | ");
    expect(problems).toMatch(/Craft Type/);
    expect(problems).toMatch(/hooks were removed/);
    expect(problems).toMatch(/20 checks/);
    expect(problems).toMatch(/Overall Result/);
  });

  it("covers all 17 template checks plus the 3 load-test results", () => {
    expect(HOOK_CHECK_GROUPS.flatMap((g) => g.checks)).toHaveLength(17);
    expect(HOOK_LOAD_CHECKS).toHaveLength(3);
    expect(new Set(HOOK_ALL_CHECKS.map((c) => c.key)).size).toBe(20);
  });

  it("one unanswered check blocks, naming the count", () => {
    const d = completed();
    d.checks = { ...d.checks, records: "" };
    expect(getHookBlockers(d).join()).toMatch(/1 check on the Inspection/);
  });

  it("N/A counts as answered", () => {
    const d = completed();
    d.checks = { ...d.checks, freeFallRelease: "na" };
    expect(getHookBlockers(d)).toEqual([]);
  });

  it("a NO needs a remark, and a remark clears it", () => {
    const d = completed({ outcome: "not_satisfactory" });
    d.checks = { ...d.checks, hookUnits: "no" };
    expect(getHookBlockers(d).join()).toMatch(/remark is required/);
    d.checkRemarks = { hookUnits: "Crack found on forward hook pin" };
    expect(getHookBlockers(d)).toEqual([]);
  });

  it("cannot be Satisfactory while any check is NO", () => {
    const d = completed({ outcome: "satisfactory", checkRemarks: { hookUnits: "cracked" } });
    d.checks = { ...d.checks, hookUnits: "no" };
    expect(getHookBlockers(d).join()).toMatch(/cannot be Satisfactory/);
  });

  it("a YES on the load-test release needs the mass data behind the test load", () => {
    const base = completed();
    const d = completed({ loadTest: { ...base.loadTest, craftMass: "" } });
    expect(getHookBlockers(d).join()).toMatch(/Load Test: craft mass/);
    // …but N/A on the load test (no proof load performed) doesn't.
    d.checks = { ...d.checks, loadOnLoadRelease: "na" };
    expect(getHookBlockers(d)).toEqual([]);
  });
});

describe("hook_reinstall registration", () => {
  it("is a registered equipment type of its own kind", () => {
    expect(INSPECTION_TYPES.hook_reinstall.kind).toBe("hookreinstall");
  });

  it("gets a HOOK-tagged certificate number and fresh state", () => {
    expect(generateCertNo("hook_reinstall", new Set())).toMatch(/^CERT\/HMZC\/HOOK\/\d{8}-001$/);
    const cert = freshCertificate("hook_reinstall", new Set());
    expect(cert.hookReinstall?.subType).toBe("hook_reinstall");
    expect(cert.hookReinstall?.components).toHaveLength(6);
    // never pre-ticked: every check starts unanswered
    expect(Object.values(cert.hookReinstall!.checks).every((v) => v === "")).toBe(true);
  });
});
