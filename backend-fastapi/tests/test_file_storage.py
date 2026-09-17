"""
Requested directly, from a security review: uploaded attachments
(invoice supporting documents, Supplier Boarding forms) previously
accepted ANY file type with no validation at all. See
core/file_storage.py's validate_upload_type for the fix and its own
reasoning (already mitigated on the way back out by nosniff +
Content-Disposition: attachment — this is defense-in-depth on top of
that, not the only thing standing between this app and a malicious
upload). Pure unit tests against the function directly, no HTTP client
needed — tests/test_suppliers.py and tests/test_finance.py separately
confirm the actual upload ROUTES reject a bad file too, not just that
this function works in isolation.
"""
import pytest
from fastapi import HTTPException

from app.core.file_storage import validate_upload_type

_REAL_PDF_BYTES = b"%PDF-1.4\n%..." + b"0" * 20
_REAL_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 20
_REAL_JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"0" * 20
_REAL_GIF_BYTES = b"GIF89a" + b"0" * 20
_REAL_ZIP_BASED_OFFICE_BYTES = b"PK\x03\x04" + b"0" * 20  # docx/xlsx/pptx all share this
_REAL_LEGACY_OFFICE_BYTES = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"0" * 20  # doc/xls/ppt
_REAL_WEBP_BYTES = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"0" * 20


@pytest.mark.parametrize(
    "filename,raw",
    [
        ("report.pdf", _REAL_PDF_BYTES),
        ("photo.png", _REAL_PNG_BYTES),
        ("photo.jpg", _REAL_JPEG_BYTES),
        ("photo.jpeg", _REAL_JPEG_BYTES),
        ("photo.gif", _REAL_GIF_BYTES),
        ("photo.webp", _REAL_WEBP_BYTES),
        ("form.docx", _REAL_ZIP_BASED_OFFICE_BYTES),
        ("prices.xlsx", _REAL_ZIP_BASED_OFFICE_BYTES),
        ("slides.pptx", _REAL_ZIP_BASED_OFFICE_BYTES),
        ("old_form.doc", _REAL_LEGACY_OFFICE_BYTES),
        ("old_prices.xls", _REAL_LEGACY_OFFICE_BYTES),
        ("notes.txt", b"just plain text, no signature to check"),
        ("data.csv", b"col1,col2\nval1,val2"),
    ],
)
def test_valid_file_matching_its_extension_is_accepted(filename, raw):
    validate_upload_type(filename, raw)  # doesn't raise


def test_disallowed_extension_rejected():
    with pytest.raises(HTTPException) as exc_info:
        validate_upload_type("script.exe", b"MZ" + b"0" * 20)
    assert exc_info.value.status_code == 400
    assert "exe" in exc_info.value.detail.lower()


def test_no_extension_rejected():
    with pytest.raises(HTTPException) as exc_info:
        validate_upload_type("noextension", b"whatever")
    assert exc_info.value.status_code == 400


def test_mismatched_content_rejected_even_with_allowed_extension():
    """
    The actual scenario this whole check exists for: a file claiming
    to be a real document type (an allowed extension) whose bytes
    don't actually match — renamed, deliberately or not, rather than
    an obviously-disallowed type like .exe.
    """
    with pytest.raises(HTTPException) as exc_info:
        validate_upload_type("totally_a_real.pdf", b"<html><script>alert(1)</script></html>")
    assert exc_info.value.status_code == 400
    assert "pdf" in exc_info.value.detail.lower()


def test_mismatched_zip_based_office_type_rejected():
    with pytest.raises(HTTPException):
        validate_upload_type("fake.xlsx", b"this is not a zip file at all")


def test_mismatched_webp_rejected():
    with pytest.raises(HTTPException):
        # Starts with RIFF (a real container format prefix) but the
        # inner four-character code isn't WEBP — confirms the split-
        # signature check actually looks at both parts, not just RIFF.
        validate_upload_type("fake.webp", b"RIFF\x00\x00\x00\x00AVI " + b"0" * 20)
