import FinanceComingSoon from "./FinanceComingSoon";

// Was wired to GET /finance/expenses and a working-looking ExpenseForm
// that had nowhere real to submit to — see FinanceComingSoon.tsx for
// why this was replaced rather than left silently broken.
export default function Expenses() {
  return (
    <FinanceComingSoon
      title="Expense Management"
      note="Expense tracking (job costs, categories, amounts) isn't built yet — no backend table or endpoints exist for it. Needed before Job Costing below can show real profit figures, since profit is revenue minus tracked cost."
    />
  );
}
