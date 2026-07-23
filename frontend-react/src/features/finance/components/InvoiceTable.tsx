import { Link } from "react-router-dom";
import { InvoiceDoc } from "../types/finance.types";

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
            <td>{inv.invoice_no}</td>
            <td>{inv.customer}</td>
            <td>{inv.vessel_name || "—"}</td>
            <td>${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
