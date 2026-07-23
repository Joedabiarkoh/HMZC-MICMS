import { useState } from "react";
import { createExpense } from "../services/finance.api";

const CATEGORIES = [
  "Travel",
  "Accommodation",
  "Spare Parts",
  "Transport",
  "Calibration",
  "Subcontractor",
];

export default function ExpenseForm({ onSaved }: { onSaved?: () => void }) {
  const [job, setJob] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createExpense({ job, category, amount: Number(amount) });
    setJob("");
    setAmount("");
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="expense-form">
      <label>
        Job
        <input value={job} onChange={(e) => setJob(e.target.value)} required />
      </label>

      <label>
        Expense Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label>
        Amount
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>

      <button type="submit">Save Expense</button>
    </form>
  );
}
