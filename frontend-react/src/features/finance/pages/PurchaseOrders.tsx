import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../finance.css";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { listPurchaseOrders } from "../services/purchaseOrders.api";
import { formatPOMoney, PO_STATUS_LABELS, POStatus, PurchaseOrder } from "../types/purchaseOrder.types";
import { exportRowsToCsv } from "../../../utils/exportCsv";

const FILTERS: Array<{ key: "all" | "open" | POStatus | "overdue"; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending approval" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
  { key: "received", label: "Received" },
  { key: "closed", label: "Closed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "overdue", label: "Overdue" },
];

const OPEN_STATUSES: POStatus[] = ["draft", "pending_approval", "approved", "sent"];

export default function PurchaseOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    listPurchaseOrders()
      .then(setOrders)
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load purchase orders."))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "overdue" && !o.is_overdue) return false;
      if (filter === "open" && !OPEN_STATUSES.includes(o.status)) return false;
      if (filter !== "all" && filter !== "open" && filter !== "overdue" && o.status !== filter) return false;
      if (!q) return true;
      return [o.po_no, o.vendor_name, o.job_no, o.subject, o.quote_ref].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [orders, filter, query]);

  const awaiting = orders.filter((o) => o.status === "pending_approval").length;
  const overdue = orders.filter((o) => o.is_overdue).length;

  function handleExportCsv() {
    exportRowsToCsv(`purchase-orders-${new Date().toISOString().slice(0, 10)}`, shown, [
      { header: "PO No", value: (o) => o.po_no },
      { header: "Version", value: (o) => o.revision },
      { header: "Status", value: (o) => PO_STATUS_LABELS[o.status] },
      { header: "Vendor", value: (o) => o.vendor_name },
      { header: "Job No", value: (o) => o.job_no },
      { header: "Order Date", value: (o) => o.order_date },
      { header: "Delivery Date", value: (o) => o.delivery_date },
      { header: "Currency", value: (o) => o.currency },
      { header: "Total", value: (o) => o.total },
      { header: "Written By", value: (o) => o.written_by_name },
      { header: "Approved By", value: (o) => o.approved_by_name },
    ]);
  }

  return (
    <div className="finance-page">
      <div className="finance-toolbar">
        <div>
          <h1>Purchase Orders</h1>
          <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="finance-btn finance-btn-outline" onClick={handleExportCsv} disabled={shown.length === 0}>
            Export CSV
          </button>
          {hasPermission(user, PERM.FIN_EDIT) && (
            <Link to="/finance/purchase-orders/new" className="finance-btn finance-btn-primary">+ New Purchase Order</Link>
          )}
        </div>
      </div>

      {(awaiting > 0 || overdue > 0) && (
        <p style={{ fontSize: 12, color: "var(--insp-muted)", marginTop: 0 }}>
          {awaiting > 0 && <><strong>{awaiting}</strong> awaiting approval. </>}
          {overdue > 0 && <span style={{ color: "var(--insp-red)" }}><strong>{overdue}</strong> past their delivery date and not yet received.</span>}
        </p>
      )}

      {err && <div style={{ background: "#FBEEEC", color: "#7A241B", border: "1px solid #B3382C", borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`finance-btn ${filter === f.key ? "finance-btn-primary" : "finance-btn-outline"}`}
            style={{ padding: "4px 11px", fontSize: 11.5 }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <input
          type="search"
          aria-label="Search purchase orders"
          placeholder="Search PO no, vendor, job…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid #C9D1D8", borderRadius: 6, fontSize: 12, minWidth: 220 }}
        />
      </div>

      {loading ? <p>Loading...</p> : (
        <table className="finance-table">
          <thead>
            <tr>
              <th>PO No</th><th>Vendor</th><th>Job</th><th>Order date</th><th>Delivery</th><th>Total</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--insp-muted)" }}>No purchase orders found.</td></tr>
            )}
            {shown.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link to={`/finance/purchase-orders/${encodeURIComponent(o.po_no)}`}>{o.po_no}</Link>
                  {o.revision > 0 && <span style={{ fontSize: 10.5, color: "var(--insp-muted)" }}> v{o.revision}</span>}
                </td>
                <td>{o.vendor_name}</td>
                <td>{o.job_no || "—"}</td>
                <td>{o.order_date || "—"}</td>
                <td style={o.is_overdue ? { color: "var(--insp-red)", fontWeight: 700 } : undefined}>
                  {o.delivery_date || "—"}{o.is_overdue ? " (overdue)" : ""}
                </td>
                <td>{formatPOMoney(o.total, o.currency)}</td>
                <td><span className={`finance-status-pill ${o.status}`}>{PO_STATUS_LABELS[o.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
