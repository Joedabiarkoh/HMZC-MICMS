import { DiscountType, LineItem } from "../types/finance.types";

interface Props {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
}

function lineDiscount(item: LineItem): number {
  const gross = item.quantity * item.unit_price;
  return item.discount_type === "amount" ? item.discount_amount : gross * (item.discount_percent / 100);
}

function recompute(item: LineItem): LineItem {
  const gross = item.quantity * item.unit_price;
  return { ...item, line_total: Math.max(0, gross - lineDiscount(item)) };
}

/**
 * "quantities differ from each vessel so it has to be allowed to be
 * inputted by the person issuing and the price should come along when
 * the item is selected, but the person issuing should be able to change
 * the price if the need be and offer discount incase required" —
 * quantity, unit_price, and discount are all editable per line,
 * regardless of what the catalog said when the item was picked.
 *
 * Requested directly, later: "the invoice and quotation discount is
 * only accepting discount based on percentages, allow lumpsum discount
 * when need be" — discount_type picks which of discount_percent/
 * discount_amount is actually applied (see recompute above); both
 * values stay editable regardless of which is selected, so toggling
 * back to the other type doesn't lose whatever was typed into it.
 */
export default function LineItemsEditor({ lineItems, onChange }: Props) {
  function updateField(index: number, field: keyof LineItem, value: string) {
    const next = [...lineItems];
    const numeric = field === "quantity" || field === "unit_price" || field === "discount_percent" || field === "discount_amount";
    next[index] = recompute({ ...next[index], [field]: numeric ? Number(value) || 0 : value });
    onChange(next);
  }

  function updateDiscountType(index: number, discountType: DiscountType) {
    const next = [...lineItems];
    next[index] = recompute({ ...next[index], discount_type: discountType });
    onChange(next);
  }

  function removeLine(index: number) {
    onChange(lineItems.filter((_, i) => i !== index));
  }

  return (
    <table className="line-items-table">
      <thead>
        <tr>
          <th style={{ width: "11%" }}>Code</th>
          <th style={{ width: "28%" }}>Description</th>
          <th style={{ width: "9%" }}>Qty</th>
          <th style={{ width: "13%" }}>Unit Price</th>
          <th style={{ width: "19%" }}>Discount</th>
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
              <div className="line-discount-cell">
                <select
                  value={item.discount_type}
                  onChange={(e) => updateDiscountType(i, e.target.value as DiscountType)}
                  aria-label={`Discount type for line ${i + 1}`}
                >
                  <option value="percent">%</option>
                  <option value="amount">Flat</option>
                </select>
                {item.discount_type === "amount" ? (
                  <input
                    type="number" min="0" step="0.01"
                    value={item.discount_amount}
                    onChange={(e) => updateField(i, "discount_amount", e.target.value)}
                    aria-label={`Discount amount for line ${i + 1}`}
                  />
                ) : (
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={item.discount_percent}
                    onChange={(e) => updateField(i, "discount_percent", e.target.value)}
                    aria-label={`Discount percent for line ${i + 1}`}
                  />
                )}
              </div>
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
    discount_type: "percent",
    discount_percent: 0,
    discount_amount: 0,
    line_total: 0,
  });
}

export function computeTotals(lineItems: LineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discountTotal = lineItems.reduce((sum, item) => sum + lineDiscount(item), 0);
  return { subtotal, discountTotal, total: subtotal - discountTotal };
}
