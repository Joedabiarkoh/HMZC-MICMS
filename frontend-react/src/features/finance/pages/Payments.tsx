import FinanceComingSoon from "./FinanceComingSoon";

// Was wired to GET /finance/payments, which doesn't exist server-side —
// see FinanceComingSoon.tsx for why this was replaced rather than left
// silently broken.
export default function Payments() {
  return (
    <FinanceComingSoon
      title="Payment Status"
      note="Payment tracking against invoices isn't built yet. Invoices already carry a status (draft/issued/paid/void) — this page will show which are outstanding and by how much once it's implemented."
    />
  );
}
