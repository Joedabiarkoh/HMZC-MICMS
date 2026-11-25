import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import CertificatePreview from "./CertificatePreview";
import { INSPECTION_TYPES } from "../data/inspectionChecklists";
import { freshCertificate, freshLooseGearDefectRow, freshLooseGearRegisterRow, freshLooseGearState } from "../data/inspectionHelpers";
import type { InspectionCertificate } from "../types/inspection.types";

function loose(subType: Parameters<typeof freshLooseGearState>[0]): InspectionCertificate {
  const cert = freshCertificate("loosegear", new Set());
  cert.vesselName = "MV TEST";
  cert.engineerName = "A. Examiner";
  cert.looseGear = freshLooseGearState(subType);
  return cert;
}

function renderCert(cert: InspectionCertificate) {
  return render(<CertificatePreview cert={cert} config={INSPECTION_TYPES.loosegear} />).container;
}

describe("LEEA-030.1a4 / 1b4 print", () => {
  it("prints the LEEA wording, report number and tick boxes", () => {
    const cert = loose("standard_report");
    const d = cert.looseGear!.standardReport!;
    d.examinationType = "12monthly";
    d.safeForUse = "yes";
    d.description = "Chain sling";
    const root = renderCert(cert);
    const text = root.textContent || "";
    expect(text).toContain("REPORT OF THOROUGH EXAMINATION");
    expect(text).toContain("This report complies with the requirements of the Lifting Operations and Lifting Equipment Regulations 1998");
    expect(text).toContain("Document Reference LEEA-030.1a4");
    expect(text).toContain(`Report number: ${cert.certNo}`);
    expect(text).toContain("IS THIS EQUIPMENT SAFE TO OPERATE?");
    expect(text).toContain("Version 1 May 2023");
    expect(text).toContain("Chain sling");
    // the red "guidance only" notes are not part of the printed form
    expect(text).not.toContain("Remove before printing");
    expect(root.querySelector(".leea-watermark")).toBeNull();
    // every answered YES/NO pair carries exactly one tick: five examination-type pairs + safe to operate
    const ticks = Array.from(root.querySelectorAll("td.leea-box")).map((td) => td.textContent);
    expect(ticks.filter((t) => t === "✓")).toHaveLength(6);
  });

  it("the unsafe form is 1b4 with the red UNSAFE watermark", () => {
    const root = renderCert(loose("unsafe_report"));
    expect(root.textContent).toContain("Document Reference LEEA-030.1b4");
    expect(root.querySelector(".leea-watermark")?.textContent).toBe("Unsafe");
    // safe to operate is NO on a new unsafe report
    const ticks = Array.from(root.querySelectorAll("td.leea-box")).map((td) => td.textContent);
    expect(ticks.filter((t) => t === "✓")).toHaveLength(1);
  });
});

describe("LEEA-030.1c4 / 1d print", () => {
  it("the register prints the LEEA grid, legend and 'defect sheet attached'", () => {
    const cert = loose("multiple_items");
    const d = cert.looseGear!.multipleItems!;
    d.reasonForInspection = "12monthly";
    d.rows = [
      { ...freshLooseGearRegisterRow(), serialNo: "SH-1", description: "Shackle", swl: "2t", result: "ND", safeToUse: "yes" },
      { ...freshLooseGearRegisterRow(), serialNo: "SH-2", description: "Shackle", swl: "2t", result: "SDR", safeToUse: "no", reason: "installation" },
    ];
    const root = renderCert(cert);
    const text = root.textContent || "";
    expect(text).toContain("Document Reference LEEA-030.1c4");
    expect(text).toContain("This report meets the requirements of schedule 1 of regulation 10 of LOLER 1998");
    expect(text).toContain("Latest Date of Next Thorough Examination");
    expect(text).toContain("Written Scheme: D");
    const body = Array.from(root.querySelectorAll("table.leea-reg tbody tr")).map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent));
    expect(body).toHaveLength(2);
    expect(body[0][0]).toBe("SH-1");
    expect(body[0][6]).toBe("C"); // register-wide reason: 12 monthly
    expect(body[1][6]).toBe("A"); // row's own reason: installation
    expect(body[1][8]).toBe("SDR");
    expect(body[1][9]).toBe("No");
    // SDR present -> "Defect / Observation sheet attached? Yes"
    const attached = Array.from(root.querySelectorAll("td.leea-box")).map((td) => td.textContent);
    expect(attached).toEqual(["✓", ""]);
  });

  it("the defect list prints the LEEA-030.1d table and the report it refers to", () => {
    const cert = loose("defect_report");
    const d = cert.looseGear!.defectReport!;
    d.referencedReportNo = "CERT/HMZC/LG/20261125-001";
    d.defects = [{ ...freshLooseGearDefectRow(), equipmentIdNo: "SH-2", equipmentDescription: "Shackle", defectiveParts: "Pin", immediateDanger: "yes", repairParticulars: "Replace" }];
    const root = renderCert(cert);
    const text = root.textContent || "";
    expect(text).toContain("Document Reference LEEA- 030.1d");
    expect(text).toContain("Report of Thorough Examination – Defect Report List");
    expect(text).toContain("CERT/HMZC/LG/20261125-001");
    expect(text).toContain("*If yes must be reported to HSE");
    const cells = Array.from(root.querySelectorAll("table.leea-defects tbody tr td")).map((td) => td.textContent);
    expect(cells).toEqual(["SH-2", "Shackle", "Pin", "Yes", "N/A", "Replace"]); // immediate danger -> "when" is N/A
  });

  it("landscape forms switch the print page to landscape only while shown", () => {
    const { unmount } = render(<CertificatePreview cert={loose("defect_report")} config={INSPECTION_TYPES.loosegear} />);
    expect(document.head.querySelector("style[data-hmzc-landscape]")?.textContent).toContain("A4 landscape");
    unmount();
    expect(document.head.querySelector("style[data-hmzc-landscape]")).toBeNull();
    const portrait = render(<CertificatePreview cert={loose("standard_report")} config={INSPECTION_TYPES.loosegear} />);
    expect(document.head.querySelector("style[data-hmzc-landscape]")).toBeNull();
    portrait.unmount();
  });
});
