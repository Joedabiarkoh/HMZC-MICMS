// Parses a number a technician typed into a free-text field ("1,250",
// "75,5", "1 250.5 kg", "100 GPM"). Returns null — never 0 — when there
// is nothing numeric in it, so a blank or garbled entry can't silently
// become a zero that feeds into a calculated test load or error figure.
//
// Comma handling: a comma followed by exactly three digits and then the
// end of the number ("1,250", "12,345,678") is a thousands separator;
// any other comma ("75,5", "0,25") is a decimal comma. Craft and person
// masses are never fractions of a kilogram in the thousands, so the
// ambiguous "1,250" is read as 1250 rather than 1.25.
export function parseNumber(v: string | undefined | null): number | null {
  if (v == null) return null;
  let s = String(v).trim().replace(/\s+/g, "");
  const m = s.match(/^[+-]?[\d.,]+/);
  if (!m) return null;
  s = m[0];
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
