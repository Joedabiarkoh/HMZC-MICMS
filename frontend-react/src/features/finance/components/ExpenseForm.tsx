import { useState } from "react";
import { createExpense } from "../services/finance.api";

const CATEGORIES = [
  "Travel",
  "Accommodation",
  "Spare Parts",
  "Transport",
  "Calibration",
  "Subcontractor",
  "Other",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// vessel_name is deliberately optional (see models/expense.py's own
// comment) — only fill it in when this cost was for a specific
// vessel/job that Job Costing should count it against; leave it blank
// for a general company expense (office rent, etc.).
export default function ExpenseForm({ onSaved }: { onSaved?: () => void }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [vesselName, setVesselName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await createExpense({
        category,
        amount: Number(amount),
        expense_date: expenseDate,
        vessel_name: vesselName.trim() || null,
        note: note.trim() || null,
      });
      setAmount("");
      setVesselName("");
      setNote("");
      onSaved?.();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not save this expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="finance-panel" style={{ marginBottom: 18 }}>
      {err && <div className="finance-error" style={{ background: "#FBEEEC", color: "#7A241B", border: "1px solid #B3382C", borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 12 }}>{err}</div>}
      <div className="finance-row2">
        <div className="finance-field">
          <label htmlFor="expense-category">Category</label>
          <select id="expense-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="finance-field">
          <label htmlFor="expense-amount">Amount ($)</label>
          <input id="expense-amount" type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div className="finance-row2">
        <div className="finance-field">
          <label htmlFor="expense-date">Date</label>
          <input id="expense-date" type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </div>
        <div className="finance-field">
          <label htmlFor="expense-vessel">Vessel (optional — for Job Costing)</label>
          <input id="expense-vessel" value={vesselName} onChange={(e) => setVesselName(e.target.value)} placeholder="e.g. Ocean Star" />
        </div>
      </div>
      <div className="finance-field">
        <label htmlFor="expense-note">Note (optional)</label>
        <input id="expense-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Flight to Cabinda for lifeboat servicing" />
      </div>
      <button type="submit" className="finance-btn finance-btn-primary" disabled={saving}>
        {saving ? "Saving..." : "Log Expense"}
      </button>
    </form>
  );
}
