import { useEffect, useState } from "react";
import { FinanceItem } from "../types/finance.types";
import { listFinanceItems } from "../services/finance.api";

interface Props {
  onSelect: (item: FinanceItem) => void;
}

/**
 * "When issuing an invoice you can just select them" — searches the
 * backend catalog (never a hardcoded list, see finance.api.ts's
 * listFinanceItems) by code or name, and hands the selected item back
 * to the parent, which adds it as a new line with the catalog price
 * pre-filled (still editable — see LineItemsEditor).
 */
export default function ItemPicker({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFinanceItems()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || (item.category || "").toLowerCase().includes(q);
  });

  function pick(item: FinanceItem) {
    onSelect(item);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="item-picker">
      <input
        type="text"
        placeholder={loading ? "Loading catalog..." : "Search item by code, name, or category..."}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={loading}
      />
      {open && filtered.length > 0 && (
        <div className="item-picker-results">
          {filtered.slice(0, 30).map((item) => (
            <div key={item.id} className="item-picker-result" onMouseDown={() => pick(item)}>
              <span><span className="code">{item.code}</span>{item.name}</span>
              <span className="price">${item.unit_price.toFixed(2)}{item.unit ? ` / ${item.unit}` : ""}</span>
            </div>
          ))}
        </div>
      )}
      {open && !loading && filtered.length === 0 && (
        <div className="item-picker-results">
          <div className="item-picker-result" style={{ color: "var(--insp-muted)", cursor: "default" }}>No matching items in the catalog.</div>
        </div>
      )}
    </div>
  );
}
