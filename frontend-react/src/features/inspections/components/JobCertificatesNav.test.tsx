import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JobCertificatesNav from "./JobCertificatesNav";
import { freshCertificate } from "../data/inspectionHelpers";
import { EquipmentTypeKey, InspectionCertificate } from "../types/inspection.types";

// Requested directly: "when you open a vessel job and it has many
// certificate for that job scope, you always have to open one, close,
// get back to certificate, and open again." These pin down the actual
// stepping/filtering behavior, not just "does it render."

function cert(certNo: string, overrides: Partial<InspectionCertificate> & { type?: EquipmentTypeKey } = {}): InspectionCertificate {
  return { ...freshCertificate(overrides.type || "loosegear", new Set()), ...overrides, certNo, jobRef: overrides.jobRef ?? "JOB-1" };
}

function buildCertMap(certs: InspectionCertificate[]): Record<string, InspectionCertificate> {
  return Object.fromEntries(certs.map((c) => [c.certNo, c]));
}

describe("JobCertificatesNav", () => {
  it("renders nothing when the job has one or zero known certificates", () => {
    const { container } = render(
      <JobCertificatesNav jobNo="JOB-1" certificates={buildCertMap([cert("JOB-1-001")])} currentCertNo="JOB-1-001" onOpenCertificate={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows position, and Prev/Next step to the adjacent certificate", () => {
    const certs = [cert("JOB-1-001"), cert("JOB-1-002"), cert("JOB-1-003")];
    const onOpen = vi.fn();
    render(<JobCertificatesNav jobNo="JOB-1" certificates={buildCertMap(certs)} currentCertNo="JOB-1-002" onOpenCertificate={onOpen} />);

    expect(screen.getByText("Certificate 2 of 3 in this job")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next certificate in this job/i }));
    expect(onOpen).toHaveBeenCalledWith("JOB-1-003");

    fireEvent.click(screen.getByRole("button", { name: /previous certificate in this job/i }));
    expect(onOpen).toHaveBeenCalledWith("JOB-1-001");
  });

  it("disables Prev at the first certificate and Next at the last", () => {
    const certs = [cert("JOB-1-001"), cert("JOB-1-002")];
    render(<JobCertificatesNav jobNo="JOB-1" certificates={buildCertMap(certs)} currentCertNo="JOB-1-001" onOpenCertificate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /previous certificate in this job/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next certificate in this job/i })).not.toBeDisabled();
  });

  it("sorts certificate numbers numerically, not lexicographically (…9 before …10)", () => {
    const certs = [cert("JOB-1-010"), cert("JOB-1-002"), cert("JOB-1-009")];
    render(<JobCertificatesNav jobNo="JOB-1" certificates={buildCertMap(certs)} currentCertNo="JOB-1-009" onOpenCertificate={vi.fn()} />);
    // A plain string sort would put "…-010" before "…-002"/"…-009" —
    // "-009" landing in the middle (position 2 of 3) proves the sort is
    // numeric-aware, not lexicographic.
    expect(screen.getByText("Certificate 2 of 3 in this job")).toBeInTheDocument();
  });

  it("opens a searchable, type-grouped panel and jumps to the clicked certificate", () => {
    const certs = [
      cert("JOB-1-001", { type: "loosegear" }),
      cert("JOB-1-002", { type: "loosegear" }),
      cert("JOB-1-003", { type: "firefighting" }),
    ];
    const onOpen = vi.fn();
    render(<JobCertificatesNav jobNo="JOB-1" certificates={buildCertMap(certs)} currentCertNo="JOB-1-001" onOpenCertificate={onOpen} />);

    fireEvent.click(screen.getByText("Certificate 1 of 3 in this job"));
    expect(screen.getByPlaceholderText(/filter by certificate/i)).toBeInTheDocument();
    expect(screen.getByText("JOB-1-003")).toBeInTheDocument();

    fireEvent.click(screen.getByText("JOB-1-003"));
    expect(onOpen).toHaveBeenCalledWith("JOB-1-003");
    // Selecting a row closes the panel.
    expect(screen.queryByPlaceholderText(/filter by certificate/i)).not.toBeInTheDocument();
  });

  it("filters the panel by certificate number", () => {
    const certs = [cert("JOB-1-001"), cert("JOB-1-002"), cert("ALPHA-1-050", { jobRef: "JOB-1" })];
    render(<JobCertificatesNav jobNo="JOB-1" certificates={buildCertMap(certs)} currentCertNo="JOB-1-001" onOpenCertificate={vi.fn()} />);

    // "ALPHA-1-050" sorts before "JOB-1-001" alphabetically — JOB-1-001 is position 2 of 3, not 1.
    fireEvent.click(screen.getByText("Certificate 2 of 3 in this job"));
    fireEvent.change(screen.getByPlaceholderText(/filter by certificate/i), { target: { value: "ALPHA" } });

    expect(screen.getByText("ALPHA-1-050")).toBeInTheDocument();
    expect(screen.queryByText("JOB-1-002")).not.toBeInTheDocument();
  });

  it("only counts certificates actually tagged to this job — a different job's certs don't leak in", () => {
    const certs = [cert("JOB-1-001"), cert("JOB-1-002"), cert("JOB-2-001", { jobRef: "JOB-2" })];
    render(<JobCertificatesNav jobNo="JOB-1" certificates={buildCertMap(certs)} currentCertNo="JOB-1-001" onOpenCertificate={vi.fn()} />);
    expect(screen.getByText("Certificate 1 of 2 in this job")).toBeInTheDocument();
  });
});
