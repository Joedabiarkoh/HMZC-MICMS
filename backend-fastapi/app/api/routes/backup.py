from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin_user
from app.core.backup import is_backup_configured, run_backup
from app.models.user import User

# Admin-only, on-demand trigger for the same backup the scheduled loop
# in main.py runs automatically every 24 hours — useful for confirming
# the bucket/credentials are actually working right now, rather than
# waiting up to a day to find out, and for a manual just-in-case backup
# before a risky change.
router = APIRouter(tags=["backup"])


@router.post("/run")
def trigger_backup(_: User = Depends(get_current_admin_user)):
    if not is_backup_configured():
        return {"skipped": True, "reason": "BACKUP_S3_* environment variables are not set"}
    return run_backup()
