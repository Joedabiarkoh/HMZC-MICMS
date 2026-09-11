import { DiscountType } from "../types/finance.types";

interface Props {
  discountType: DiscountType;
  discountPercent: number;
  discountAmount: number;
  onChange: (patch: { discountType?: DiscountType; discountPercent?: number; discountAmount?: number }) => void;
  disabled?: boolean;
}

/**
 * Requested directly: "can we make the discount lumpsum for all the
 * invoice and not each line item" — one discount applied to the whole
 * document (see computeDocumentTotals in LineItemsEditor.tsx), shared
 * between InvoiceForm.tsx and QuotationForm.tsx so the two don't grow
 * duplicated copies of the same %/Flat selector LineItemsEditor.tsx's
 * per-line discount cell already established the pattern for.
 */
export default function OverallDiscountField({ discountType, discountPercent, discountAmount, onChange, disabled }: Props) {
  return (
    <div className="finance-field">
      <label htmlFor="overall-discount-value">Overall Discount</label>
      <div className="line-discount-cell">
        <select
          id="overall-discount-type"
          value={discountType}
          onChange={(e) => onChange({ discountType: e.target.value as DiscountType })}
          disabled={disabled}
          aria-label="Overall discount type"
        >
          <option value="percent">%</option>
          <option value="amount">Flat</option>
        </select>
        {discountType === "amount" ? (
          <input
            id="overall-discount-value"
            type="number" min="0" step="0.01"
            value={discountAmount}
            onChange={(e) => onChange({ discountAmount: Number(e.target.value) || 0 })}
            disabled={disabled}
          />
        ) : (
          <input
            id="overall-discount-value"
            type="number" min="0" max="100" step="0.1"
            value={discountPercent}
            onChange={(e) => onChange({ discountPercent: Number(e.target.value) || 0 })}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
