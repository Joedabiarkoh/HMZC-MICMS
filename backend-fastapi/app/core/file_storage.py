import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

# Generic arbitrary-file storage — the multipart-upload counterpart to
# photo_storage.py's base64-data-URI handling. Used for invoice
# supporting documents (service reports, POs, delivery notes...) and
# Supplier Boarding form uploads: both are real files (PDF, .docx,
# .xlsx...) a browser <input type="file"> posts directly, not an image
# embedded in a JSON payload, so photo_storage.py's data-URI decode
# doesn't apply here.

_SAFE_EXT_RE = re.compile(r"^[A-Za-z0-9]{1,10}$")


def _sanitize_ext(filename: str) -> str:
    ext = Path(filename).suffix.lstrip(".")
    return ext if _SAFE_EXT_RE.match(ext) else "bin"


def _ensure_dir(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)


# Found during a security review: this was deliberately "content-type-
# agnostic" — ANY file, of any type, was accepted and stored under
# whatever extension the client's filename claimed, no matter what the
# actual bytes were. Already mitigated on the way back out — every
# download route serves these with X-Content-Type-Options: nosniff and
# Content-Disposition: attachment (see app/main.py), which stop a
# mismatched type from actually executing in a browser — so this is
# defense-in-depth on top of that, restricting what gets accepted (and
# stored) in the first place to the real documents/images this feature
# is actually for, matching the "service reports, POs, delivery notes,
# New Supplier Form" scope named in this module's own comment above.
#
# Two checks, not one: the extension has to be on the allowlist at all,
# AND — for the binary formats with a well-known signature — the
# file's own first bytes have to actually match what that extension
# claims. A file named "report.pdf" that isn't really a PDF (someone's
# renamed something else, deliberately or not) is rejected here rather
# than silently stored and served back under a misleading name. Plain-
# text formats (csv/txt) have no reliable signature to check, so those
# are accepted on extension alone — no meaningfully different from
# accepting any other short text file, and there's nothing a magic-byte
# check could catch there that nosniff + attachment-disposition doesn't
# already cover.
_MAGIC_BYTES: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF-",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "gif": (b"GIF87a", b"GIF89a"),
    # docx/xlsx/pptx are all ZIP containers — PK\x03\x04 only confirms
    # "this is really a ZIP," not which Office format specifically
    # (that would need parsing the zip's own [Content_Types].xml), but
    # that's enough to reject non-ZIP garbage claiming to be one.
    "docx": (b"PK\x03\x04",),
    "xlsx": (b"PK\x03\x04",),
    "pptx": (b"PK\x03\x04",),
    # Legacy Office formats (.doc/.xls/.ppt) share the same OLE
    # Compound File signature.
    "doc": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    "xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    "ppt": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    # WEBP has no entry in the tuple-of-prefixes shape every other
    # format above uses — see _matches_magic_bytes' own special case —
    # but is still listed here (value unused) so it's part of
    # _ALLOWED_EXTENSIONS without a separate parallel set to keep in sync.
    "webp": (),
}
_TEXT_EXTENSIONS = {"csv", "txt"}
_ALLOWED_EXTENSIONS = set(_MAGIC_BYTES) | _TEXT_EXTENSIONS


def _matches_magic_bytes(ext: str, raw: bytes) -> bool:
    # WEBP's real signature is split (RIFF....WEBP, with a 4-byte size
    # field in between) — doesn't fit the simple startswith-one-of-
    # these-prefixes check every other format uses, so it's handled as
    # its own case rather than forcing _MAGIC_BYTES' shape to support
    # two different kinds of signature for one format.
    if ext == "webp":
        return raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
    signatures = _MAGIC_BYTES.get(ext)
    if not signatures:
        return True  # no signature defined for this extension (csv/txt) — nothing to check
    return any(raw.startswith(sig) for sig in signatures)


def validate_upload_type(filename: str, raw: bytes) -> None:
    ext = _sanitize_ext(filename)
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'.{ext}' isn't an accepted file type. Allowed: {', '.join(sorted(_ALLOWED_EXTENSIONS))}.",
        )
    if not _matches_magic_bytes(ext, raw):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This file's content doesn't look like a real .{ext} file.",
        )


def save_upload(upload: UploadFile, directory: str, raw: bytes) -> str:
    """
    Writes `raw` (already-read bytes — see the size-limit check callers
    do before calling this) to `directory` under a fresh
    uuid-based name, keeping the original extension for a sane
    Content-Type guess on download. Returns the stored filename (never
    the original — collisions and path traversal are the whole reason
    this isn't just `upload.filename`).
    """
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(raw) > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File is too large — the limit is {max_mb:.0f} MB.")
    validate_upload_type(upload.filename or "", raw)

    ext = _sanitize_ext(upload.filename or "")
    stored_name = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex

    dir_path = Path(directory)
    _ensure_dir(dir_path)
    (dir_path / stored_name).write_bytes(raw)
    return stored_name


def delete_upload(directory: str, stored_filename: str) -> None:
    if "/" in stored_filename or "\\" in stored_filename or stored_filename in (".", ".."):
        return
    path = Path(directory) / stored_filename
    path.unlink(missing_ok=True)


def read_upload(directory: str, stored_filename: str) -> bytes:
    if "/" in stored_filename or "\\" in stored_filename or stored_filename in (".", ".."):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
    path = Path(directory) / stored_filename
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return path.read_bytes()
