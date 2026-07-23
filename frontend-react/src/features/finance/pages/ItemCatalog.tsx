import { useEffect, useState } from "react";
import "../finance.css";
import { listFinanceItems, createFinanceItem, updateFinanceItem } from "../services/finance.api";
import { FinanceItem } from "../types/finance.types";

const emptyForm = { code: "", name: "", description: "", unit: "", unit_price: "", category: "" };

/**
 * "The prices and data provided earlier for finance is not to appear as
 * service provided but data base to help issuing invoice and quotation,
 * they are to be store in the backend and only appear when selected" —
 * this page is where that database is managed (admin-only, per
 * backend-fastapi's get_current_admin_user on the write routes). It's
 * reachable only from the nav shell for admins/finance users, never
 * exposed as a public services page.
 */
export default function ItemCatalog() {
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  function load() {
    listFinanceItems(true).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function startEdit(item: FinanceItem) {
    setEditingId(item.id);
    setForm({
      code: item.code, name: item.name, description: item.description || "",
      unit: item.unit || "", unit_price: String(item.unit_price), category: item.category || "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await updateFinanceItem(editingId, {
          name: form.name, description: form.description || null, unit: form.unit || null,
          unit_price: Number(form.unit_price), category: form.category || null,
        } as any);
      } else {
        await createFinanceItem({
          code: form.code, name: form.name, description: form.description || null, unit: form.unit || null,
          unit_price: Number(form.unit_price), category: form.category || null, is_active: true,
        } as any);
      }
      resetForm();
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not save the item.");
    }
  }

  async function toggleActive(item: FinanceItem) {
    await updateFinanceItem(item.id, { is_active: !item.is_active } as any);
    load();
  }

  return (
    <div className="finance-page">
      <h1>Item Catalog</h1>
      <p className="finance-subtitle">The price list used to build invoices and quotations — not shown to clients directly.</p>

      <div className="finance-panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>{editingId ? "Edit Item" : "Add New Item"}</h2>
        {error && <div style={{ background: "#FBEEEC", border: "1px solid var(--insp-red)", color: "#7A241B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="finance-row2">
            <div className="finance-field">
              <label>Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editingId} placeholder="e.g. LB-SVC-ANNUAL" />
            </div>
            <div className="finance-field">
              <label>Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Lifeboat Servicing" />
            </div>
          </div>
          <div className="finance-field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Annual Lifeboat Inspection & Service" />
          </div>
          <div className="finance-field">
            <label>Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="finance-row2">
            <div className="finance-field">
              <label>Unit Price ($)</label>
              <input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} required />
            </div>
            <div className="finance-field">
              <label>Unit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. each, hour, set" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="finance-btn finance-btn-primary" type="submit">{editingId ? "Save Changes" : "Add Item"}</button>
            {editingId && <button className="finance-btn finance-btn-outline" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <h2>Catalog ({items.length})</h2>
      {loading ? <p>Loading...</p> : (
        <table className="finance-table">
          <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Unit Price</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.5 }}>
                <td style={{ fontFamily: "monospace" }}>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.category || "—"}</td>
                <td>${item.unit_price.toFixed(2)}{item.unit ? ` / ${item.unit}` : ""}</td>
                <td>{item.is_active ? "Active" : "Inactive"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="finance-btn finance-btn-outline" style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => startEdit(item)}>Edit</button>
                  <button className="finance-btn finance-btn-outline" style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => toggleActive(item)}>
                    {item.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
