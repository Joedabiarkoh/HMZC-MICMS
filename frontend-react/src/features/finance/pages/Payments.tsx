import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../finance.css";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { listInvoices, saveInvoice } from "../services/finance.api";
import { InvoiceDoc } from "../types/finance.types";
import { confirmAction } from "../../../components/ConfirmDialog";
import { exportRowsToCsv } from "../../../utils/exportCsv";

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

/**
 * Was a "backend-pending" stub (see the UX audit and git history) —
 * wired to GET /finance/payments, which never existed server-side.
 * Rebuilt on data that already exists instead: Invoice already carries
 * a status (draft/issued/paid/void — see backend-fastapi's
 * models/finance_document.py), so "which invoices are outstanding, and
 * by how much" doesn't need a new table or endpoint, just a focused
 * view over the same /finance/invoices list Invoices.tsx already uses,
 * plus a one-click way to mark one paid without opening the full
 * invoice edit form. "Days outstanding" is computed from updated_at
 * (the record's own last-modified timestamp) since there's no separate
 * issued_at/due_date column on Invoice yet — an approximation, not
 * exact aging against a real due date.
 */
export default function Payments() {
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERM.FIN_EDIT);
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [markingId, setMarkingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    listInvoices()
      .then(setInvoices)
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load invoices."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const outstanding = invoices
    .filter((i) => i.status === "issued")
    .sort((a, b) => daysSince(b.updated_at || b.created_at) - daysSince(a.updated_at || a.created_at));
  const totalOutstanding = outstanding.reduce((sum, i) => sum + i.total, 0);

  const recentlyPaid = invoices
    .filter((i) => i.status === "paid")
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 10);

  async function markPaid(inv: InvoiceDoc) {
    const ok = await confirmAction({
      title: "Mark invoice as paid?",
      message: `${inv.invoice_no} (${money(inv.total)}) will be recorded as paid and count toward Revenue on the Finance Dashboard.`,
      confirmLabel: "Mark as Paid",
    });
    if (!ok) return;
    setMarkingId(inv.id);
    try {
      const updated = await saveInvoice({
        invoice_no: inv.invoice_no,
        quotation_id: inv.quotation_id,
        customer: inv.customer,
        vessel_name: inv.vessel_name,
        imo_no: inv.imo_no,
        status: "paid",
        line_items: inv.line_items,
        subtotal: inv.subtotal,
        discount_total: inv.discount_total,
        total: inv.total,
        version: inv.version,
      });
      setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not mark this invoice as paid — it may have been changed by someone else. Reload and try again.");
    } finally {
      setMarkingId(null);
    }
  }

  function handleExportCsv() {
    exportRowsToCsv(`outstanding-payments-${new Date().toISOString().slice(0, 10)}`, outstanding, [
      { header: "Invoice No", value: (i) => i.invoice_no },
      { header: "Customer", value: (i) => i.customer },
      { header: "Vessel", value: (i) => i.vessel_name },
      { header: "Total", value: (i) => i.total },
      { header: "Days Outstanding", value: (i) => daysSince(i.updated_at || i.created_at) },
    ]);
  }

  return (
    <div className="finance-page">
      <div className="finance-toolbar">
        <div>
          <h1>Payment Status</h1>
          <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
        </div>
        <button type="button" className="finance-btn finance-btn-outline" onClick={handleExportCsv} disabled={outstanding.length === 0}>
          Export CSV
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {err && <div style={{ background: "#FBEEEC", color: "#7A241B", border: "1px solid #B3382C", borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 12 }}>{err}</div>}

      {!loading && (
        <>
          <div className="finance-dashboard__cards">
            <div className="finance-card">
              <div className="finance-card__label">Outstanding Invoices</div>
              <div className="finance-card__value">{outstanding.length}</div>
            </div>
            <div className="finance-card">
              <div className="finance-card__label">Total Outstanding</div>
              <div className="finance-card__value">{money(totalOutstanding)}</div>
            </div>
          </div>

          <h2>Outstanding (Issued, Unpaid)</h2>
          {outstanding.length === 0 ? (
            <p className="finance-subtitle">Nothing outstanding — every issued invoice has been paid or voided.</p>
          ) : (
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Customer</th>
                  <th>Vessel</th>
                  <th>Total</th>
                  <th>Days Outstanding</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link to={`/finance/invoices/${encodeURIComponent(inv.invoice_no)}`}>{inv.invoice_no}</Link></td>
                    <td>{inv.customer}</td>
                    <td>{inv.vessel_name || "—"}</td>
                    <td>{money(inv.total)}</td>
                    <td>{daysSince(inv.updated_at || inv.created_at)}</td>
                    <td>
                      {canEdit && (
                        <button
                          type="button"
                          className="finance-btn finance-btn-primary"
                          style={{ padding: "4px 10px", fontSize: 11.5 }}
                          disabled={markingId === inv.id}
                          onClick={() => markPaid(inv)}
                        >
                          {markingId === inv.id ? "Saving..." : "Mark as Paid"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Recently Paid</h2>
          {recentlyPaid.length === 0 ? (
            <p className="finance-subtitle">No invoices marked as paid yet.</p>
          ) : (
            <table className="finance-table">
              <thead>
                <tr><th>Invoice No</th><th>Customer</th><th>Vessel</th><th>Total</th></tr>
              </thead>
              <tbody>
                {recentlyPaid.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link to={`/finance/invoices/${encodeURIComponent(inv.invoice_no)}`}>{inv.invoice_no}</Link></td>
                    <td>{inv.customer}</td>
                    <td>{inv.vessel_name || "—"}</td>
                    <td>{money(inv.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
