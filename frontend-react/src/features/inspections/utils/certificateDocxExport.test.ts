// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// jszip is docx's own (hard) dependency — used here only to open the
// generated .docx and read its XML back, not shipped in the app.
import JSZip from "jszip";
import { exportCertificateDocx } from "./certificateDocxExport";
import { INSPECTION_TYPES } from "../data/inspectionChecklists";
import { freshCalibrationState, freshCertificate } from "../data/inspectionHelpers";
import { HOOK_ALL_CHECKS } from "../data/hookReinstall";

// exportCertificateDocx hands the generated file to the browser via an
// <a download> click. Capture the Blob it creates instead, then unzip it
// and return word/document.xml's visible text, so the Word copy of each
// certificate can be asserted against directly.
let captured: Blob | null = null;

beforeEach(() => {
  captured = null;
  vi.stubGlobal("document", {
    createElement: () => ({ click: () => {}, set href(_v: string) {}, set download(_v: string) {} }),
    body: { appendChild: () => {}, removeChild: () => {} },
  });
  vi.stubGlobal("URL", { createObjectURL: (b: Blob) => ((captured = b), "blob:test"), revokeObjectURL: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function exportedText(): Promise<string> {
  const zip = await JSZip.loadAsync(await captured!.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
}

describe("Word export — hook re-installation certificate", () => {
  it("contains both template pages, the calculated test load and ticked boxes", async () => {
    const cert = freshCertificate("hook_reinstall", new Set());
    Object.assign(cert, { vesselName: "MT TEST", imoNo: "1234567", engineerName: "A. Engineer" });
    const h = cert.hookReinstall!;
    h.craftType = "rescue";
    h.removedFor = ["servicing"];
    h.checks = Object.fromEntries(HOOK_ALL_CHECKS.map((c) => [c.key, "yes"])) as typeof h.checks;
    h.checks.hookUnits = "no";
    h.checkRemarks = { hookUnits: "Crack on pin" };
    h.loadTest = { ...h.loadTest, craftMass: "5000", personsCount: "20", personMass: "75", equipmentMass: "200" };
    h.outcome = "not_satisfactory";

    await exportCertificateDocx(cert, INSPECTION_TYPES.hook_reinstall);
    const text = await exportedText();

    expect(text).toContain("Hook Re-installation Certificate");
    expect(text).toContain(cert.certNo);
    expect(text).toContain("Inspection & Test Check Sheet");
    expect(text).toContain("A. RECORDS AND PREPARATION");
    expect(text).toContain("C. OPERATIONAL TESTS");
    expect(text).not.toContain("CRAFT AND LAUNCHING APPLIANCE"); // removed by the revised template
    expect(text).toContain("Swivel (if fitted)");
    expect(text).not.toContain("Date of Last Service");
    expect(text).not.toContain("Hook Load Test Report"); // no hook tester selected
    expect(text).toContain("Crack on pin");
    expect(text).toContain("7370"); // 1.1 × (5000 + 20×75 + 200)
    expect(text).toContain("Not satisfactory");
    expect(text).toContain("☒ Rescue Boat");
    expect(text).toContain("☐ Conventional Lifeboat");
    expect(text).toContain("Release hook, forward");
  });
});

describe("Word export — hook certificate with the hook tester", () => {
  it("adds the Hook Load Test Report, with the figures computed from its inputs", async () => {
    const cert = freshCertificate("hook_reinstall", new Set());
    Object.assign(cert, { vesselName: "MT TEST", imoNo: "1234567", engineerName: "A. Engineer" });
    const h = cert.hookReinstall!;
    h.craftType = "rescue";
    h.removedFor = ["servicing"];
    h.loadTest.loadMethods = ["hooktester"];
    h.hookTester = {
      ...h.hookTester!,
      clientVessel: "MT TEST",
      hookMakerType: "Hatecke HK-16",
      gaugeCertNo: "CAL-8891",
      gaugeReadings: { "25": "55", "50": "110", "75": "165", "100": "220" },
      pressureStart: "220",
      pressureEnd: "218",
      visualConfirmed: true,
      releaseConfirmed: true,
      result: "pass",
      witnessedBy: "Capt. Silva",
    };

    await exportCertificateDocx(cert, INSPECTION_TYPES.hook_reinstall);
    const text = await exportedText();

    expect(text).toContain("Hook Load Test Report");
    expect(text).toContain("Raptor Pro RC20T-100"); // the report's default cylinder
    expect(text).toContain("31.5 bar per tonne");
    expect(text).toContain("Test pressure = 7.00 × 31.5 = 220.5 bar");
    expect(text).toContain("242.6"); // the 2.2 × SWL reference row
    expect(text).toContain("CAL-8891");
    expect(text).toContain("Drop: 2 bar");
    expect(text).toContain("PASS");
    expect(text).toContain("Capt. Silva");
  });
});

describe("Word export — flow meter calibration certificate", () => {
  it("prints the grouped sections, the readings and the method note", async () => {
    const cert = freshCertificate("calibration", new Set());
    Object.assign(cert, { vesselName: "MT TEST", imoNo: "1234567", engineerName: "A. Engineer" });
    cert.calibration = freshCalibrationState("flow_meter");
    cert.calibration.technicalValues.instrumentName = "Ballast Pump Flow Meter";
    cert.calibration.technicalValues.standardCertNo = "UFM/2026/114";
    cert.calibration.items2 = [{ reference: "1000", reading: "1012", errorGpm: "+12.00", errorPct: "+1.20%", result: "Pass" }];

    await exportCertificateDocx(cert, INSPECTION_TYPES.calibration);
    const text = await exportedText();

    expect(text).toContain("Item Description & Identification");
    expect(text).toContain("Environmental Conditions");
    expect(text).toContain("Standard Equipment Used");
    expect(text).toContain("Ballast Pump Flow Meter");
    expect(text).toContain("UFM/2026/114");
    expect(text).toContain("+1.20%");
    // the method/traceability note now reaches the Word copy too
    expect(text).toContain("ISO 20456:2017");
  });
});
