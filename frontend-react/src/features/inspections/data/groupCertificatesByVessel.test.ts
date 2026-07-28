import { describe, expect, it } from "vitest";
import { groupCertificatesByVessel } from "./groupCertificatesByVessel";
import { InspectionCertificate } from "../types/inspection.types";

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

  it("sub-groups a vessel's certificates by the year of date_of_servicing, newest year first", () => {
    const certs = {
      y2024: cert({ certNo: "y2024", vesselName: "MV Long Server", imoNo: "1", dateOfServicing: "2024-03-01" }),
      y2026a: cert({ certNo: "y2026a", vesselName: "MV Long Server", imoNo: "1", dateOfServicing: "2026-01-01" }),
      y2026b: cert({ certNo: "y2026b", vesselName: "MV Long Server", imoNo: "1", dateOfServicing: "2026-06-01" }),
      y2025: cert({ certNo: "y2025", vesselName: "MV Long Server", imoNo: "1", dateOfServicing: "2025-05-01" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    expect(groups).toHaveLength(1);
    const byYear = groups[0].certsByYear;
    expect(byYear.map((g) => g.year)).toEqual(["2026", "2025", "2024"]);
    expect(byYear[0].certs.map((c) => c.certNo).sort()).toEqual(["y2026a", "y2026b"]);
    expect(byYear[1].certs).toHaveLength(1);
    expect(byYear[2].certs).toHaveLength(1);
  });

  it("falls into an 'Unknown' year group, sorted last, when date_of_servicing is missing", () => {
    const certs = {
      dated: cert({ certNo: "dated", vesselName: "MV Test", imoNo: "1", dateOfServicing: "2026-01-01" }),
      undated: cert({ certNo: "undated", vesselName: "MV Test", imoNo: "1", dateOfServicing: "" }),
    };

    const groups = groupCertificatesByVessel(certs, "");

    const byYear = groups[0].certsByYear;
    expect(byYear.map((g) => g.year)).toEqual(["2026", "Unknown"]);
    expect(byYear[1].certs[0].certNo).toBe("undated");
  });
});
