import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../finance.css";
import { listInvoices } from "../services/finance.api";
import { InvoiceDoc } from "../types/finance.types";
import InvoiceTable from "../components/InvoiceTable";

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listInvoices().then(setInvoices).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="finance-page">
      <div className="finance-toolbar">
        <div>
          <h1>Invoices</h1>
          <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
        </div>
        <Link to="/finance/invoices/new" className="finance-btn finance-btn-primary">+ New Invoice</Link>
      </div>
      {loading ? <p>Loading...</p> : <InvoiceTable invoices={invoices} />}
    </div>
  );
}
