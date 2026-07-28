import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../finance.css";
import { listInvoices } from "../services/finance.api";
import { InvoiceDoc } from "../types/finance.types";
import InvoiceTable from "../components/InvoiceTable";
import { exportRowsToCsv } from "../../../utils/exportCsv";

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listInvoices().then(setInvoices).catch(console.error).finally(() => setLoading(false));
  }, []);

  function handleExportCsv() {
    exportRowsToCsv(`invoices-${new Date().toISOString().slice(0, 10)}`, invoices, [
      { header: "Invoice No", value: (i) => i.invoice_no },
      { header: "Customer", value: (i) => i.customer },
      { header: "Vessel", value: (i) => i.vessel_name },
      { header: "IMO No", value: (i) => i.imo_no },
      { header: "Status", value: (i) => i.status },
      { header: "Total", value: (i) => i.total },
      { header: "Issued By", value: (i) => i.issued_by?.full_name || i.issued_by?.email },
      { header: "Created At", value: (i) => i.created_at },
    ]);
  }

  return (
    <div className="finance-page">
      <div className="finance-toolbar">
        <div>
          <h1>Invoices</h1>
          <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="finance-btn finance-btn-outline" onClick={handleExportCsv} disabled={invoices.length === 0}>
            Export CSV
          </button>
          <Link to="/finance/invoices/new" className="finance-btn finance-btn-primary">+ New Invoice</Link>
        </div>
      </div>
      {loading ? <p>Loading...</p> : <InvoiceTable invoices={invoices} />}
    </div>
  );
}
