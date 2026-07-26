from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.photo_storage import PHOTOS_DIR

# Deliberately public, same reasoning as certificates.py's /verify/{cert_no}
# route: a filename alone (a random 12-hex-char suffix — see
# photo_storage.py's externalize_photos) isn't discoverable without
# already having legitimate access to the certificate that references
# it, and requiring auth here isn't practically enforceable anyway — a
# plain <img src="..."> tag can't attach the app's Bearer token, only
# cookies or query-string tokens could, and neither is worth the
# complexity for inspection photos at this project's current sensitivity
# level. If that changes (e.g. genuinely confidential photos), revisit
# with a signed/expiring URL rather than bolting auth onto <img> tags.
router = APIRouter(tags=["photos"])


@router.get("/{filename}")
def get_photo(filename: str):
    if "/" in filename or "\\" in filename or filename in (".", ".."):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
    path = PHOTOS_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    return FileResponse(path)
