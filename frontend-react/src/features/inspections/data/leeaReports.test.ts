import { describe, expect, it } from "vitest";
import {
  buildLeeaReportView,
  defectRowsFromRegister,
  defectSheetAttached,
  examinationTypeFromReason,
  freshDefectDataFromRegister,
  leeaExamFlags,
  reasonCode,
  rowNeedsDefectEntry,
  rowReason,
} from "./leeaReports";
import { freshLooseGearMultipleItemsData, freshLooseGearRegisterRow, freshLooseGearState, freshLooseGearStandardReportData, LOOSE_GEAR_SUB_TYPES, MULTIPLE_ITEMS_REGISTER_COLUMNS } from "./inspectionHelpers";
import type { LooseGearRegisterRow } from "../types/inspection.types";

const row = (over: Partial<LooseGearRegisterRow>): LooseGearRegisterRow => ({ ...freshLooseGearRegisterRow(), ...over });

describe("LEEA examination tick boxes", () => {
  it("one Examination Type drives all five YES/NO pairs", () => {
    expect(leeaExamFlags("initial")).toEqual({ firstExam: "yes", within6Months: "no", within12Months: "no", underScheme: "no", exceptional: "no" });
    expect(leeaExamFlags("6monthly")).toMatchObject({ firstExam: "no", within6Months: "yes", within12Months: "no" });
    expect(leeaExamFlags("12monthly")).toMatchObject({ within6Months: "no", within12Months: "yes" });
    expect(leeaExamFlags("under_scheme")).toMatchObject({ underScheme: "yes", within12Months: "no" });
    expect(leeaExamFlags("exceptional")).toMatchObject({ exceptional: "yes", underScheme: "no" });
  });

  it("an unanswered type leaves every box blank, and an older 'standard' report leaves the intervals blank", () => {
    expect(Object.values(leeaExamFlags(""))).toEqual(["", "", "", "", ""]);
    expect(leeaExamFlags("standard")).toMatchObject({ within6Months: "", within12Months: "", underScheme: "no", exceptional: "no" });
  });

  it("a register's Reason for Examination maps onto the single report's examination type", () => {
    expect(examinationTypeFromReason("installation")).toBe("initial");
    expect(examinationTypeFromReason("6monthly")).toBe("6monthly");
    expect(examinationTypeFromReason("12monthly")).toBe("12monthly");
    expect(examinationTypeFromReason("written_scheme")).toBe("under_scheme");
    expect(examinationTypeFromReason("exceptional")).toBe("exceptional");
    expect(examinationTypeFromReason("")).toBe("");
  });
});

describe("LEEA-030.1a4 report view", () => {
  const ctx = { vesselName: "MV TEST", engineerName: "A. Examiner" };

  it("fills the 'If none state NONE' boxes and folds the extra identification into one box", () => {
    const d = { ...freshLooseGearStandardReportData(), description: "Shackle", idNo: "SH-1", serialNos: ["A1", "A2"], manufacturer: "Crosby", mbl: "7t", factorOfSafety: "6:1", swl: "1t" };
    const v = buildLeeaReportView(d, ctx);
    expect(v.defect).toBe("NONE");
    expect(v.repair).toBe("NONE");
    expect(v.tests).toBe("NONE");
    expect(v.identification).toEqual(["Shackle", "Identification No: SH-1", "Serial No(s): A1, A2", "Manufacturer: Crosby", "MBL: 7t   Factor of Safety: 6:1"]);
    expect(v.premises).toEqual(["Vessel: MV TEST"]);
    expect(v.reporterNameQualifications).toEqual(["A. Examiner"]);
    expect(v.authenticatorName).toBe("A. Examiner");
  });

  it("keeps a defect, its due date and an older 'under observation' note", () => {
    const d = { ...freshLooseGearStandardReportData(), defectsImmediate: "Cracked pin", defectsObservation: "Wear on eye", defectDangerByDate: "2026-12-01", repairParticulars: "Replace pin" };
    const v = buildLeeaReportView(d, ctx);
    expect(v.defect).toBe("Cracked pin\nUnder observation: Wear on eye");
    expect(v.dangerByDate).toBe("2026-12-01");
    expect(v.repair).toBe("Replace pin");
  });

  it("installed-correctly only applies to a first examination", () => {
    const base = { ...freshLooseGearStandardReportData(), installedCorrectly: "yes" as const };
    expect(buildLeeaReportView({ ...base, examinationType: "initial" }, ctx).installedCorrectly).toBe("yes");
    expect(buildLeeaReportView({ ...base, examinationType: "12monthly" }, ctx).installedCorrectly).toBe("");
  });

  it("reads reports saved before the LEEA fields existed", () => {
    const old = freshLooseGearStandardReportData() as unknown as Record<string, unknown>;
    for (const k of ["defectDangerByDate", "repairParticulars", "reportedByQualifications", "authenticatedByName", "reporterEmployer"]) delete old[k];
    const v = buildLeeaReportView(old as unknown as ReturnType<typeof freshLooseGearStandardReportData>, ctx);
    expect(v.repair).toBe("NONE");
    expect(v.reporterEmployer).toBe("");
    expect(v.dangerByDate).toBe("");
  });
});

