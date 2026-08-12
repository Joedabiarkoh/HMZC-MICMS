// Requested directly: "using the USD as the main price, invoice can be
// issued in any currency, have a section to change currency" — USD plus
// the currencies HMZC actually deals with (Angola and Ghana explicitly
// named, EUR/GBP for other international customers). Matches
// ALLOWED_CURRENCIES in backend-fastapi's schemas/finance.py exactly —
// keep both lists in sync if this ever changes.
export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "AOA", label: "Angolan Kwanza", symbol: "Kz" },
  { code: "GHS", label: "Ghanaian Cedi", symbol: "GH₵" },
];

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code + " ";
}

// Every amount stored on a quotation/invoice (line items, subtotal,
// discount_total, total) is always USD — see models/finance_document.py's
// own comment for why. This is the single place that converts a stored
// USD figure to what should actually be PRINTED, given the document's
// own currency/exchange_rate (units of `currency` per 1 USD).
export function formatMoney(usdAmount: number, currency: string, exchangeRate: number): string {
  const symbol = currencySymbol(currency);
  const converted = usdAmount * (exchangeRate || 1);
  return `${symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
