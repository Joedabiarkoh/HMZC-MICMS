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
# doesn't apply here. Deliberately content-type-agnostic — this isn't
# image-only the way photo_storage.py is.

_SAFE_EXT_RE = re.compile(r"^[A-Za-z0-9]{1,10}$")


def _sanitize_ext(filename: str) -> str:
    ext = Path(filename).suffix.lstrip(".")
    return ext if _SAFE_EXT_RE.match(ext) else "bin"


def _ensure_dir(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)


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
