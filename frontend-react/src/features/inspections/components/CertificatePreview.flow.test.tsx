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
    "%s: one page frame, one letterhead, one in-page footer",
    (type) => {
      const root = renderCert(type);
      expect(root.querySelectorAll(".insp-cert-page")).toHaveLength(1);
      expect(root.querySelectorAll("table.insp-page-frame")).toHaveLength(1);
      expect(root.querySelectorAll(".insp-letterhead")).toHaveLength(1);
      // One in-page approvals footer (the on-screen footer and the print
      // fallback), in the frame's repeating <tfoot>. In print it is replaced by
      // the page-margin footer (utils/printFooter.ts) where the browser
      // supports it. No position: fixed pin, which real prints showed is
      // unreliable.
      expect(root.querySelectorAll("table.insp-page-frame > tfoot .insp-footer-flow")).toHaveLength(1);
      expect(root.querySelectorAll(".insp-footer-flow img").length).toBeGreaterThanOrEqual(7);
      expect(root.querySelector(".insp-footer-pin")).toBeNull();
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

  // Each main section is its own page group and closes with its own sign-off
  // (Statement, each checklist, the equipment list) — the arrangement the
  // printed certificates are meant to have: "each top or main heading should
  // have their pages... with their header and foot for each page".
  it.each<[EquipmentTypeKey, number]>([["rescueboat", 4], ["lifeboat", 4], ["crane", 2]])(
    "%s: every section closes with its own sign-off (%i)",
    (type, expected) => {
      const root = renderCert(type);
      const signOffs = (root.textContent || "").match(/Service Engineer/g) || [];
      expect(signOffs).toHaveLength(expected);
    }
  );

  // Reproduced from a real print: a Rescue Boat certificate reached while the
  // page's type setting was still "Release Hook" printed with the Release
  // Hook template (wrong badge, crane fields, no checklists). The preview
  // must always use the certificate's OWN type, whatever config it is handed.
  it("renders a certificate with its own type's template even when handed another type's config", () => {
    const cert = freshCertificate("rescueboat", new Set());
    cert.vesselName = "MV TEST";
    const root = render(<CertificatePreview cert={cert} config={INSPECTION_TYPES.hook_reinstall} />).container;
    const text = root.textContent || "";
    expect(text).toContain("RESCUE BOAT");
    expect(text).toContain("Release Mechanism"); // the boat Statement's own rows
    expect(text).not.toContain("RELEASE HOOK RE-INSTALLATION CERTIFICATE"); // the wrong badge
    expect(text).not.toContain("Crane"); // the wrong (non-boat) fields
  });

  it("the hook certificate's two template pages are sections of one flow, not two pages", () => {
    const root = renderCert("hook_reinstall");
    expect(root.querySelectorAll(".insp-flow-section")).toHaveLength(2);
    expect(root.textContent).toContain("Hook Re-installation Certificate");
    expect(root.textContent).toContain("Inspection & Test Check Sheet");
  });
});
