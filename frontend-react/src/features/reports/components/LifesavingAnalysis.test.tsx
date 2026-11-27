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
    { category: "Lifeboat", maker: "Hatecke", model: "TEL-26", units: 2, vessels: 2, certificates: 2, with_defects: 1, with_attention: 0, repair_items: 1, defect_rate: 50 },
    { category: "Winch", maker: "Welin", model: "W-1", units: 3, vessels: 3, certificates: 3, with_defects: 0, with_attention: 1, repair_items: 0, defect_rate: 0 },
  ],
};
const fetchMock = vi.fn((_f?: unknown) => Promise.resolve(analysis));
const pdfMock = vi.fn((_f?: unknown) => Promise.resolve());
vi.mock("../services/reports.api", () => ({
  fetchLifesavingAnalysis: (f: unknown) => fetchMock(f),
  downloadLifesavingAnalysisPdf: (f: unknown) => pdfMock(f),
}));

describe("LifesavingAnalysis", () => {
  it("lists makers/models by category and downloads the PDF with the chosen class and flag", async () => {
    render(<LifesavingAnalysis />);
    expect(await screen.findByText("TEL-26")).toBeTruthy();
    expect(screen.getByText("Winch")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Class"), { target: { value: "DNV" } });
    fireEvent.change(screen.getByLabelText("Flag"), { target: { value: "Panama" } });
    fireEvent.click(screen.getByText("Download PDF Report"));
    await waitFor(() => expect(pdfMock).toHaveBeenCalledWith(expect.objectContaining({ classSociety: "DNV", flag: "Panama" })));
  });

  it("re-runs the analysis with the filters on Analyse", async () => {
    render(<LifesavingAnalysis />);
    await screen.findByText("TEL-26");
    fireEvent.change(screen.getByLabelText("Class"), { target: { value: "BV" } });
    fireEvent.click(screen.getByText("Analyse"));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ classSociety: "BV" })));
  });
});
