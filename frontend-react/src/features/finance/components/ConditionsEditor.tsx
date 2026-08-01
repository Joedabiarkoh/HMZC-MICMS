import { DEFAULT_QUOTATION_CONDITIONS } from "../types/finance.types";

interface Props {
  conditions: string[];
  onChange: (next: string[]) => void;
}

/**
 * Requested directly: short condition bullets ("Overtime rate
 * applies...", "Client is responsible for technician's accommodation,
 * local transportation, and flights") that print beside the totals
 * block — editable per quotation, not a fixed admin-managed setting
 * like the Terms and Conditions legal text (which prints on invoices
 * instead). A new quotation starts with DEFAULT_QUOTATION_CONDITIONS
 * pre-filled (see QuotationForm.tsx); any of them can be edited or
 * removed here, and more can be added, including re-adding a suggested
 * one that was removed.
 */
export default function ConditionsEditor({ conditions, onChange }: Props) {
  function updateLine(i: number, value: string) {
    const next = [...conditions];
    next[i] = value;
    onChange(next);
  }

  function removeLine(i: number) {
    onChange(conditions.filter((_, idx) => idx !== i));
  }

  function addLine(text = "") {
    onChange([...conditions, text]);
  }

  const missingSuggested = DEFAULT_QUOTATION_CONDITIONS.filter((s) => !conditions.includes(s));

  return (
    <div>
      {conditions.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input value={c} onChange={(e) => updateLine(i, e.target.value)} style={{ flex: 1, padding: "6px 8px", border: "1px solid #C9D1D8", borderRadius: 5, fontSize: 12.5 }} />
          <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "3px 9px", fontSize: 11, color: "var(--insp-red)" }} onClick={() => removeLine(i)}>
            Remove
          </button>
        </div>
      ))}
      {conditions.length === 0 && (
        <p style={{ fontSize: 11.5, color: "var(--insp-muted)", marginTop: 0 }}>No conditions on this quotation.</p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <button type="button" className="finance-btn finance-btn-outline" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => addLine()}>
          + Add Condition
        </button>
        {missingSuggested.map((s) => (
          <button
            key={s}
            type="button"
            className="finance-btn finance-btn-outline"
            style={{ padding: "5px 12px", fontSize: 12 }}
            onClick={() => addLine(s)}
          >
            + {s.length > 40 ? s.slice(0, 40) + "…" : s}
          </button>
        ))}
      </div>
    </div>
  );
}
