import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../finance.css";
import { listQuotations } from "../services/finance.api";
import { QuotationDoc } from "../types/finance.types";
import QuotationTable from "../components/QuotationTable";
import { exportRowsToCsv } from "../../../utils/exportCsv";

export default function Quotations() {
  const [quotations, setQuotations] = useState<QuotationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  // See Invoices.tsx's identical fix for why this needs its own error
  // state instead of just logging a failed load to console.
  const [err, setErr] = useState("");

  useEffect(() => {
    listQuotations()
      .then(setQuotations)
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load quotations."))
      .finally(() => setLoading(false));
  }, []);

  function handleExportCsv() {
    exportRowsToCsv(`quotations-${new Date().toISOString().slice(0, 10)}`, quotations, [
      { header: "Quotation No", value: (q) => q.quotation_no },
      { header: "Customer", value: (q) => q.customer },
      { header: "Vessel", value: (q) => q.vessel_name },
      { header: "IMO No", value: (q) => q.imo_no },
      { header: "Status", value: (q) => q.status },
      { header: "Total", value: (q) => q.total },
      { header: "Issued By", value: (q) => q.issued_by?.full_name || q.issued_by?.email },
      { header: "Created At", value: (q) => q.created_at },
    ]);
  }

  return (
    <div className="finance-page">
      <div className="finance-toolbar">
        <div>
          <h1>Quotations</h1>
          <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="finance-btn finance-btn-outline" onClick={handleExportCsv} disabled={quotations.length === 0}>
            Export CSV
          </button>
          <Link to="/finance/quotations/new" className="finance-btn finance-btn-primary">+ New Quotation</Link>
        </div>
      </div>
      {err && <div style={{ background: "#FBEEEC", color: "#7A241B", border: "1px solid #B3382C", borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 12 }}>{err}</div>}
      {loading ? <p>Loading...</p> : <QuotationTable quotations={quotations} />}
    </div>
  );
}
