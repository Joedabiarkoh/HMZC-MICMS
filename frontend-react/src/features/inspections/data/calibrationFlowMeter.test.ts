import { describe, expect, it } from "vitest";
import { CALIBRATION_CERT_TYPES, deriveFlowMeterRow, findCalibrationConfig, getCalibrationConfig, groupTechnicalFields } from "./calibrationCertTypes";
import { freshCalibrationState } from "./inspectionHelpers";

describe("flow meter calibration sub-type", () => {
  it("is registered with the source certificate's sections and a 3-row result table", () => {
    const cfg = findCalibrationConfig("flow_meter")!;
    expect(cfg).toBeDefined();
    expect(groupTechnicalFields(cfg.technicalFields).map((b) => b.title)).toEqual([
      "Item Description & Identification",
      "Environmental Conditions",
      "Standard Equipment Used",
      "Acceptance Criteria",
    ]);
    const state = freshCalibrationState("flow_meter");
    expect(state.items2).toHaveLength(3);
    expect(Object.keys(state.items2[0])).toEqual(["reference", "reading", "errorGpm", "errorPct", "result"]);
  });

  it("prints the corrected method note (source had 'Reading were' / 'access')", () => {
    const note = getCalibrationConfig("flow_meter").certNote!;
    expect(note).toContain("ISO 20456:2017");
    expect(note).toContain("ISO 12242:2012");
    expect(note).toContain("Readings were compared");
    expect(note).toContain("to assess the agreement");
  });
});

describe("deriveFlowMeterRow", () => {
  const row = (o: Record<string, string>) => ({ reference: "", reading: "", errorGpm: "", errorPct: "", result: "", ...o });

  it("error = reading − reference, with % against the reference", () => {
    expect(deriveFlowMeterRow(row({ reference: "100", reading: "102" }), "reading")).toMatchObject({ errorGpm: "+2.00", errorPct: "+2.00%" });
    expect(deriveFlowMeterRow(row({ reference: "200", reading: "196" }), "reference")).toMatchObject({ errorGpm: "-4.00", errorPct: "-2.00%" });
    expect(deriveFlowMeterRow(row({ reference: "50", reading: "50" }), "reading")).toMatchObject({ errorGpm: "0.00", errorPct: "0.00%" });
  });

  it("clears the derived cells while either input is missing or not a number", () => {
    const stale = row({ reference: "100", reading: "", errorGpm: "+2.00", errorPct: "+2.00%" });
    expect(deriveFlowMeterRow(stale, "reading")).toMatchObject({ errorGpm: "", errorPct: "" });
    expect(deriveFlowMeterRow(row({ reference: "abc", reading: "5" }), "reference")).toMatchObject({ errorGpm: "", errorPct: "" });
  });

  it("avoids dividing by a zero reference", () => {
    expect(deriveFlowMeterRow(row({ reference: "0", reading: "3" }), "reading")).toMatchObject({ errorGpm: "+3.00", errorPct: "" });
  });

  it("leaves a hand-typed error alone when an unrelated cell is edited", () => {
    const manual = row({ reference: "100", reading: "102", errorGpm: "1.9", result: "Pass" });
    expect(deriveFlowMeterRow(manual, "result")).toBe(manual);
  });
});

describe("groupTechnicalFields", () => {
  it("every other sub-type keeps one untitled block (printed as 'Calibration Reference')", () => {
    for (const t of CALIBRATION_CERT_TYPES.filter((t) => t.id !== "flow_meter" && t.technicalFields.length)) {
      const blocks = groupTechnicalFields(t.technicalFields);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].title).toBeUndefined();
    }
  });
});
