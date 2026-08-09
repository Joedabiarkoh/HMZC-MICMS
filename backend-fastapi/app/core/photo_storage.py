import base64
import binascii
import re
import uuid
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.core.config import settings

# Certificates carry photo evidence and hand-drawn signatures as base64
# data URIs inside their payload JSON (see PhotoUpload.tsx and the
# signature-capture canvas on the frontend) — simplest thing that could
# work when this was built, but it means every photo bloats the
# `certificates.payload` column directly: a single lifeboat inspection
# needs 6+ photos, each still tens to low-hundreds of KB even compressed,
# multiplied by every certificate ever issued. That's real database size
# (and therefore backup size/time) for something that doesn't need to be
# *in* the database at all — a file on disk works exactly as well and is
# far cheaper to store, back up, and eventually move to object storage.
#
# This intentionally works entirely server-side, on the payload the
# frontend already sends, rather than changing the frontend's capture/
# upload flow — the offline sync queue (src/offline/) stores and replays
# the *whole* certificate object, base64 photos included, and that
# machinery works correctly today. Touching it to upload photos
# separately would risk breaking offline capture for a marine technician
# on a vessel with no signal, which is the exact scenario that queue
# exists for. Instead, save_certificate() below hands the incoming
# payload to externalize_photos() before it's stored, and the frontend
# never needs to know the difference — it gets a URL back where it sent
# a data URI, and an <img src="the URL"> works identically either way.

PHOTOS_DIR = Path(settings.PHOTOS_DIR)
PHOTO_URL_PATH = "/api/photos/"


def _photo_url_prefix() -> str:
    # Absolute when PUBLIC_BASE_URL is set (frontend and backend are two
    # separate origins, e.g. Railway), relative otherwise (local Docker
    # Compose, where the frontend's own nginx proxies /api/ same-origin).
    # Computed per-call rather than once at import time so a settings
    # change doesn't need a process restart to take effect... though in
    # practice it always does anyway (settings is a single instance built
    # at startup) — kept as a function for the docstring/name to stay next
    # to where it's used, not because the value can actually change live.
    if settings.PUBLIC_BASE_URL:
        return f"{settings.PUBLIC_BASE_URL.rstrip('/')}{PHOTO_URL_PATH}"
    return PHOTO_URL_PATH

_DATA_URI_RE = re.compile(r"^data:image/(?P<subtype>[a-zA-Z0-9.+-]+);base64,(?P<data>.+)$", re.DOTALL)

_SUBTYPE_TO_EXT = {
    "jpeg": "jpg",
    "jpg": "jpg",
    "png": "png",
    "webp": "webp",
    "gif": "gif",
}


def _ensure_dir() -> None:
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def _sanitize_cert_no(cert_no: str) -> str:
    # cert_no looks like "CERT/HMZCS/LB/20260724-001" — "/" isn't valid
    # in a filename, and this only needs to be a readable prefix for
    # anyone browsing the uploads folder directly, not a strict identifier.
    return re.sub(r"[^A-Za-z0-9._-]", "_", cert_no)


def _externalize_string(value: str, cert_no: str) -> str:
    match = _DATA_URI_RE.match(value)
    if not match:
        return value  # an ordinary string, not a photo/signature — leave it alone

    ext = _SUBTYPE_TO_EXT.get(match.group("subtype").lower(), "jpg")
    try:
        raw = base64.b64decode(match.group("data"), validate=True)
    except (binascii.Error, ValueError):
        # Malformed base64 — better to keep the original string than
        # crash the whole save over one bad image.
        return value

    _ensure_dir()
    filename = f"{_sanitize_cert_no(cert_no)}_{uuid.uuid4().hex[:12]}.{ext}"
    (PHOTOS_DIR / filename).write_bytes(raw)
    return f"{_photo_url_prefix()}{filename}"


def externalize_photos(payload: Any, cert_no: str) -> Any:
    """
    Recursively walks a certificate's payload and replaces every
    data:image/...;base64,... string with a URL pointing at the file it
    just wrote to PHOTOS_DIR. Recursive/generic on purpose — photo and
    signature fields live at different paths for different equipment
    types (see inspection.types.ts's per-kind shapes), and walking every
    string rather than hardcoding field names means this doesn't need
    updating every time a new certificate type or field is added.
    """
    if isinstance(payload, str):
        return _externalize_string(payload, cert_no)
    if isinstance(payload, list):
        return [externalize_photos(item, cert_no) for item in payload]
    if isinstance(payload, dict):
        return {key: externalize_photos(value, cert_no) for key, value in payload.items()}
    return payload


