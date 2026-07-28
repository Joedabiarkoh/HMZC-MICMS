import { useEffect, useState } from "react";
import "../finance.css";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { deleteExpense, listExpenses } from "../services/finance.api";
import { ExpenseDoc } from "../types/finance.types";
import ExpenseForm from "../components/ExpenseForm";
import { confirmAction } from "../../../components/ConfirmDialog";
import { exportRowsToCsv } from "../../../utils/exportCsv";

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

/**
 * Was a "backend-pending" stub — see git history and FinanceComingSoon.
 * Real now: a simple company-wide expense ledger (category, amount,
 * date, note), with an optional vessel tag so a cost can also count
 * toward Job Costing. This is the piece Job Costing depends on — no
 * cost data existed anywhere in this system before this page.
 */
export default function Expenses() {
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERM.FIN_EDIT);
  const canDelete = hasPermission(user, PERM.FIN_DELETE);
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  function load() {
    setLoading(true);
    listExpenses()
      .then(setExpenses)
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load expenses."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  async function remove(expense: ExpenseDoc) {
    const ok = await confirmAction({
      title: "Delete this expense?",
      message: `${expense.category} — ${money(expense.amount)} on ${expense.expense_date} will be permanently removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteExpense(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not delete this expense.");
    }
  }

  function handleExportCsv() {
    exportRowsToCsv(`expenses-${new Date().toISOString().slice(0, 10)}`, expenses, [
      { header: "Date", value: (e) => e.expense_date },
      { header: "Category", value: (e) => e.category },
      { header: "Vessel", value: (e) => e.vessel_name },
      { header: "Amount", value: (e) => e.amount },
      { header: "Note", value: (e) => e.note },
      { header: "Logged By", value: (e) => e.logged_by?.full_name || e.logged_by?.email },
    ]);
  }

  return (
    <div className="finance-page">
      <div className="finance-toolbar">
        <div>
          <h1>Expense Management</h1>
          <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
        </div>
        <button type="button" className="finance-btn finance-btn-outline" onClick={handleExportCsv} disabled={expenses.length === 0}>
          Export CSV
        </button>
      </div>

      {canEdit && <ExpenseForm onSaved={load} />}

      {err && <div style={{ background: "#FBEEEC", color: "#7A241B", border: "1px solid #B3382C", borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 12 }}>{err}</div>}

      <div className="finance-dashboard__cards">
        <div className="finance-card">
          <div className="finance-card__label">Total Logged</div>
          <div className="finance-card__value">{money(total)}</div>
        </div>
        <div className="finance-card">
          <div className="finance-card__label">Entries</div>
          <div className="finance-card__value">{expenses.length}</div>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : expenses.length === 0 ? (
        <p className="finance-subtitle">No expenses logged yet.</p>
      ) : (
        <table className="finance-table">
          <thead>
            <tr>
              <th>Date</th><th>Category</th><th>Vessel</th><th>Amount</th><th>Note</th><th>Logged By</th><th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.expense_date}</td>
                <td>{e.category}</td>
                <td>{e.vessel_name || "—"}</td>
                <td>{money(e.amount)}</td>
                <td>{e.note || "—"}</td>
                <td>{e.logged_by?.full_name || e.logged_by?.email || "—"}</td>
                <td>
                  {canDelete && (
                    <button
                      type="button"
                      className="finance-btn finance-btn-danger"
                      style={{ padding: "4px 10px", fontSize: 11.5 }}
                      onClick={() => remove(e)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
