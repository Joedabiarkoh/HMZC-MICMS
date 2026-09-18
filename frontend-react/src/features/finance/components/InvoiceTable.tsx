import { Link } from "react-router-dom";
import { InvoiceDoc } from "../types/finance.types";
import { formatMoney } from "../data/currencies";

interface InvoiceTableProps {
  invoices: InvoiceDoc[];
}

// Updated for the catalog-driven invoice shape — see QuotationTable.tsx
// for the same change and why.
export default function InvoiceTable({ invoices }: InvoiceTableProps) {
  return (
    <table className="finance-table">
      <thead>
        <tr>
          <th>Invoice No</th>
          <th>Customer</th>
          <th>Vessel</th>
          <th>Total</th>
          <th>Status</th>
          <th>Issued By</th>
          <th>Date</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id}>
            <td>
              {inv.invoice_no}
              {inv._pending && (
                <span title="Saved on this device — waiting to sync" style={{ marginLeft: 6, fontSize: 9.5, color: "#B4690E" }}>
                  ● offline
                </span>
              )}
            </td>
            <td>{inv.customer}</td>
            <td>{inv.vessel_name || "—"}</td>
            <td>{formatMoney(inv.total, inv.currency, inv.exchange_rate)}</td>
            <td><span className={`finance-status-pill ${inv.status}`}>{inv.status}</span></td>
            <td>{inv.issued_by?.full_name || inv.issued_by?.email || "—"}</td>
            <td>{new Date(inv.created_at).toLocaleDateString()}</td>
            <td><Link to={`/finance/invoices/${encodeURIComponent(inv.invoice_no)}`}>Open</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