describe("LEEA sub-types", () => {
  it("offers all four forms, and the unsafe report starts as 'not safe'", () => {
    const ids = LOOSE_GEAR_SUB_TYPES.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["standard_report", "unsafe_report", "multiple_items", "defect_report"]));
    const unsafe = freshLooseGearState("unsafe_report");
    expect(unsafe.standardReport?.safeForUse).toBe("no");
    expect(freshLooseGearState("standard_report").standardReport?.safeForUse).toBe("");
  });

  it("the register entry grid follows the LEEA-030.1c4 columns, in order", () => {
    expect(MULTIPLE_ITEMS_REGISTER_COLUMNS.slice(0, 10).map((c) => c.key)).toEqual([
      "serialNo", "description", "swl", "lastExamDate", "mfgDate", "nextInspectionDate", "reason", "testDetails", "result", "safeToUse",
    ]);
  });
});

describe("register -> individual reports and defect list", () => {
  it("a row's own reason wins over the register-wide one", () => {
    const reg = { ...freshLooseGearMultipleItemsData(), reasonForInspection: "12monthly" as const };
    expect(rowReason(row({}), reg)).toBe("12monthly");
    expect(rowReason(row({ reason: "installation" }), reg)).toBe("installation");
    expect(reasonCode("written_scheme")).toBe("D");
    expect(reasonCode(undefined)).toBe("");
  });

  it("SDR/OBS and not-safe rows feed the defect list; blank rows never do", () => {
    const rows = [
      row({ serialNo: "1", description: "Sling", result: "ND", safeToUse: "yes" }),
      row({ serialNo: "2", description: "Shackle", result: "SDR", safeToUse: "yes" }),
      row({ serialNo: "3", description: "Hook", result: "NF", safeToUse: "no" }),
      row({ serialNo: "4", description: "Chain", result: "OBS", safeToUse: "yes" }),
      row({ result: "SDR" }), // blank row
    ];
    expect(rows.map(rowNeedsDefectEntry)).toEqual([false, true, true, true, true]);
    const defects = defectRowsFromRegister(rows);
    expect(defects.map((d) => d.equipmentIdNo)).toEqual(["2", "3", "4"]);
    expect(defects[0]).toMatchObject({ equipmentDescription: "Shackle", defectiveParts: "", immediateDanger: "" });
    // the form's "Defect / Observation sheet attached?" box: only SDR/OBS refer to a sheet
    expect(defectSheetAttached(rows)).toBe(true);
    expect(defectSheetAttached([rows[0], rows[2]])).toBe(false);
  });

  it("the defect list refers back to the register's report number", () => {
    const data = freshDefectDataFromRegister("CERT/HMZC/LG/20261125-001", [row({ serialNo: "9", description: "Eye bolt", result: "SDR" })]);
    expect(data.referencedReportNo).toBe("CERT/HMZC/LG/20261125-001");
    expect(data.defects).toHaveLength(1);
  });
});
