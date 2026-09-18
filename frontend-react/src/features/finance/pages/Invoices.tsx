import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../finance.css";
import { listInvoices } from "../services/finance.api";
import { getCachedInvoices, saveInvoiceToCache } from "../services/finance.storage";
import { InvoiceDoc } from "../types/finance.types";
import InvoiceTable from "../components/InvoiceTable";
import { exportRowsToCsv } from "../../../utils/exportCsv";

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  // Root-caused from a debug pass: a failed load (expired session, a
  // transient 500) used to just log to console and leave `invoices`
  // at [] — rendering the identical "no invoices yet" empty state as
  // a genuinely empty list, on this page that's the primary entry
  // point into every invoice in the system. Payments.tsx/Expenses.tsx/
  // JobCosting.tsx already surface a load failure this same way.
  const [err, setErr] = useState("");

  useEffect(() => {
    listInvoices()
      .then(async (server) => {
        // Keep the local cache warm with the authoritative server copy
        // of everything it returned (see finance.storage.ts), then
        // surface any invoice still only in the cache — i.e. a save
        // still queued from an offline session on this device (see
        // InvoiceForm.tsx's handleSave) — that the server doesn't have
        // yet, so it's visible here instead of missing until it syncs.
        await Promise.all(server.map((inv) => saveInvoiceToCache(inv, false)));
        const cached = await getCachedInvoices();
        const pendingOnly = cached.filter((c) => c._pending && !server.some((s) => s.invoice_no === c.invoice_no));
        setInvoices([...pendingOnly, ...server]);
      })
      .catch(async (e) => {
        setErr(e?.response?.data?.detail || "Could not load invoices.");
        // Offline entirely — fall back to whatever this device has
        // cached locally rather than showing an empty list.
        const cached = await getCachedInvoices();
        if (cached.length > 0) setInvoices(cached);
      })
      .finally(() => setLoading(false));
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
      {err && <div style={{ background: "#FBEEEC", color: "#7A241B", border: "1px solid #B3382C", borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 12 }}>{err}</div>}
      {loading ? <p>Loading...</p> : <InvoiceTable invoices={invoices} />}
    </div>
  );
}