def externalize_signature(data_uri: str, email: str) -> str:
    """Single-image counterpart to externalize_photos() — for a user's
    saved default signature (see User.saved_signature_url), which isn't
    part of a certificate payload at all, so the recursive walk above
    doesn't apply. Reuses the same data-URI decode/write logic so saved
    signatures live in the same PHOTOS_DIR, served by the same
    /api/photos/ route, as everything else."""
    return _externalize_string(data_uri, email)


def collect_photo_filenames(payload: Any) -> list[str]:
    """The inverse direction — used by delete_certificate to clean up the
    actual files on disk when a certificate (and therefore its photos)
    is deleted, so removed certificates don't leave orphaned files behind
    forever.

    Matches on PHOTO_URL_PATH appearing anywhere in the string (not just
    as a prefix) so this recognizes both the relative form
    ("/api/photos/x.png", written when PUBLIC_BASE_URL is unset) and the
    absolute form ("https://host/api/photos/x.png") — certificates saved
    under either setting can coexist in the same database, e.g. old rows
    from before PUBLIC_BASE_URL was introduced.
    """
    found: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, str) and PHOTO_URL_PATH in node:
            found.append(node.split(PHOTO_URL_PATH, 1)[1])
        elif isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, dict):
            for value in node.values():
                walk(value)

    walk(payload)
    return found


# Root-caused directly from a real report: "Technician Signature
# section... only showing signature with some picture instead of the
# actual signature" — confirmed against the production database that
# 4 real certificates (2 already finalized) had a broken engineerSig
# because this exact class of gap already happened once: a
# certificate's engineerSig/captainSig is a COPY of whatever the
# signer's saved_signature_url was AT THE MOMENT it was created (see
# freshCertificate() on the frontend), not a live reference to
# "whatever the current default is" — so the same file on disk can
# legitimately be pointed at by the user's own profile AND by any
# number of certificates at once. Every call site that used to delete
# a photo/signature file the instant it was no longer referenced from
# ONE place (a certificate being edited/deleted, a user replacing/
# removing their default signature) now checks first whether it's
# still needed somewhere else, so replacing your default signature
# tomorrow can't silently break a certificate issued yesterday.
def is_file_still_needed(db: Session, filename: str) -> bool:
    if "/" in filename or "\\" in filename:
        return True  # not a bare filename — treat as "keep it", the caller's sanitization will reject it anyway
    # Checked in Python, not a Postgres-only `payload::text LIKE` query —
    # this also has to run correctly against SQLite (the test suite's
    # database), which doesn't support that cast. `payload` is a handful
    # of KB of JSON per certificate at this company's real scale, and
    # this only runs on the rare admin/signature-management action that
    # was about to delete a file anyway, not on every request.
    import json
    from app.models.certificate import Certificate
    from app.models.user import User
    for (payload,) in db.query(Certificate.payload).all():
        if filename in json.dumps(payload):
            return True
    user_hit = db.query(User).filter(User.saved_signature_url.like(f"%{filename}%")).first()
    return user_hit is not None


def filter_deletable(db: Session, filenames: Iterable[str]) -> list[str]:
    """Filters `filenames` down to the ones safe to actually delete from
    disk — see is_file_still_needed's own comment for why this check
    exists at all. Call this immediately before delete_photo_files at
    every site that used to call it directly."""
    return [f for f in filenames if not is_file_still_needed(db, f)]


def delete_photo_files(filenames: list[str]) -> None:
    for filename in filenames:
        # Reject anything that isn't a bare filename (e.g. "../../etc/passwd")
        # before touching the filesystem — filenames here originate from
        # data already stored in the database, not directly from a
        # request, but this is cheap insurance against that ever changing.
        if "/" in filename or "\\" in filename or filename in (".", ".."):
            continue
        path = PHOTOS_DIR / filename
        path.unlink(missing_ok=True)
