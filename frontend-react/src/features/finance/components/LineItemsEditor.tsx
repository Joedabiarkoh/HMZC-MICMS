import { LineItem } from "../types/finance.types";

interface Props {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
}

function recompute(item: LineItem): LineItem {
  const gross = item.quantity * item.unit_price;
  const discount = gross * (item.discount_percent / 100);
  return { ...item, line_total: Math.max(0, gross - discount) };
}

/**
 * "quantities differ from each vessel so it has to be allowed to be
 * inputted by the person issuing and the price should come along when
 * the item is selected, but the person issuing should be able to change
 * the price if the need be and offer discount incase required" —
 * quantity, unit_price, and discount_percent are all editable per line,
 * regardless of what the catalog said when the item was picked.
 */
export default function LineItemsEditor({ lineItems, onChange }: Props) {
  function updateField(index: number, field: keyof LineItem, value: string) {
    const next = [...lineItems];
    const numeric = field === "quantity" || field === "unit_price" || field === "discount_percent";
    next[index] = recompute({ ...next[index], [field]: numeric ? Number(value) || 0 : value });
    onChange(next);
  }

  function removeLine(index: number) {
    onChange(lineItems.filter((_, i) => i !== index));
  }

  return (
    <table className="line-items-table">
      <thead>
        <tr>
          <th style={{ width: "12%" }}>Code</th>
          <th style={{ width: "32%" }}>Description</th>
          <th style={{ width: "10%" }}>Qty</th>
          <th style={{ width: "14%" }}>Unit Price</th>
          <th style={{ width: "12%" }}>Discount %</th>
          <th style={{ width: "14%" }}>Line Total</th>
          <th style={{ width: "6%" }}></th>
        </tr>
      </thead>
      <tbody>
        {lineItems.map((item, i) => (
          <tr key={i}>
            <td style={{ fontFamily: "monospace" }}>{item.code}</td>
            <td>
              <input value={item.description} onChange={(e) => updateField(i, "description", e.target.value)} aria-label={`Description for line ${i + 1}`} />
            </td>
            <td>
              <input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateField(i, "quantity", e.target.value)} aria-label={`Quantity for line ${i + 1}`} />
            </td>
            <td>
              <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateField(i, "unit_price", e.target.value)} aria-label={`Unit price for line ${i + 1}`} />
            </td>
            <td>
              <input type="number" min="0" max="100" step="0.1" value={item.discount_percent} onChange={(e) => updateField(i, "discount_percent", e.target.value)} aria-label={`Discount percent for line ${i + 1}`} />
            </td>
            <td>${item.line_total.toFixed(2)}</td>
            <td>
              <button type="button" className="remove-btn" onClick={() => removeLine(i)} aria-label={`Remove line ${i + 1}`}>×</button>
            </td>
          </tr>
        ))}
        {lineItems.length === 0 && (
          <tr><td colSpan={7} style={{ textAlign: "center", padding: 16, color: "var(--insp-muted)" }}>No items added yet — search the catalog above.</td></tr>
        )}
      </tbody>
    </table>
  );
}

export function newLineFromItem(item: { id: number; code: string; name: string; unit_price: number }): LineItem {
  return recompute({
    finance_item_id: item.id,
    code: item.code,
    description: item.name,
    quantity: 1,
    unit_price: item.unit_price,
    discount_percent: 0,
    line_total: 0,
  });
}

export function computeTotals(lineItems: LineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discountTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price * (item.discount_percent / 100), 0);
  return { subtotal, discountTotal, total: subtotal - discountTotal };
}
