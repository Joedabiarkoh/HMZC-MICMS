import { Link } from "react-router-dom";
import { QuotationDoc } from "../types/finance.types";

interface QuotationTableProps {
  quotations: QuotationDoc[];
}

// Updated for the catalog-driven quotation shape (line_items, issued_by,
// version) — the previous version was built around a flat
// {quotation_number, customer, service, amount} shape that no longer
// matches what the backend returns.
export default function QuotationTable({ quotations }: QuotationTableProps) {
  return (
    <table className="finance-table">
      <thead>
        <tr>
          <th>Quotation No</th>
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
        {quotations.map((q) => (
          <tr key={q.id}>
            <td>{q.quotation_no}</td>
            <td>{q.customer}</td>
            <td>{q.vessel_name || "—"}</td>
            <td>${q.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td><span className={`finance-status-pill ${q.status}`}>{q.status}</span></td>
            <td>{q.issued_by?.full_name || q.issued_by?.email || "—"}</td>
            <td>{new Date(q.created_at).toLocaleDateString()}</td>
            <td><Link to={`/finance/quotations/${encodeURIComponent(q.quotation_no)}`}>Open</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
