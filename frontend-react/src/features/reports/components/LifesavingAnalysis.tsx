import { useRef, useState } from "react";
import { exportRowsToCsv } from "../../../utils/exportCsv";
import { downloadLifesavingAnalysisPdf, fetchLifesavingAnalysis } from "../services/reports.api";
import { LSAAnalysis, LSAFilters } from "../types/reports.types";

const CATEGORY_ORDER = ["Lifeboat", "Rescue boat", "Free-fall lifeboat", "Davit", "Winch", "Release hook"];
const BLANK: LSAFilters = { classSociety: "", flag: "", dateFrom: "", dateTo: "" };

/**
 * Maker/model analysis of the lifeboats, rescue boats, davits, winches and
 * release hooks HMZC has inspected (Lifesaving Appliances certificates only),
 * with class / flag / date filters and a one-click PDF a class society or
 * flag state can be given.
 */
export default function LifesavingAnalysis() {
  const [filters, setFilters] = useState<LSAFilters>(BLANK);
  const [data, setData] = useState<LSAAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  // Remembered across filtered runs so the class/flag suggestions don't shrink
  // to whatever the current filter happens to match.
  const known = useRef<{ classes: Set<string>; flags: Set<string> }>({ classes: new Set(), flags: new Set() });

  async function run(f: LSAFilters) {
    setLoading(true);
    setError("");
    try {
      const d = await fetchLifesavingAnalysis(f);
      d.known_classes.forEach((c) => known.current.classes.add(c));
      d.known_flags.forEach((c) => known.current.flags.add(c));
      setData(d);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not run the analysis.");
    } finally {
      setLoading(false);
    }
  }

  const datesChosen = !!filters.dateFrom && !!filters.dateTo;

  async function handleDownload() {
    if (!datesChosen) return;
    setDownloading(true);
    setError("");
    try {
      await downloadLifesavingAnalysisPdf(filters);
    } catch {
      setError("Could not download the report.");
    } finally {
      setDownloading(false);
    }
  }

  function exportCsv() {
    if (!data) return;
    exportRowsToCsv(`lifesaving-analysis-${new Date().toISOString().slice(0, 10)}`, data.rows, [
      { header: "Category", value: (r) => r.category },
      { header: "Maker", value: (r) => r.maker },
      { header: "Model", value: (r) => r.model },
      { header: "Units", value: (r) => r.units },
      { header: "Vessels", value: (r) => r.vessel_names.join("; ") },
      { header: "Certificates", value: (r) => r.certificates },
      { header: "Certificates with defects", value: (r) => r.with_defects },
      { header: "Certificates needing attention", value: (r) => r.with_attention },
      { header: "Repair items", value: (r) => r.repair_items },
      { header: "Defect rate %", value: (r) => r.defect_rate },
    ]);
  }

  const set = (k: keyof LSAFilters, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const rows = data?.rows ?? [];

  return (
    <section className="reports-section" aria-labelledby="lsa-heading">
      <div className="reports-toolbar">
        <div>
          <h2 id="lsa-heading">Lifesaving Report</h2>
          <p className="reports-section-note">
            Pick the period, then generate the maker and model report for lifeboats, rescue boats, davits, winches and
            release hooks (finalized Lifesaving Appliances certificates only). Class and flag are optional — fill them in
            when a class society or flag state asks for the report.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="reports-btn" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</button>
          <button type="button" className="reports-btn reports-btn--primary" onClick={handleDownload} disabled={downloading || !datesChosen} title={datesChosen ? "" : "Choose the period first"}>
            {downloading ? "Preparing…" : "Download PDF Report"}
          </button>
        </div>
      </div>

      <form
        className="reports-filters"
        onSubmit={(e) => { e.preventDefault(); if (datesChosen) void run(filters); }}
      >
        <label>Class
          <input list="lsa-classes" value={filters.classSociety} onChange={(e) => set("classSociety", e.target.value)} placeholder="e.g. DNV" />
          <datalist id="lsa-classes">{[...known.current.classes].sort().map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>Flag
          <input list="lsa-flags" value={filters.flag} onChange={(e) => set("flag", e.target.value)} placeholder="e.g. Panama" />
          <datalist id="lsa-flags">{[...known.current.flags].sort().map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>Serviced from
          <input type="date" required value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
        </label>
        <label>to
          <input type="date" required value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => set("dateTo", e.target.value)} />
        </label>
        <button type="submit" className="reports-btn reports-btn--primary" disabled={loading || !datesChosen}>{loading ? "Generating…" : "Generate Report"}</button>
        <button type="button" className="reports-btn" onClick={() => { setFilters(BLANK); setData(null); setError(""); }}>Clear</button>
      </form>

      {error && <p className="reports-section-note" role="alert">{error}</p>}
      {data && (
        <p className="reports-section-note">
          {data.certificates_analysed} certificate(s) on {data.vessels} vessel(s).
          {(filters.classSociety || filters.flag) && " Hook re-installation certificates carry no class, so they only appear when the Class filter is empty."}
        </p>
      )}

      {!data ? (
        <p className="reports-empty">{loading ? "Generating…" : "Choose the period and click Generate Report."}</p>
      ) : rows.length === 0 ? (
        <p className="reports-empty">No lifesaving-appliance certificates match these filters.</p>
      ) : (
        CATEGORY_ORDER.filter((c) => rows.some((r) => r.category === c)).map((cat) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, color: "var(--insp-navy)", margin: "10px 0 6px" }}>{cat}</h3>
            <table className="reports-table reports-table--compact">
              <thead>
                <tr><th>Maker</th><th>Model</th><th>Units</th><th>Vessels</th><th>Certs</th><th>With defects</th><th>Need attention</th><th>Defect rate</th></tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.category === cat).map((r) => (
                  <tr key={`${r.maker}|${r.model}`}>
                    <td>{r.maker}</td>
                    <td>{r.model}</td>
                    <td>{r.units}</td>
                    <td>{r.vessel_names.join(", ") || "—"}</td>
                    <td>{r.certificates}</td>
                    <td>{r.with_defects}</td>
                    <td>{r.with_attention}</td>
                    <td style={r.defect_rate >= 50 ? { color: "var(--insp-red)", fontWeight: 700 } : undefined}>{r.defect_rate.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}
