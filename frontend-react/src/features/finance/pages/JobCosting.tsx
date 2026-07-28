import { useEffect, useState } from "react";
import "../finance.css";
import { getJobCosting } from "../services/finance.api";
import { JobCostingRow } from "../types/finance.types";

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

/**
 * Was a "backend-pending" stub — depended on Expenses existing first
 * (see that page). Profit per vessel = paid-invoice revenue minus
 * vessel-tagged expenses, computed server-side (api/routes/finance.py's
 * job_costing()). Deliberately company-wide-all-time per vessel name,
 * not scoped to one specific visit/date — there's no exact linkage
 * between an Expense and a particular Invoice, only the shared
 * vessel_name string, so this answers "has this vessel been profitable
 * overall," not "was this one job on this one date profitable."
 */
export default function JobCosting() {
  const [rows, setRows] = useState<JobCostingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    getJobCosting()
      .then(setRows)
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load job costing."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="finance-page">
      <div className="finance-toolbar">
        <div>
          <h1>Job Profitability</h1>
          <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
        </div>
      </div>
      <p className="finance-subtitle" style={{ marginTop: -10 }}>
        Revenue is paid invoice totals per vessel; cost is expenses logged against that vessel (see
        Expense Management). Vessels with no vessel-tagged expenses show 100% of revenue as profit —
        that's untracked cost, not necessarily zero real cost.
      </p>

      {err && <div style={{ background: "#FBEEEC", color: "#7A241B", border: "1px solid #B3382C", borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 12 }}>{err}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p className="finance-subtitle">No paid invoices or vessel-tagged expenses yet — nothing to show.</p>
      ) : (
        <table className="finance-table">
          <thead>
            <tr><th>Vessel</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vessel_name}>
                <td>{r.vessel_name}</td>
                <td>{money(r.revenue)}</td>
                <td>{money(r.cost)}</td>
                <td style={{ color: r.profit < 0 ? "#B3382C" : "#4C7A3A", fontWeight: 700 }}>{money(r.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
