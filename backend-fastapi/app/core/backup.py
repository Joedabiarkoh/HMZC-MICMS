import logging
import subprocess
import tarfile
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config as BotoConfig

from app.core.config import settings
from app.core.photo_storage import PHOTOS_DIR

logger = logging.getLogger("hmzc.backup")

# Runs entirely on Railway (see the scheduled task wired into main.py's
# lifespan) rather than the earlier D:\HMZC-Backups Windows Task
# Scheduler setup — that approach protected the database while it lived
# on the user's laptop, but stopped being the real backup the moment the
# app moved to Railway: the laptop's Postgres and photo volume are now
# stale copies nobody writes to, while the actual production data on
# Railway had zero backups. A backup that depends on a specific person's
# machine being powered on defeats the reason for moving off it in the
# first place.


def is_backup_configured() -> bool:
    return bool(
        settings.BACKUP_S3_ENDPOINT
        and settings.BACKUP_S3_BUCKET
        and settings.BACKUP_S3_ACCESS_KEY_ID
        and settings.BACKUP_S3_SECRET_ACCESS_KEY
    )


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.BACKUP_S3_ENDPOINT,
        aws_access_key_id=settings.BACKUP_S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.BACKUP_S3_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4"),
    )


def run_backup() -> dict[str, Any]:
    """
    Dumps the database (pg_dump, custom format — restorable with
    pg_restore, same tool/format the earlier local backup scripts used)
    and tars the photo volume, uploading both to the configured
    S3-compatible bucket. Synchronous/blocking on purpose — called via
    asyncio.to_thread from the scheduled task, not directly from a
    request handler.
    """
    if not is_backup_configured():
        logger.warning("Backup skipped — BACKUP_S3_* settings not configured.")
        return {"skipped": True, "reason": "not configured"}

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    client = _s3_client()
    results: dict[str, Any] = {}

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        db_dump = tmp / f"hmzc_db_{timestamp}.dump"
        proc = subprocess.run(
            ["pg_dump", settings.DATABASE_URL, "-F", "c", "-f", str(db_dump)],
            capture_output=True, text=True, timeout=300,
        )
        if proc.returncode != 0 or not db_dump.exists() or db_dump.stat().st_size < 1000:
            logger.error("pg_dump failed or produced a suspiciously small file: %s", proc.stderr[:2000])
            results["database"] = {"ok": False, "error": proc.stderr[:2000]}
        else:
            key = f"database/hmzc_db_{timestamp}.dump"
            client.upload_file(str(db_dump), settings.BACKUP_S3_BUCKET, key)
            results["database"] = {"ok": True, "key": key, "size_bytes": db_dump.stat().st_size}
            logger.info("Database backup uploaded: %s (%d bytes)", key, db_dump.stat().st_size)

        photos_archive = tmp / f"photos_{timestamp}.tar.gz"
        if PHOTOS_DIR.is_dir() and any(PHOTOS_DIR.iterdir()):
            with tarfile.open(photos_archive, "w:gz") as tar:
                tar.add(PHOTOS_DIR, arcname="photos")
            key = f"photos/photos_{timestamp}.tar.gz"
            client.upload_file(str(photos_archive), settings.BACKUP_S3_BUCKET, key)
            results["photos"] = {"ok": True, "key": key, "size_bytes": photos_archive.stat().st_size}
            logger.info("Photo backup uploaded: %s (%d bytes)", key, photos_archive.stat().st_size)
        else:
            results["photos"] = {"ok": True, "skipped": "no photos yet"}

    try:
        _apply_retention(client)
    except Exception:
        logger.exception("Backup retention cleanup failed (backups themselves still succeeded)")

    return results


def _apply_retention(client) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.BACKUP_RETENTION_DAYS)
    paginator = client.get_paginator("list_objects_v2")
    for prefix in ("database/", "photos/"):
        for page in paginator.paginate(Bucket=settings.BACKUP_S3_BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                if obj["LastModified"] < cutoff:
                    client.delete_object(Bucket=settings.BACKUP_S3_BUCKET, Key=obj["Key"])
                    logger.info("Deleted old backup past %d-day retention: %s", settings.BACKUP_RETENTION_DAYS, obj["Key"])
