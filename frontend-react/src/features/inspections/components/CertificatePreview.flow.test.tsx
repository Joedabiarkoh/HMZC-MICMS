import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import CertificatePreview from "./CertificatePreview";
import { INSPECTION_TYPES } from "../data/inspectionChecklists";
import { freshCertificate } from "../data/inspectionHelpers";
import { EquipmentTypeKey } from "../types/inspection.types";

// Regression guard for the printed-certificate "empty spaces" defect: each
// section used to be its own page frame (forced page break + padded to a
// whole page), which produced blank trailing pages, sign-offs alone on a
// page and near-empty sections. A certificate must now be ONE continuous
// flow: a single page frame (one repeating letterhead, one pinned footer)
// with every section a plain block inside it.
function renderCert(type: EquipmentTypeKey) {
  const cert = freshCertificate(type, new Set());
  cert.vesselName = "MV TEST";
  return render(<CertificatePreview cert={cert} config={INSPECTION_TYPES[type]} />).container;
}

describe("a certificate prints as one continuous flow", () => {
  it.each<EquipmentTypeKey>(["rescueboat", "lifeboat", "crane", "hook_reinstall", "frc_service", "calibration", "firefighting", "gangway_load_test"])(
    "%s: one page frame, one letterhead, one repeating footer",
    (type) => {
      const root = renderCert(type);
      expect(root.querySelectorAll(".insp-cert-page")).toHaveLength(1);
      expect(root.querySelectorAll("table.insp-page-frame")).toHaveLength(1);
      expect(root.querySelectorAll(".insp-letterhead")).toHaveLength(1);
      // The footer is the table's <tfoot> (repeats natively on every printed
      // page) — not position: fixed, which real prints showed is unreliable.
      expect(root.querySelectorAll("table.insp-page-frame > tfoot")).toHaveLength(1);
      expect(root.querySelectorAll("table.insp-page-frame > tfoot img").length).toBeGreaterThanOrEqual(7);
      expect(root.querySelectorAll(".insp-flow-section").length).toBeGreaterThanOrEqual(1);
    }
  );

  it("a multi-section boat certificate keeps every section inside that single frame", () => {
    const root = renderCert("rescueboat");
    // statement, boat checklist, davit checklist, equipment list, notes, (photos)
    expect(root.querySelectorAll(".insp-flow-section").length).toBeGreaterThanOrEqual(5);
    const frame = root.querySelector("table.insp-page-frame")!;
    root.querySelectorAll(".insp-flow-section").forEach((s) => expect(frame.contains(s)).toBe(true));
  });

  // Reviewing a real print of the flowing layout: a full signature + stamp
  // block after every one of four sections printed the same declaration
  // four times mid-page. The Statement is signed, then ONE sign-off closes
  // the checklist run — never one per section.
  it.each<EquipmentTypeKey>(["rescueboat", "lifeboat", "crane"])("%s: signed Statement plus a single closing sign-off, not one per section", (type) => {
    const root = renderCert(type);
    const signOffs = (root.textContent || "").match(/Service Engineer/g) || [];
    expect(signOffs).toHaveLength(2);
  });

  it("the hook certificate's two template pages are sections of one flow, not two pages", () => {
    const root = renderCert("hook_reinstall");
    expect(root.querySelectorAll(".insp-flow-section")).toHaveLength(2);
    expect(root.textContent).toContain("Hook Re-installation Certificate");
    expect(root.textContent).toContain("Inspection & Test Check Sheet");
  });

  it("no position: fixed footer is used", () => {
    const root = renderCert("hook_reinstall");
    expect(root.querySelector(".insp-footer-pin")).toBeNull();
    expect(root.querySelector(".insp-footer-spacer")).toBeNull();
  });
});
