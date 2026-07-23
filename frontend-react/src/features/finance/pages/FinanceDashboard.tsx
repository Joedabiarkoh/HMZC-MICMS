import { useFinance } from "../hooks/useFinance";
import FinanceCard from "../components/FinanceCard";
import ProfitChart from "../components/ProfitChart";
import "../finance.css";

function money(n: number | undefined): string {
  return `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function FinanceDashboard() {
  const { summary, loading, error } = useFinance();

  if (loading) return <p className="finance-page">Loading finance dashboard...</p>;
  if (error) return <p className="finance-page">Failed to load finance data: {error}</p>;

  return (
    <div className="finance-page">
      <h1>HMZC Finance Dashboard</h1>
      <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>

      <div className="finance-dashboard__cards">
        <FinanceCard label="Revenue (Paid Invoices)" value={money(summary?.revenue)} />
        <FinanceCard label="Outstanding (Issued, Unpaid)" value={money(summary?.outstanding)} />
        <FinanceCard label="Pending Quotations" value={`${summary?.pending_quotations ?? 0}`} />
        {/* profit_margin is null, not 0 — there's no expense/cost tracking
            wired up yet (see Expenses.tsx, still backend-pending), so a
            real margin can't be computed. Showing "0%" would silently
            claim every dollar of revenue is pure profit, which is worse
            than saying plainly that it isn't tracked yet. */}
        <FinanceCard
          label="Profit Margin"
          value={summary?.profit_margin != null ? `${summary.profit_margin}%` : "Not tracked yet"}
        />
      </div>

      <h2>Monthly Revenue (Last 6 Months)</h2>
      <ProfitChart data={summary?.monthly ?? []} />

      <h2>Recent Invoices</h2>
      {(summary?.recent_transactions ?? []).length === 0 ? (
        <p className="finance-subtitle">No invoices issued yet.</p>
      ) : (
        <table className="finance-table">
          <tbody>
            {(summary?.recent_transactions ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.description}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{money(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
