import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import HookReinstallForm from "./HookReinstallForm";
import CertificatePreview from "./CertificatePreview";
import { INSPECTION_TYPES } from "../data/inspectionChecklists";
import { freshCertificate } from "../data/inspectionHelpers";
import { InspectionCertificate } from "../types/inspection.types";

// The signature widget reads the signed-in user; the form itself never needs one.
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ user: null, updateUser: () => {} }),
}));

function Harness({ initial }: { initial: InspectionCertificate }) {
  const [cert, setCert] = useState(initial);
  return (
    <>
      <HookReinstallForm current={cert} updateField={(k, v) => setCert((c) => ({ ...c, [k]: v }))} openCertificate={() => {}} />
      <div data-testid="preview">
        <CertificatePreview cert={cert} config={INSPECTION_TYPES[cert.type]} />
      </div>
    </>
  );
}

function renderForm() {
  const cert = freshCertificate("hook_reinstall", new Set());
  cert.vesselName = "MV TEST";
  return render(<Harness initial={cert} />);
}

describe("Hook Re-installation form: the hook tester", () => {
  it("offers 'Hook tester' under Load applied by, with no tester form until it is selected", () => {
    renderForm();
    expect(screen.getByLabelText("Hook tester")).toBeTruthy();
    expect(screen.queryByLabelText("Hook Load Test Report")).toBeNull();
    expect(screen.queryByText(/Hook Load Test Report — hydraulic hook tester/)).toBeNull();
  });

  it("selecting the hook tester brings up the Hook Load Test Report form with the report's defaults", () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Hook tester"));
    expect(screen.getByText(/Hook Load Test Report — hydraulic hook tester/)).toBeTruthy();
    expect((screen.getByLabelText("Hydraulic cylinder") as HTMLInputElement).value).toContain("Raptor Pro RC20T-100");
    expect((screen.getByLabelText("Cylinder rated capacity (t)") as HTMLInputElement).value).toBe("20");
    expect((screen.getByLabelText("Rated working pressure (bar)") as HTMLInputElement).value).toBe("630");
    expect((screen.getByLabelText("Safe Working Load (SWL), tonnes") as HTMLInputElement).value).toBe("3.5");
    // the calculated test load / pressure come straight from those inputs
    expect(screen.getByDisplayValue("7.00 t → 220.5 bar")).toBeTruthy();
  });

  it("changing the SWL or the test factor recalculates the pressures", () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Hook tester"));
    fireEvent.change(screen.getByLabelText("Test factor (× SWL)"), { target: { value: "2.2" } });
    expect(screen.getByDisplayValue("7.70 t → 242.6 bar")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Safe Working Load (SWL), tonnes"), { target: { value: "5" } });
    expect(screen.getByDisplayValue("11.00 t → 346.5 bar")).toBeTruthy(); // 2.2 × 5 = 11 t × 31.5
  });

  it("entering the gauge readings and the pressures shows the calculated drop", () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Hook tester"));
    fireEvent.change(screen.getByLabelText("Gauge reading at 100%"), { target: { value: "220" } });
    fireEvent.change(screen.getByLabelText("Gauge reading at start of hold (bar)"), { target: { value: "220" } });
    fireEvent.change(screen.getByLabelText("Gauge reading after the hold (bar)"), { target: { value: "218" } });
    expect(screen.getByDisplayValue("2 bar")).toBeTruthy();
  });

  it("the printed certificate gains the Hook Load Test Report section only when the hook tester is selected", () => {
    renderForm();
    const preview = screen.getByTestId("preview");
    expect(preview.textContent).not.toContain("Hook Load Test Report");
    expect(preview.querySelectorAll(".insp-flow-section")).toHaveLength(2);
    fireEvent.click(screen.getByLabelText("Hook tester"));
    expect(preview.querySelectorAll(".insp-flow-section")).toHaveLength(3);
    expect(preview.textContent).toContain("Hook Load Test Report");
    expect(preview.textContent).toContain("HYDRAULIC HOOK TESTER");
    expect(preview.textContent).toContain("Test pressure = 7.00 × 31.5 = 220.5 bar");
    expect(preview.textContent).toContain("242.6"); // the 2.2 × SWL reference row
  });
});

describe("Hook Re-installation form: revised template", () => {
  it("no longer asks for Date of Last Service or Class / Flag, or Qty / Next Due per component", () => {
    renderForm();
    expect(screen.queryByLabelText("Date of Last Service")).toBeNull();
    expect(screen.queryByLabelText("Class / Flag")).toBeNull();
    expect(screen.queryByLabelText("Quantity")).toBeNull();
    expect(screen.queryByLabelText("Next due")).toBeNull();
    expect(screen.getAllByText("Swivel (if fitted)").length).toBeGreaterThanOrEqual(1); // form + preview
  });

  it("the load test has a single 'Craft mass + equipment' field", () => {
    renderForm();
    expect(screen.getByLabelText("Craft mass + equipment (kg)")).toBeTruthy();
    expect(screen.queryByLabelText("Equipment (kg)")).toBeNull();
  });
});
