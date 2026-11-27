import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LifesavingAnalysis from "./LifesavingAnalysis";

const analysis = {
  filters: { class: "", flag: "", date_from: "", date_to: "" },
  certificates_analysed: 3,
  vessels: 3,
  known_classes: ["DNV", "BV"],
  known_flags: ["Panama"],
  rows: [
    { category: "Lifeboat", maker: "Hatecke", model: "TEL-26", units: 2, vessels: 2, vessel_names: ["MV One", "MV Two"], certificates: 2, with_defects: 1, with_attention: 0, repair_items: 1, defect_rate: 50 },
    { category: "Winch", maker: "Welin", model: "W-1", units: 3, vessels: 3, vessel_names: ["MV One", "MV Two", "MV Three"], certificates: 3, with_defects: 0, with_attention: 1, repair_items: 0, defect_rate: 0 },
  ],
};
const fetchMock = vi.fn((_f?: unknown) => Promise.resolve(analysis));
const pdfMock = vi.fn((_f?: unknown) => Promise.resolve());
vi.mock("../services/reports.api", () => ({
  fetchLifesavingAnalysis: (f: unknown) => fetchMock(f),
  downloadLifesavingAnalysisPdf: (f: unknown) => pdfMock(f),
}));

describe("LifesavingAnalysis", () => {
  it("shows nothing until a period is chosen and Generate Report is clicked", async () => {
    fetchMock.mockClear();
    render(<LifesavingAnalysis />);
    expect(screen.getByText("Choose the period and click Generate Report.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect((screen.getByText("Generate Report") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Download PDF Report") as HTMLButtonElement).disabled).toBe(true);
  });

  it("lists makers, models and the vessel names after generating, and downloads with class and flag", async () => {
    render(<LifesavingAnalysis />);
    fireEvent.change(screen.getByLabelText("Serviced from"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("to"), { target: { value: "2026-06-30" } });
    fireEvent.change(screen.getByLabelText("Class"), { target: { value: "DNV" } });
    fireEvent.change(screen.getByLabelText("Flag"), { target: { value: "Panama" } });
    fireEvent.click(screen.getByText("Generate Report"));

    expect(await screen.findByText("TEL-26")).toBeTruthy();
    expect(screen.getByText("MV One, MV Two")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ dateFrom: "2026-01-01", dateTo: "2026-06-30", classSociety: "DNV" }));

    fireEvent.click(screen.getByText("Download PDF Report"));
    await waitFor(() => expect(pdfMock).toHaveBeenCalledWith(expect.objectContaining({ classSociety: "DNV", flag: "Panama", dateFrom: "2026-01-01" })));
  });
});
