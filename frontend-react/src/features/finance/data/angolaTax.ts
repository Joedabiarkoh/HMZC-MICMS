// Angolan tax on Kwanza (AOA) invoices — mirrors backend core/angola_tax.py.
//  * IVA: 14% general; 7% and 5% reduced; 0% exports / exempt.
//  * Withholding (retenção na fonte, Imposto Industrial): 6.5% on SERVICES,
//    deducted by the customer, calculated on the value before IVA.
export const TAX_CURRENCY = "AOA";
export const IVA_RATES = [14, 7, 5, 0] as const;
export const DEFAULT_IVA_RATE = 14;
export const DEFAULT_WITHHOLDING_RATE = 6.5;
export type TaxNature = "service" | "supply";

const r2 = (x: number) => Math.round((x + 1e-9) * 100) / 100;

export interface TaxBreakdown {
  base: number;
  iva: number;
  gross: number;
  withheld: number;
  netPayable: number;
}

export function computeTax(base: number, ivaRate: number, withholdingRate: number): TaxBreakdown {
  const iva = r2((base * ivaRate) / 100);
  const gross = r2(base + iva);
  const withheld = r2((base * withholdingRate) / 100);
  return { base: r2(base), iva, gross, withheld, netPayable: r2(gross - withheld) };
}

export const ivaLabel = (rate: number) =>
  rate === 14 ? "14% — standard" : rate === 0 ? "0% — export / exempt" : `${rate}% — reduced`;
