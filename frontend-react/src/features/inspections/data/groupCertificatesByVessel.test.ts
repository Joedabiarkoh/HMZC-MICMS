import { describe, expect, it } from "vitest";
import { groupCertificatesByVessel, reportTypeLabel } from "./groupCertificatesByVessel";
import { InspectionCertificate, LooseGearData } from "../types/inspection.types";
import { freshLooseGearState, freshFFEState, freshCalibrationState } from "./inspectionHelpers";

function cert(overrides: Partial<InspectionCertificate> & { certNo: string }): InspectionCertificate {
  return {
    type: "lifeboat",
    status: "draft",
    dateOfServicing: "2026-01-01",
    lastServicing: "",
    portServicing: "",
    kindOfServicing: "Annual",
    vesselName: "",
    imoNo: "",
    flag: "",
    location: "",
    jobRef: "",
    remarks: "",
    remarksAuto: true,
    outstanding: {},
    photos: {},
    captainName: "",
    engineerName: "",
    captainSig: "",
    engineerSig: "",
    fitForPurpose: "",
    savedAt: null,
    savedBy: "Test User",
    ...overrides,
  };
}

describe("groupCertificatesByVessel", () => {
  it("groups multiple certificates for the same vessel under one entry", () => {
    const certs = {
      "CERT-1": cert({ certNo: "CERT-1", vesselName: "MV Test Voyager", imoNo: "9074729" }),
      "CERT-2": cert({ certNo: "CERT-2", vesselName: "MV Test Voyager", imoNo: "9074729" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups).toHaveLength(1);
    expect(groups[0].certs).toHaveLength(2);
    expect(groups[0].vesselName).toBe("MV Test Voyager");
  });

  it("keeps different vessels in separate groups", () => {
    const certs = {
      "CERT-1": cert({ certNo: "CERT-1", vesselName: "MV Alpha", imoNo: "1111111" }),
      "CERT-2": cert({ certNo: "CERT-2", vesselName: "MV Beta", imoNo: "2222222" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups).toHaveLength(2);
  });

  it("falls into a single '(vessel not recorded)' group for certs with no name or IMO, instead of being dropped", () => {
    const certs = {
      "CERT-1": cert({ certNo: "CERT-1", vesselName: "", imoNo: "" }),
      "CERT-2": cert({ certNo: "CERT-2", vesselName: "", imoNo: "" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("__unrecorded__");
    expect(groups[0].certs).toHaveLength(2);
  });

  it("filters by vessel name, case-insensitively", () => {
    const certs = {
      "CERT-1": cert({ certNo: "CERT-1", vesselName: "MV Ocean Star", imoNo: "9811000" }),
      "CERT-2": cert({ certNo: "CERT-2", vesselName: "MV Different Ship", imoNo: "1234567" }),
    };

    const groups = groupCertificatesByVessel(certs, "ocean");

    expect(groups).toHaveLength(1);
    expect(groups[0].vesselName).toBe("MV Ocean Star");
  });

  it("filters by certificate number too, not just vessel identity", () => {
    const certs = {
      "CERT/HMZCS/LB/001": cert({ certNo: "CERT/HMZCS/LB/001", vesselName: "MV Alpha", imoNo: "1111111" }),
      "CERT/HMZCS/FF/002": cert({ certNo: "CERT/HMZCS/FF/002", vesselName: "MV Beta", imoNo: "2222222" }),
    };

    const groups = groupCertificatesByVessel(certs, "LB/001");

    expect(groups).toHaveLength(1);
    expect(groups[0].vesselName).toBe("MV Alpha");
  });

  it("sorts certificates within a group newest-first", () => {
    const certs = {
      older: cert({ certNo: "older", vesselName: "MV Test", imoNo: "1", issuedAt: "2026-01-01T00:00:00Z" }),
      newer: cert({ certNo: "newer", vesselName: "MV Test", imoNo: "1", issuedAt: "2026-06-01T00:00:00Z" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups[0].certs[0].certNo).toBe("newer");
    expect(groups[0].certs[1].certNo).toBe("older");
  });

  it("sorts vessel groups by their most recent certificate, newest-first", () => {
    const certs = {
      a: cert({ certNo: "a", vesselName: "MV Old Activity", imoNo: "1", issuedAt: "2026-01-01T00:00:00Z" }),
      b: cert({ certNo: "b", vesselName: "MV Recent Activity", imoNo: "2", issuedAt: "2026-06-01T00:00:00Z" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups[0].vesselName).toBe("MV Recent Activity");
    expect(groups[1].vesselName).toBe("MV Old Activity");
  });

  it("returns an empty array for an empty certificate set", () => {
    expect(groupCertificatesByVessel({}, "")).toEqual([]);
  });

  it("groups a vessel's certificates by Job No first", () => {
    const certs = {
      a1: cert({ certNo: "a1", vesselName: "MV Long Server", imoNo: "1", jobRef: "JOB-A" }),
      a2: cert({ certNo: "a2", vesselName: "MV Long Server", imoNo: "1", jobRef: "JOB-A" }),
      b1: cert({ certNo: "b1", vesselName: "MV Long Server", imoNo: "1", jobRef: "JOB-B" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups).toHaveLength(1);
    const byJob = groups[0].certsByJob;
    expect(byJob).toHaveLength(2);
    const jobA = byJob.find((j) => j.jobNo === "JOB-A")!;
    expect(jobA.certs.map((c) => c.certNo).sort()).toEqual(["a1", "a2"]);
  });

  it("falls into a '(no job)' bucket for legacy certificates with no jobRef", () => {
    const certs = {
      old1: cert({ certNo: "old1", vesselName: "MV Test", imoNo: "1", jobRef: "" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups[0].certsByJob[0].jobNo).toBe("(no job)");
  });

  it("further groups a single Job's certificates by report type — spanning multiple equipment types", () => {
    const certs = {
      lb1: cert({ certNo: "lb1", vesselName: "MV Long Server", imoNo: "1", jobRef: "JOB-A", type: "lifeboat" }),
      ff1: cert({ certNo: "ff1", vesselName: "MV Long Server", imoNo: "1", jobRef: "JOB-A", type: "firefighting" }),
      lb2: cert({ certNo: "lb2", vesselName: "MV Long Server", imoNo: "1", jobRef: "JOB-A", type: "lifeboat" }),
    };

    const groups = groupCertificatesByVessel(certs, "");
    const job = groups[0].certsByJob[0];

    expect(job.certsByType).toHaveLength(2);
    const lifeboatGroup = job.certsByType.find((g) => g.certs[0].type === "lifeboat")!;
    expect(lifeboatGroup.certs.map((c) => c.certNo).sort()).toEqual(["lb1", "lb2"]);
  });

  it("splits Loose Gear's report sub-types into their own type groups within a job", () => {
    const standard = freshLooseGearState("standard_report");
    const multiple = freshLooseGearState("multiple_items");
    const certs = {
      s1: cert({ certNo: "s1", vesselName: "MV Long Server", imoNo: "1", jobRef: "JOB-A", type: "loosegear", looseGear: standard }),
      m1: cert({ certNo: "m1", vesselName: "MV Long Server", imoNo: "1", jobRef: "JOB-A", type: "loosegear", looseGear: multiple }),
    };

    const groups = groupCertificatesByVessel(certs, "");
    const job = groups[0].certsByJob[0];

    expect(job.certsByType).toHaveLength(2);
    expect(job.certsByType.map((g) => g.label).sort()).toEqual([
      "Loose Gear & Lifting Equipment — Report of Thorough Examination",
      "Loose Gear & Lifting Equipment — Report of Thorough Examination (Multiple Items)",
    ]);
  });
});

describe("reportTypeLabel", () => {
  it("returns the plain type name for a type with no sub-type concept", () => {
    const c = cert({ certNo: "c1", type: "lifeboat" });
    expect(reportTypeLabel(c)).toBe("Conventional Lifeboat");
  });

  it("appends the sub-type label for Loose Gear certificates", () => {
    const lg: LooseGearData = freshLooseGearState("standard_report");
    const c = cert({ certNo: "c1", type: "loosegear", looseGear: lg });
    expect(reportTypeLabel(c)).toBe("Loose Gear & Lifting Equipment — Report of Thorough Examination");
  });

  it("appends the sub-type label for a Loose Gear NDT report type added after the original 3-entry label list", () => {
    const lg: LooseGearData = freshLooseGearState("mpi");
    const c = cert({ certNo: "c1", type: "loosegear", looseGear: lg });
    expect(reportTypeLabel(c)).toBe("Loose Gear & Lifting Equipment — Magnetic Particle Testing (MPI)");
  });

  it("appends the specific FFE sub-type name instead of just 'Firefighting Equipment'", () => {
    const ffe = freshFFEState("chemical_suit");
    const c = cert({ certNo: "c1", type: "firefighting", ffe });
    expect(reportTypeLabel(c)).toBe("Firefighting Equipment — Chemical Suit");
  });

  it("uses the selected system-type variant's own name for FFE certificates that have one", () => {
    const ffe = { ...freshFFEState("co2_system"), variant: "paint_locker" };
    const c = cert({ certNo: "c1", type: "firefighting", ffe });
    expect(reportTypeLabel(c)).toBe("Firefighting Equipment — Fixed CO2 System — Paint Locker");
  });

  it("appends the specific Calibration sub-type name", () => {
    const calibration = freshCalibrationState("multigas_detector");
    const c = cert({ certNo: "c1", type: "calibration", calibration });
    expect(reportTypeLabel(c)).toBe("Calibration — Personal Multi-Gas Detector");
  });
});
