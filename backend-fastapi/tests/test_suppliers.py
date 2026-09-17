"""
Requested directly, from a security review: suppliers.py had zero
test coverage. Follows test_certificates.py/test_auth.py's conventions.
"""

import io

# Requested directly, from a security review: uploads are now checked
# against a real magic-byte signature for the claimed extension (see
# core/file_storage.py's validate_upload_type) — plain placeholder text
# like b"content" no longer passes as a ".xlsx" file, so every test
# upload here needs to actually start with the ZIP signature docx/
# xlsx/pptx share.
_FAKE_XLSX_BYTES = b"PK\x03\x04" + b"pretend this is a filled-in xlsx form"


def _admin_create_and_login(client, admin_token, email, role):
    create = client.post(
        "/api/auth/users",
        json={"email": email, "full_name": email.split("@")[0], "role": role},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    temp_password = create.json()["temporary_password"]
    login = client.post("/api/auth/login", data={"username": email, "password": temp_password})
    return login.json()["access_token"]


def test_boarding_template_requires_supplier_view_permission(client, admin_token):
    """Inspector has neither suppliers.view nor suppliers.manage by
    default (see core/permissions.py's ROLE_DEFAULT_PERMISSIONS)."""
    inspector_token = _admin_create_and_login(client, admin_token, "noaccess@hmzc-test.com", "inspector")
    response = client.get(
        "/api/suppliers/boarding-template",
        headers={"Authorization": f"Bearer {inspector_token}"},
    )
    assert response.status_code == 403


def test_boarding_template_downloads_successfully(client, admin_token):
    response = client.get(
        "/api/suppliers/boarding-template",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text
    assert len(response.content) > 0


def test_upload_and_download_boarding_submission_roundtrip(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    file_bytes = _FAKE_XLSX_BYTES
    upload_response = client.post(
        "/api/suppliers/boarding",
        data={"supplier_name": "Acme Marine Supplies", "notes": "Reviewed and approved"},
        files={"file": ("filled_form.xlsx", io.BytesIO(file_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    assert upload_response.status_code == 201, upload_response.text
    submission = upload_response.json()
    assert submission["supplier_name"] == "Acme Marine Supplies"
    assert submission["original_filename"] == "filled_form.xlsx"

    list_response = client.get("/api/suppliers/boarding", headers=headers)
    assert any(s["id"] == submission["id"] for s in list_response.json())

    download_response = client.get(f"/api/suppliers/boarding/{submission['id']}/download", headers=headers)
    assert download_response.status_code == 200, download_response.text
    assert download_response.content == file_bytes


def test_view_only_role_can_download_but_not_upload_or_delete(client, admin_token):
    """Sales gets suppliers.view but not suppliers.manage (see
    ROLE_DEFAULT_PERMISSIONS) — real day-to-day access, not a role
    that happens to be missing this feature entirely."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    uploaded = client.post(
        "/api/suppliers/boarding",
        data={"supplier_name": "View Only Test Co", "notes": ""},
        files={"file": ("form.xlsx", io.BytesIO(_FAKE_XLSX_BYTES), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=admin_headers,
    )
    submission_id = uploaded.json()["id"]

    sales_token = _admin_create_and_login(client, admin_token, "viewonly@hmzc-test.com", "sales")
    sales_headers = {"Authorization": f"Bearer {sales_token}"}

    # Can see and download an existing submission.
    list_response = client.get("/api/suppliers/boarding", headers=sales_headers)
    assert list_response.status_code == 200
    download_response = client.get(f"/api/suppliers/boarding/{submission_id}/download", headers=sales_headers)
    assert download_response.status_code == 200

    # Cannot upload a new one or delete this one.
    upload_response = client.post(
        "/api/suppliers/boarding",
        data={"supplier_name": "Should Not Work", "notes": ""},
        files={"file": ("form.xlsx", io.BytesIO(_FAKE_XLSX_BYTES), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=sales_headers,
    )
    assert upload_response.status_code == 403
    delete_response = client.delete(f"/api/suppliers/boarding/{submission_id}", headers=sales_headers)
    assert delete_response.status_code == 403


def test_delete_boarding_submission_removes_it(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    uploaded = client.post(
        "/api/suppliers/boarding",
        data={"supplier_name": "Delete Me Co", "notes": ""},
        files={"file": ("form.xlsx", io.BytesIO(_FAKE_XLSX_BYTES), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    submission_id = uploaded.json()["id"]

    delete_response = client.delete(f"/api/suppliers/boarding/{submission_id}", headers=headers)
    assert delete_response.status_code == 204

    download_response = client.get(f"/api/suppliers/boarding/{submission_id}/download", headers=headers)
    assert download_response.status_code == 404
