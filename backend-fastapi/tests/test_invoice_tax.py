"""Angolan tax on Kwanza invoices (core/angola_tax.py)."""
import io

from pypdf import PdfReader

from app.core.angola_tax import compute_tax, normalise_tax_fields
from tests.test_finance import _invoice_payload


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def test_compute_tax_14_percent_iva_with_withholding():
    tx = compute_tax(180.0, 14.0, 6.5)
    assert tx == {"base": 180.0, "iva": 25.2, "gross": 205.2, "withheld": 11.7, "net_payable": 193.5}


def test_withholding_is_calculated_on_the_base_not_on_iva_inclusive_total():
    tx = compute_tax(1000.0, 14.0, 6.5)
    assert tx["withheld"] == 65.0 and tx["net_payable"] == 1075.0


def test_normalise_drops_tax_outside_kwanza_and_withholding_on_supply():
    assert normalise_tax_fields("USD", "service", 14.0, 6.5) == ("service", 0.0, 0.0)
    assert normalise_tax_fields("AOA", "supply", 14.0, 6.5) == ("supply", 14.0, 0.0)
    assert normalise_tax_fields("AOA", "service", 14.0, 6.5) == ("service", 14.0, 6.5)


def test_aoa_invoice_stores_tax_fields(client, admin_token):
    r = client.post("/api/finance/invoices", json=_invoice_payload(
        "INV-TAX-1", currency="AOA", tax_nature="service", iva_rate=14, withholding_rate=6.5), headers=_h(admin_token))
    assert r.status_code == 200, r.text
    b = r.json()
    assert (b["tax_nature"], b["iva_rate"], b["withholding_rate"]) == ("service", 14.0, 6.5)


def test_usd_invoice_ignores_tax_fields(client, admin_token):
    r = client.post("/api/finance/invoices", json=_invoice_payload(
        "INV-TAX-2", iva_rate=14, withholding_rate=6.5), headers=_h(admin_token))
    assert r.status_code == 200, r.text
    assert r.json()["iva_rate"] == 0.0 and r.json()["withholding_rate"] == 0.0


def test_supply_invoice_never_withholds(client, admin_token):
    r = client.post("/api/finance/invoices", json=_invoice_payload(
        "INV-TAX-3", currency="AOA", tax_nature="supply", iva_rate=14, withholding_rate=6.5), headers=_h(admin_token))
    assert r.status_code == 200, r.text
    assert r.json()["withholding_rate"] == 0.0


def test_invalid_iva_rate_is_rejected(client, admin_token):
    r = client.post("/api/finance/invoices", json=_invoice_payload(
        "INV-TAX-4", currency="AOA", iva_rate=10), headers=_h(admin_token))
    assert r.status_code == 422


def test_aoa_pdf_shows_iva_withholding_and_net_payable(client, admin_token):
    h = _h(admin_token)
    client.post("/api/finance/invoices", json=_invoice_payload(
        "INV-TAX-5", currency="AOA", iva_rate=14, withholding_rate=6.5), headers=h)
    r = client.get("/api/finance/invoices/INV-TAX-5/pdf", headers=h)
    assert r.status_code == 200, r.text
    text = " ".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
    assert "IVA 14%" in text and "Net payable" in text and "Withholding 6.5%" in text
    assert "205.20" in text and "193.50" in text
