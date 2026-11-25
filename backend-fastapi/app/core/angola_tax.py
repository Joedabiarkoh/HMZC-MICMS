"""Angolan tax on Kwanza (AOA) invoices.

* IVA (Imposto sobre o Valor Acrescentado): general rate 14%; reduced 7% and
  5% (certain goods/services); 0% for exports; "isento" is also 0.
* Retenção na fonte (withholding, Imposto Industrial): 6.5% on services paid
  to a resident provider. It is deducted by the CUSTOMER from the amount it
  pays, and is calculated on the value before IVA. It does not apply to the
  supply of goods, and is suspended for some taxpayer groups, so the invoice
  only applies it when the issuer ticks it on.

Tax is only calculated on AOA invoices; every other currency keeps the plain
subtotal/discount/total block.
"""
from typing import Optional

TAX_CURRENCY = "AOA"
IVA_RATES = (0.0, 5.0, 7.0, 14.0)
DEFAULT_IVA_RATE = 14.0
DEFAULT_WITHHOLDING_RATE = 6.5
TAX_NATURES = ("service", "supply")


def _r2(x: float) -> float:
    return round(x + 1e-9, 2)


def compute_tax(base: float, iva_rate: float, withholding_rate: float) -> dict:
    """`base` is the invoice total after discounts, in AOA, before IVA."""
    iva = _r2(base * iva_rate / 100)
    gross = _r2(base + iva)
    withheld = _r2(base * withholding_rate / 100)
    return {"base": _r2(base), "iva": iva, "gross": gross, "withheld": withheld, "net_payable": _r2(gross - withheld)}


def normalise_tax_fields(currency: str, nature: Optional[str], iva_rate: float, withholding_rate: float) -> tuple[str, float, float]:
    """Tax only exists on AOA invoices, and withholding only on services."""
    nature = nature if nature in TAX_NATURES else "service"
    if currency != TAX_CURRENCY:
        return nature, 0.0, 0.0
    if nature != "service":
        withholding_rate = 0.0
    return nature, iva_rate, withholding_rate
