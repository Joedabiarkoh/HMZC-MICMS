import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../finance.css";
import { listQuotations } from "../services/finance.api";
import { QuotationDoc } from "../types/finance.types";
import QuotationTable from "../components/QuotationTable";

export default function Quotations() {
  const [quotations, setQuotations] = useState<QuotationDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listQuotations().then(setQuotations).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="finance-page">
      <div className="finance-toolbar">
        <div>
          <h1>Quotations</h1>
          <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
        </div>
        <Link to="/finance/quotations/new" className="finance-btn finance-btn-primary">+ New Quotation</Link>
      </div>
      {loading ? <p>Loading...</p> : <QuotationTable quotations={quotations} />}
    </div>
  );
}
