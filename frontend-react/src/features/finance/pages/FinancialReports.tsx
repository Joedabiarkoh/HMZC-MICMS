import FinanceComingSoon from "./FinanceComingSoon";

// Was wired to GET /finance/reports/{type}, which doesn't exist
// server-side, and an export-to-PDF/Excel/CSV flow with no defined
// backend contract for how the file would actually be streamed back —
// see FinanceComingSoon.tsx for why this was replaced rather than left
// silently broken.
export default function FinancialReports() {
  return (
    <FinanceComingSoon
      title="Financial Reports"
      note="Revenue, expense, outstanding-invoice, and profitability reports aren't built yet. Quotations and Invoices already have real data behind them (see those pages) — reporting on top of that data, plus PDF/Excel/CSV export, is the next real piece of work here."
    />
  );
}
