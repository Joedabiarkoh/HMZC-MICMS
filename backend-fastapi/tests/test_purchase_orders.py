"""
Purchase orders: numbering, the write -> approve -> send -> receive -> close
life cycle, who may approve, what editing an approved PO does, deletion
rules, vendor suggestions, attachments and the PDF.
"""
import io


def _make_user(client, admin_token, email, role, extra_permissions=None):
    """Creates an account as the admin and returns (auth headers, user id)."""
    admin = {"Authorization": f"Bearer {admin_token}"}
    create = client.post("/api/auth/users", json={"email": email, "full_name": email.split("@")[0], "role": role}, headers=admin)
    assert create.status_code in (200, 201), create.text
    body = create.json()
    user_id = body.get("id") or body["user"]["id"]
    if extra_permissions:
        r = client.patch(f"/api/auth/users/{user_id}/permissions", json={"extra_permissions": extra_permissions}, headers=admin)
        assert r.status_code == 200, r.text
    login = client.post("/api/auth/login", data={"username": email, "password": body["temporary_password"]})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, user_id


def _payload(**overrides):
    payload = {
        "vendor_name": "Advanced Fire Global (Pty) Ltd",
        "vendor_vat": "459 027 7994",
        "currency": "ZAR",
        "quote_ref": "Q1 009 214",
        "subject": "Foam testing per attached pro-forma",
        "delivery_address": "MZC Office, Bairro Cabassango, Cabinda",
        "line_items": [
            {"code": "FT-1", "description": "Foam Testing per/sample 1L", "quantity": 1, "unit": "ea", "unit_price": 1827.0, "line_total": 1827.0}
        ],
        "subtotal": 1827.0,
        "total": 1827.0,
        "written_by_title": "Procurement Supervisor",
    }
    payload.update(overrides)
    return payload


