import { describe, expect, it } from "vitest";
import { groupCertificatesByVessel, reportTypeLabel } from "./groupCertificatesByVessel";
import { InspectionCertificate, LooseGearData } from "../types/inspection.types";
import { freshLooseGearState } from "./inspectionHelpers";

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
    remarks: "",
    remarksAuto: true,
    outstanding: {},
    photos: {},
    captainName: "",
    engineerName: "",
    captainSig: "",
    engineerSig: "",
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

  it("sub-groups a vessel's certificates by report type", () => {
    const certs = {
      lb1: cert({ certNo: "lb1", vesselName: "MV Long Server", imoNo: "1", type: "lifeboat" }),
      ff1: cert({ certNo: "ff1", vesselName: "MV Long Server", imoNo: "1", type: "firefighting" }),
      lb2: cert({ certNo: "lb2", vesselName: "MV Long Server", imoNo: "1", type: "lifeboat" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups).toHaveLength(1);
    const byType = groups[0].certsByType;
    expect(byType).toHaveLength(2);
    const lifeboatGroup = byType.find((g) => g.certs[0].type === "lifeboat")!;
    expect(lifeboatGroup.certs.map((c) => c.certNo).sort()).toEqual(["lb1", "lb2"]);
  });

  it("splits Loose Gear's report sub-types into their own groups", () => {
    const standard = freshLooseGearState("standard_report");
    const multiple = freshLooseGearState("multiple_items");
    const certs = {
      s1: cert({ certNo: "s1", vesselName: "MV Long Server", imoNo: "1", type: "loosegear", looseGear: standard }),
      m1: cert({ certNo: "m1", vesselName: "MV Long Server", imoNo: "1", type: "loosegear", looseGear: multiple }),
    };

    const groups = groupCertificatesByVessel(certs, "");
    const byType = groups[0].certsByType;

    expect(byType).toHaveLength(2);
    expect(byType.map((g) => g.label).sort()).toEqual([
      "Loose Gear & Lifting Equipment — Report of Thorough Examination",
      "Loose Gear & Lifting Equipment — Report of Thorough Examination (Multiple Items)",
    ]);
  });

  it("groups a Loose Gear Standard Report type group further by Job No", () => {
    const jobA = freshLooseGearState("standard_report");
    jobA.jobRef = "LG-JOB-A";
    const jobB = freshLooseGearState("standard_report");
    jobB.jobRef = "LG-JOB-B";
    const certs = {
      a1: cert({ certNo: "a1", vesselName: "MV Long Server", imoNo: "1", type: "loosegear", looseGear: jobA }),
      a2: cert({ certNo: "a2", vesselName: "MV Long Server", imoNo: "1", type: "loosegear", looseGear: jobA }),
      b1: cert({ certNo: "b1", vesselName: "MV Long Server", imoNo: "1", type: "loosegear", looseGear: jobB }),
    };

    const groups = groupCertificatesByVessel(certs, "");
    const typeGroup = groups[0].certsByType[0];

    expect(typeGroup.jobGroups).toBeDefined();
    const byJob = typeGroup.jobGroups!;
    expect(byJob).toHaveLength(2);
    const jobAGroup = byJob.find((j) => j.jobNo === "LG-JOB-A")!;
    expect(jobAGroup.certs.map((c) => c.certNo).sort()).toEqual(["a1", "a2"]);
  });

  it("groups a Loose Gear Multiple Items type group by Job No too", () => {
    const job = freshLooseGearState("multiple_items");
    job.jobRef = "LG-JOB-C";
    const certs = {
      m1: cert({ certNo: "m1", vesselName: "MV Long Server", imoNo: "1", type: "loosegear", looseGear: job }),
    };

    const groups = groupCertificatesByVessel(certs, "");
    const typeGroup = groups[0].certsByType[0];

    expect(typeGroup.jobGroups).toBeDefined();
    expect(typeGroup.jobGroups![0].jobNo).toBe("LG-JOB-C");
  });

  it("does not attach jobGroups to non-Loose-Gear type groups", () => {
    const certs = {
      lb1: cert({ certNo: "lb1", vesselName: "MV Test", imoNo: "1", type: "lifeboat" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups[0].certsByType[0].jobGroups).toBeUndefined();
  });
});

describe("reportTypeLabel", () => {
  it("returns the plain type name for non-Loose-Gear certificates", () => {
    const c = cert({ certNo: "c1", type: "firefighting" });
    expect(reportTypeLabel(c)).toBe("Firefighting Equipment");
  });

  it("appends the sub-type label for Loose Gear certificates", () => {
    const lg: LooseGearData = freshLooseGearState("standard_report");
    const c = cert({ certNo: "c1", type: "loosegear", looseGear: lg });
    expect(reportTypeLabel(c)).toBe("Loose Gear & Lifting Equipment — Report of Thorough Examination");
  });
});
