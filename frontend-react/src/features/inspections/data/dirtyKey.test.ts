import { describe, expect, it } from "vitest";
import { dirtyKey } from "./dirtyKey";
import { InspectionCertificate } from "../types/inspection.types";

// Pins down the exact bug fixed in InspectionWorkspace.tsx: the 20-second
// auto-save interval compares dirtyKey(current) against a snapshot from
// the last save to decide whether there's anything new to save. version/
// issuedBy/issuedAt land on `current` asynchronously, strictly after that
// snapshot was taken (see saveCurrent's .then() in useInspections.ts) —
// if dirtyKey ever started including them again, every save would look
// "dirty" again on the very next tick from the server's own response
// arriving, with zero real user edits, and the interval (which hardcodes
// status: "draft") would silently revert a just-finalized certificate
// back to draft. Confirmed as a real, observed bug at the time, not a
// hypothetical — see the file's own comment for how it was caught.

function baseCert(overrides: Partial<InspectionCertificate> = {}): InspectionCertificate {
  return {
    certNo: "CERT/HMZCS/LB/20260101-001",
    type: "lifeboat",
    status: "draft",
    dateOfServicing: "2026-01-01",
    lastServicing: "",
    portServicing: "",
    kindOfServicing: "Annual",
    vesselName: "MV Test",
    imoNo: "1234567",
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

describe("dirtyKey", () => {
  it("produces the same key for two certificates that differ only in version/issuedBy/issuedAt", () => {
    const beforeSave = baseCert();
    const afterServerMerge = baseCert({ version: 5, issuedBy: "Someone Else", issuedAt: "2026-01-01T00:00:00Z" });

    expect(dirtyKey(afterServerMerge)).toBe(dirtyKey(beforeSave));
  });

  it("produces a different key when an actual user-facing field changes", () => {
    const original = baseCert();
    const edited = baseCert({ vesselName: "MV Different Ship" });

    expect(dirtyKey(edited)).not.toBe(dirtyKey(original));
  });

  it("produces a different key when status changes (draft vs final)", () => {
    const draft = baseCert({ status: "draft" });
    const final = baseCert({ status: "final" });

    expect(dirtyKey(final)).not.toBe(dirtyKey(draft));
  });

  it("is stable across repeated calls with an identical certificate", () => {
    const cert = baseCert();
    expect(dirtyKey(cert)).toBe(dirtyKey(cert));
  });
});