def _create(client, headers, **overrides):
    r = client.post("/api/purchase-orders", json=_payload(**overrides), headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _act(client, headers, po, action, **extra):
    return client.post(f"/api/purchase-orders/{po['po_no']}/transition", json={"action": action, "version": po["version"], **extra}, headers=headers)


def _admin(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ------------------------------------------------------------- numbering

def test_new_po_is_numbered_by_year_and_continues(client, admin_token):
    h = _admin(admin_token)
    a = _create(client, h)
    b = _create(client, h)
    yy = a["po_no"].split("-")[0]
    assert len(yy) == 2 and a["po_no"] == f"{yy}-0001" and b["po_no"] == f"{yy}-0002"
    assert a["status"] == "draft" and a["revision"] == 1


def test_a_legacy_number_can_be_entered_and_numbering_continues_after_it(client, admin_token):
    h = _admin(admin_token)
    legacy = _create(client, h, po_no="25-0022")
    assert legacy["po_no"] == "25-0022"
    # a number from another year doesn't disturb this year's sequence
    new = _create(client, h)
    assert new["po_no"].endswith("-0001")
    assert client.post("/api/purchase-orders", json=_payload(po_no="BAD/NO"), headers=h).status_code == 400


# ---------------------------------------------------------------- totals

def test_totals_are_checked_against_the_lines(client, admin_token):
    h = _admin(admin_token)
    r = client.post("/api/purchase-orders", json=_payload(total=1.0, subtotal=1.0), headers=h)
    assert r.status_code == 400
    r = client.post("/api/purchase-orders", json=_payload(line_items=[]), headers=h)
    assert r.status_code == 400
    bad_line = _payload()
    bad_line["line_items"][0]["line_total"] = 5.0
    assert client.post("/api/purchase-orders", json=bad_line, headers=h).status_code == 400


# ------------------------------------------------------------- lifecycle

def test_full_lifecycle_with_a_separate_approver(client, admin_token):
    writer, _ = _make_user(client, admin_token, "writer@hmzc-test.com", "finance")
    approver, _ = _make_user(client, admin_token, "director@hmzc-test.com", "finance", ["finance.po_approve"])

    po = _create(client, writer)
    po = _act(client, writer, po, "submit").json()
    assert po["status"] == "pending_approval"

    po = _act(client, approver, po, "approve", title="Director Manager").json()
    assert po["status"] == "approved"
    assert po["approved_by_name"] == "director" and po["approved_by_title"] == "Director Manager"
    assert po["written_by_name"] == "writer" and po["written_by_title"] == "Procurement Supervisor"

    po = _act(client, writer, po, "send").json()
    assert po["status"] == "sent" and po["sent_at"]
    po = _act(client, writer, po, "receive", received_date="2026-12-01").json()
    assert po["status"] == "received" and po["received_at"] == "2026-12-01"
    po = _act(client, writer, po, "close").json()
    assert po["status"] == "closed"
    # a closed PO is final
    assert _act(client, writer, po, "cancel", reason="oops").status_code == 400


def test_only_a_holder_of_the_approve_permission_can_approve(client, admin_token):
    writer, _ = _make_user(client, admin_token, "writer2@hmzc-test.com", "finance")
    po = _act(client, writer, _create(client, writer), "submit").json()
    r = _act(client, writer, po, "approve", title="Procurement Supervisor")
    assert r.status_code == 403


def test_writer_cannot_approve_own_po_but_an_admin_can(client, admin_token):
    h = _admin(admin_token)
    po = _act(client, h, _create(client, h), "submit").json()
    assert _act(client, h, po, "approve").status_code == 400  # needs a position title
    r = _act(client, h, po, "approve", title="Director Manager")
    assert r.status_code == 200, r.text

    both, _ = _make_user(client, admin_token, "both@hmzc-test.com", "finance", ["finance.po_approve"])
    own = _act(client, both, _create(client, both), "submit").json()
    assert _act(client, both, own, "approve", title="Boss").status_code == 403


def test_returning_a_po_needs_a_reason_and_makes_it_a_draft_again(client, admin_token):
    writer, _ = _make_user(client, admin_token, "writer3@hmzc-test.com", "finance")
    approver, _ = _make_user(client, admin_token, "director3@hmzc-test.com", "finance", ["finance.po_approve"])
    po = _act(client, writer, _create(client, writer), "submit").json()
    assert _act(client, approver, po, "return").status_code == 400
    po = _act(client, approver, po, "return", reason="Wrong vendor").json()
    assert po["status"] == "draft" and po["return_reason"] == "Wrong vendor"


def test_steps_cannot_be_skipped(client, admin_token):
    h = _admin(admin_token)
    po = _create(client, h)
    for action in ("approve", "send", "receive", "close"):
        assert _act(client, h, po, action, title="x").status_code == 400, action


# --------------------------------------------------------- edit after approval

def test_editing_an_approved_po_cancels_the_approval_and_bumps_the_revision(client, admin_token):
    h = _admin(admin_token)
    po = _act(client, h, _create(client, h), "submit").json()
    po = _act(client, h, po, "approve", title="Director Manager").json()
    assert po["revision"] == 1

    edited = client.post(
        "/api/purchase-orders",
        json=_payload(po_no=po["po_no"], version=po["version"], delivery_terms="DAP Cabinda"),
        headers=h,
    )
    assert edited.status_code == 200, edited.text
    body = edited.json()
    assert body["status"] == "draft" and body["revision"] == 2
    assert body["approved_by_name"] is None and body["approved_at"] is None
    assert body["delivery_terms"] == "DAP Cabinda"


def test_stale_version_is_rejected(client, admin_token):
    h = _admin(admin_token)
    po = _create(client, h)
    ok = client.post("/api/purchase-orders", json=_payload(po_no=po["po_no"], version=po["version"], subject="one"), headers=h)
    assert ok.status_code == 200
    stale = client.post("/api/purchase-orders", json=_payload(po_no=po["po_no"], version=po["version"], subject="two"), headers=h)
    assert stale.status_code == 409


def test_someone_elses_po_cannot_be_edited_by_a_non_admin(client, admin_token):
    h = _admin(admin_token)
    po = _create(client, h)
    other, _ = _make_user(client, admin_token, "other@hmzc-test.com", "finance")
    r = client.post("/api/purchase-orders", json=_payload(po_no=po["po_no"], version=po["version"]), headers=other)
    assert r.status_code == 403


# ------------------------------------------------------------ cancel/delete

def test_cancel_needs_a_reason_and_only_draft_or_cancelled_can_be_deleted(client, admin_token):
    h = _admin(admin_token)
    po = _act(client, h, _create(client, h), "submit").json()
    po = _act(client, h, po, "approve", title="Director Manager").json()
    assert client.delete(f"/api/purchase-orders/{po['po_no']}", headers=h).status_code == 400
    assert _act(client, h, po, "cancel").status_code == 400
    po = _act(client, h, po, "cancel", reason="Vendor withdrew the quote").json()
    assert po["status"] == "cancelled" and po["cancel_reason"] == "Vendor withdrew the quote"
    assert client.delete(f"/api/purchase-orders/{po['po_no']}", headers=h).status_code == 204
    assert client.get(f"/api/purchase-orders/{po['po_no']}", headers=h).status_code == 404


def test_overdue_flag(client, admin_token):
    h = _admin(admin_token)
    po = _create(client, h, delivery_date="2020-01-01")
    assert po["is_overdue"] is False  # a draft isn't waiting for delivery
    po = _act(client, h, po, "submit").json()
    po = _act(client, h, po, "approve", title="Director Manager").json()
    assert po["is_overdue"] is True
    po = _act(client, h, po, "receive").json()
    assert po["is_overdue"] is False


# ------------------------------------------------------------- vendors etc.

def test_vendor_suggestions_come_from_past_pos_and_boarded_suppliers(client, admin_token):
    h = _admin(admin_token)
    _create(client, h)
    client.post(
        "/api/suppliers/boarding",
        data={"supplier_name": "Acme Marine Supplies", "notes": ""},
        files={"file": ("form.xlsx", io.BytesIO(b"PK\x03\x04 form"), "application/octet-stream")},
        headers=h,
    )
    vendors = {v["name"]: v for v in client.get("/api/purchase-orders/vendors", headers=h).json()}
    assert vendors["Advanced Fire Global (Pty) Ltd"]["vat"] == "459 027 7994"
    assert vendors["Advanced Fire Global (Pty) Ltd"]["source"] == "purchase_order"
    assert vendors["Acme Marine Supplies"]["source"] == "supplier_boarding"
    assert vendors["Acme Marine Supplies"]["vat"] is None


def test_attachment_roundtrip(client, admin_token):
    h = _admin(admin_token)
    po = _create(client, h)
    up = client.post(
        f"/api/purchase-orders/{po['po_no']}/attachments",
        data={"label": "Vendor Quote"},
        files={"file": ("quote.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        headers=h,
    )
    assert up.status_code == 201, up.text
    att = up.json()
    assert att["label"] == "Vendor Quote"
    down = client.get(f"/api/purchase-orders/{po['po_no']}/attachments/{att['id']}/download", headers=h)
    assert down.content == b"%PDF-1.4 fake"
    assert client.get("/api/purchase-orders", headers=h).json()[0]["attachment_count"] == 1
    assert client.delete(f"/api/purchase-orders/{po['po_no']}/attachments/{att['id']}", headers=h).status_code == 204


def test_pdf_has_the_po_and_the_terms_page(client, admin_token):
    h = _admin(admin_token)
    po = _create(client, h)
    r = client.get(f"/api/purchase-orders/{po['po_no']}/pdf", headers=h)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(r.content))
    assert len(reader.pages) >= 2
    first = reader.pages[0].extract_text()
    assert po["po_no"] in first and "Advanced Fire Global" in first and "NIF: 5001114387" in first
    assert "1,827.00" in first
    assert "Acceptance" in "".join(p.extract_text() for p in reader.pages[1:])


def test_finance_view_only_user_cannot_create(client, admin_token):
    limited, _ = _make_user(client, admin_token, "viewer@hmzc-test.com", "limited_admin")
    assert client.get("/api/purchase-orders", headers=limited).status_code == 200
    assert client.post("/api/purchase-orders", json=_payload(), headers=limited).status_code == 403
