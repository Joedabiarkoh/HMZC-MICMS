"""
Requested directly: "add server-side total verification for invoices"
— see core/finance_totals.py for what it closes (nothing previously
stopped a client from saving an invoice whose stored subtotal/
discount_total/total simply didn't match its own line items). These
tests exercise that check directly, against a real request/response
round-trip — not just the pure computation function in isolation —
since the actual gap was in the route wiring, not the math itself.
"""


def _invoice_payload(invoice_no="INV/HMZC/TEST-001", version=None, **overrides):
    payload = {
        "invoice_no": invoice_no,
        "customer": "Test Customer",
        "vessel_name": "MV Test Vessel",
        "imo_no": "1234567",
        "status": "draft",
        "line_items": [
            {
                "code": "ITM-1",
                "description": "Test Item",
                "quantity": 2,
                "unit_price": 100.0,
                "discount_type": "percent",
                "discount_percent": 10,
                "discount_amount": 0,
                "line_total": 180.0,  # (2 * 100) - 10% = 180
            }
        ],
        "subtotal": 200.0,
        "overall_discount_type": "percent",
        "overall_discount_percent": 0,
        "overall_discount_amount": 0,
        "discount_total": 20.0,
        "total": 180.0,
        "currency": "USD",
        "exchange_rate": 1.0,
    }
    if version is not None:
        payload["version"] = version
    payload.update(overrides)
    return payload


def test_invoice_with_correct_totals_saves(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post("/api/finance/invoices", json=_invoice_payload(), headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["subtotal"] == 200.0
    assert body["discount_total"] == 20.0
    assert body["total"] == 180.0


def test_invoice_with_wrong_total_is_rejected(client, admin_token):
    """
    The exact scenario the security review flagged: line items that
    sum to $180 (after a 10% line discount), but the client claims the
    total is $1 — a stand-in for either a compromised/malicious
    finance.edit account or a buggy client, both of which should be
    rejected rather than silently trusted.
    """
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(
        "/api/finance/invoices",
        json=_invoice_payload(total=1.0),
        headers=headers,
    )
    assert response.status_code == 400, response.text
    assert "total" in response.json()["detail"].lower()


def test_invoice_with_wrong_subtotal_is_rejected(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(
        "/api/finance/invoices",
        json=_invoice_payload(subtotal=99999.0),
        headers=headers,
    )
    assert response.status_code == 400, response.text
    assert "subtotal" in response.json()["detail"].lower()


def test_invoice_with_flat_lumpsum_line_discount(client, admin_token):
    """Covers the other half of the same computation: discount_type ==
    "amount" (a flat currency discount on one line) rather than percent."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = _invoice_payload(
        invoice_no="INV/HMZC/TEST-002",
        line_items=[
            {
                "code": "ITM-1",
                "description": "Test Item",
                "quantity": 2,
                "unit_price": 100.0,
                "discount_type": "amount",
                "discount_percent": 0,
                "discount_amount": 15.0,
                "line_total": 185.0,  # (2 * 100) - 15 flat = 185
            }
        ],
        subtotal=200.0,
        discount_total=15.0,
        total=185.0,
    )
    response = client.post("/api/finance/invoices", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 185.0


def test_invoice_with_overall_document_discount(client, admin_token):
    """Covers the document-level lump-sum discount stacking on top of
    the line-item discount — see computeDocumentTotals's own comment
    in LineItemsEditor.tsx, mirrored server-side in finance_totals.py."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = _invoice_payload(
        invoice_no="INV/HMZC/TEST-003",
        overall_discount_type="amount",
        overall_discount_amount=30.0,
        # line items alone: 200 - 20 (10% line discount) = 180 left,
        # then a flat $30 overall discount on top -> 150 total.
        discount_total=50.0,
        total=150.0,
    )
    response = client.post("/api/finance/invoices", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 150.0
