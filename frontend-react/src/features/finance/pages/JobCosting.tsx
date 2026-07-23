import FinanceComingSoon from "./FinanceComingSoon";

// Was wired to GET /finance/job-costing/{job}, which doesn't exist
// server-side — see FinanceComingSoon.tsx for why this was replaced
// rather than left silently broken. Also see the Finance Dashboard's
// profit_margin field, which is deliberately null rather than a
// fabricated number for the same underlying reason: no expense/cost
// data is tracked anywhere yet.
export default function JobCosting() {
  return (
    <FinanceComingSoon
      title="Job Profitability"
      note="Depends on Expense tracking existing first (see the Expenses page) — profit per job can't be calculated without real cost data behind it."
    />
  );
}
