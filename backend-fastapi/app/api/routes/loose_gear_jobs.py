import re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_permission
from app.core.database import get_database
from app.core.permissions import CERT_EDIT, CERT_VIEW
from app.models.loose_gear_job import LooseGearJob
from app.models.user import User
from app.schemas.loose_gear_job import LooseGearJobCreate, LooseGearJobReserveResult, LooseGearJobResponse

# Requested directly: "before you create a certificate job number must
# be created for you and all the certificate that will be created
# within that job number will be grouped under that job number and
# once the job is completed that job number can be closed and no
# other certificate can be created using that job number." See
# models/loose_gear_job.py for the full reasoning.
router = APIRouter(tags=["loose-gear-jobs"])


def _vessel_slug(vessel_name: str) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "", vessel_name.strip().upper())
    return (slug or "VESSEL")[:20]


@router.post("", response_model=LooseGearJobResponse, status_code=status.HTTP_200_OK)
def create_job(
    job_in: LooseGearJobCreate,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(CERT_EDIT)),
):
    vessel_name = job_in.vessel_name.strip()
    if not vessel_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vessel name is required to open a job.")

    ymd = datetime.now(timezone.utc).strftime("%Y%m%d")
    base = f"LG-{_vessel_slug(vessel_name)}-{ymd}"
    # Requested directly, re: "same vessel has different items issued
    # for that project": the day in the number is just when the job
    # was OPENED, not when items are later added to it — a job that
    # runs for a week keeps this same number throughout. A second,
    # genuinely separate job opened for the same vessel on the same
    # calendar day (e.g. closed one by mistake, started over) still
    # needs its own number, hence the letter-suffix disambiguation
    # below rather than a hard collision error.
    job_no = base
    suffix_ord = ord("B")
    while db.query(LooseGearJob).filter(LooseGearJob.job_no == job_no).first():
        job_no = f"{base}-{chr(suffix_ord)}"
        suffix_ord += 1

    job = LooseGearJob(
        job_no=job_no,
        vessel_name=vessel_name,
        imo_no=(job_in.imo_no or "").strip() or None,
        status="open",
        next_item_seq=1,
        created_by_id=current_user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=List[LooseGearJobResponse])
def list_jobs(
    vessel_name: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_VIEW)),
):
    query = db.query(LooseGearJob).options(joinedload(LooseGearJob.created_by), joinedload(LooseGearJob.closed_by))
    if vessel_name:
        query = query.filter(LooseGearJob.vessel_name.ilike(vessel_name.strip()))
    if status_filter:
        query = query.filter(LooseGearJob.status == status_filter)
    return query.order_by(LooseGearJob.created_at.desc()).all()


@router.get("/{job_no}", response_model=LooseGearJobResponse)
def get_job(
    job_no: str,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_VIEW)),
):
    job = (
        db.query(LooseGearJob)
        .options(joinedload(LooseGearJob.created_by), joinedload(LooseGearJob.closed_by))
        .filter(LooseGearJob.job_no == job_no)
        .first()
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


# Requested directly: cert_no for an item under a job is
# "{job_no}-{seq}", assigned HERE rather than guessed client-side (the
# way generateCertNo works for every other certificate type) — with
# multiple technicians potentially adding items to the same 300-item
# job at once, two people computing "the next number" independently
# by counting would collide. SELECT ... FOR UPDATE locks this job's
# row for the rest of the transaction, so a second concurrent request
# blocks until the first commits, guaranteeing every reservation gets
# a distinct sequence number.
@router.post("/{job_no}/reserve-cert-no", response_model=LooseGearJobReserveResult)
def reserve_cert_no(
    job_no: str,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_EDIT)),
):
    job = db.query(LooseGearJob).filter(LooseGearJob.job_no == job_no).with_for_update().first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status != "open":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job {job_no} is closed — no new certificates can be created under it.",
        )
    seq = job.next_item_seq
    job.next_item_seq = seq + 1
    db.commit()
    return LooseGearJobReserveResult(cert_no=f"{job_no}-{seq:03d}", job_no=job_no)


@router.post("/{job_no}/close", response_model=LooseGearJobResponse)
def close_job(
    job_no: str,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(CERT_EDIT)),
):
    job = db.query(LooseGearJob).filter(LooseGearJob.job_no == job_no).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status == "closed":
        return job
    job.status = "closed"
    job.closed_by_id = current_user.id
    job.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job
