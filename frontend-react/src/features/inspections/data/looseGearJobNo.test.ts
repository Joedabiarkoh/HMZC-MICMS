import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { suggestLooseGearJobNo } from "./looseGearJobNo";
import { InspectionCertificate, LooseGearData } from "../types/inspection.types";
import { freshLooseGearState } from "./inspectionHelpers";

function looseGearCert(
  certNo: string,
  vesselName: string,
  looseGear: LooseGearData,
  overrides: Partial<InspectionCertificate> = {}
): InspectionCertificate {
  return {
    type: "loosegear",
    status: "draft",
    dateOfServicing: "2026-08-08",
    lastServicing: "",
    portServicing: "",
    kindOfServicing: "Annual",
    vesselName,
    imoNo: "",
    flag: "",
    location: "",
    remarks: "",
    remarksAuto: true,
    outstanding: {},
    photos: {},
    captainName: "",
    engineerName: "",
    captainSig: "",
    engineerSig: "",
    savedAt: "2026-08-08T09:00:00Z",
    savedBy: "Test User",
    certNo,
    looseGear,
    ...overrides,
  };
}

describe("suggestLooseGearJobNo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string when no vessel is set yet", () => {
    expect(suggestLooseGearJobNo({}, "", "CERT-NEW")).toBe("");
  });

  it("mints a fresh job no from vessel name and today's date when no existing job matches", () => {
    const result = suggestLooseGearJobNo({}, "MV Test Voyager", "CERT-NEW");
    expect(result).toBe("LG-MVTESTVOYAGER-20260808");
  });

  it("reuses the job no of an existing standard_report for the same vessel, same day", () => {
    const lg = freshLooseGearState("standard_report");
    lg.standardReport!.jobNo = "LG-CUSTOM-001";
    const certs = {
      "CERT-1": looseGearCert("CERT-1", "MV Test Voyager", lg),
    };
    const result = suggestLooseGearJobNo(certs, "MV Test Voyager", "CERT-NEW");
    expect(result).toBe("LG-CUSTOM-001");
  });

  it("does not match a different vessel", () => {
    const lg = freshLooseGearState("standard_report");
    lg.standardReport!.jobNo = "LG-CUSTOM-001";
    const certs = {
      "CERT-1": looseGearCert("CERT-1", "MV Other Ship", lg),
    };
    const result = suggestLooseGearJobNo(certs, "MV Test Voyager", "CERT-NEW");
    expect(result).toBe("LG-MVTESTVOYAGER-20260808");
  });

  it("excludes the certificate currently being edited from the search", () => {
    const lg = freshLooseGearState("standard_report");
    lg.standardReport!.jobNo = "LG-CUSTOM-001";
    const certs = {
      "CERT-NEW": looseGearCert("CERT-NEW", "MV Test Voyager", lg),
    };
    const result = suggestLooseGearJobNo(certs, "MV Test Voyager", "CERT-NEW");
    expect(result).toBe("LG-MVTESTVOYAGER-20260808");
  });

  it("ignores multiple_items certs when looking for a job to reuse", () => {
    const lg = freshLooseGearState("multiple_items");
    const certs = {
      "CERT-1": looseGearCert("CERT-1", "MV Test Voyager", lg),
    };
    const result = suggestLooseGearJobNo(certs, "MV Test Voyager", "CERT-NEW");
    expect(result).toBe("LG-MVTESTVOYAGER-20260808");
  });
});
