import re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_permission
from app.core.database import get_database
from app.core.permissions import CERT_EDIT, JOB_CREATE, JOB_VIEW
from app.models.certificate import Certificate
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobCreate, JobReserveResult, JobResponse, JobSetPo

# Requested directly: "before you create a certificate job number
# must be created for you and all the certificate that will be
# created within that job number will be grouped under that job
# number and once the job is completed that job number can be closed
# and no other certificate can be created using that job number" —
# then generalized to every equipment type, with PO/customer
# identification added. See models/job.py for the full reasoning.
router = APIRouter(tags=["jobs"])


def _vessel_slug(vessel_name: str) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "", vessel_name.strip().upper())
    return (slug or "VESSEL")[:20]


# Requested directly: "so that all certificate issued will stay under
# that job number and easy to track" — a real query, not a stored
# counter (see JobResponse.certificate_count's own comment).
def _job_response(db: Session, job: Job) -> JobResponse:
    resp = JobResponse.model_validate(job)
    resp.certificate_count = db.query(Certificate).filter(Certificate.job_no == job.job_no).count()
    return resp


@router.post("", response_model=JobResponse, status_code=status.HTTP_200_OK)
def create_job(
    job_in: JobCreate,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(JOB_CREATE)),
):
    vessel_name = job_in.vessel_name.strip()
    if not vessel_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vessel name is required to open a job.")

    po_number = (job_in.po_number or "").strip() or None
    customer_name = (job_in.customer_name or "").strip() or None
    # Requested directly: "include PO required, if PO not available
    # include a section for PO not available now[, and] if PO not
    # available allow to enter customer name" — a job always needs
    # one or the other, never neither.
    if not po_number and not job_in.po_pending:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="PO number is required, or mark it as not available yet.")
    if job_in.po_pending and not customer_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Customer name is required when the PO isn't available yet.")

    ymd = datetime.now(timezone.utc).strftime("%Y%m%d")
    base = f"JOB-{_vessel_slug(vessel_name)}-{ymd}"
    # Requested directly, re: "same vessel has different items issued
    # for that project" / "same vessel can be visited on different
    # occassion for different POs": the day in the number is just when
    # the job was OPENED, not when items are later added — a job that
    # runs for a week keeps this same number throughout. A second,
    # genuinely separate job for the same vessel on the same calendar
    # day (a different PO, say) still needs its own number, hence the
    # letter-suffix disambiguation below rather than a hard collision
    # error.
    job_no = base
    suffix_ord = ord("B")
    while db.query(Job).filter(Job.job_no == job_no).first():
        job_no = f"{base}-{chr(suffix_ord)}"
        suffix_ord += 1

    job = Job(
        job_no=job_no,
        vessel_name=vessel_name,
        imo_no=(job_in.imo_no or "").strip() or None,
        po_number=po_number,
        po_pending=job_in.po_pending,
        customer_name=customer_name,
        status="open",
        created_by_id=current_user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_response(db, job)


@router.get("", response_model=List[JobResponse])
def list_jobs(
    vessel_name: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(JOB_VIEW)),
):
    query = db.query(Job).options(joinedload(Job.created_by), joinedload(Job.closed_by))
    if vessel_name:
        query = query.filter(Job.vessel_name.ilike(vessel_name.strip()))
    if status_filter:
        query = query.filter(Job.status == status_filter)
    jobs = query.order_by(Job.created_at.desc()).all()
    return [_job_response(db, job) for job in jobs]


@router.get("/{job_no}", response_model=JobResponse)
def get_job(
    job_no: str,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(JOB_VIEW)),
):
    job = (
        db.query(Job)
        .options(joinedload(Job.created_by), joinedload(Job.closed_by))
        .filter(Job.job_no == job_no)
        .first()
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return _job_response(db, job)


# Requested directly: "PO becomes editable on the open Job" once it's
# finally issued, for a job that started with po_pending=True. Doesn't
# require JOB_CREATE — anyone who can add certificates to this job
# (jobs.view + certificates.edit) can also record the PO once they
# have it, since that's routine follow-up, not opening/closing a job.
@router.post("/{job_no}/set-po", response_model=JobResponse)
def set_po(
    job_no: str,
    body: JobSetPo,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_EDIT)),
):
    job = db.query(Job).filter(Job.job_no == job_no).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    po_number = body.po_number.strip()
    if not po_number:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="PO number cannot be empty.")
    job.po_number = po_number
    job.po_pending = False
    db.commit()
    db.refresh(job)
    return _job_response(db, job)


# Requested directly: "make one certificate number which keep count
# for the certificate of loose gear created under that job number
# while the job number stays same for all those certificate" — a
# Loose Gear item's cert_no is its own clean "CERT/HMZC/LG/{date}-
# {seq}" number (see models/cert_number_counter.py for the full
# reasoning), assigned HERE rather than guessed client-side (the way
# generateCertNo works for every other certificate type) — with
# multiple technicians potentially adding items to the same 300-item
# job at once, two people computing "the next number" independently
# by counting would collide. The INSERT ... ON CONFLICT DO UPDATE
# below is a single atomic statement — Postgres itself serializes
# concurrent callers on the same (tag, date_key) row, so two
# simultaneous reservations always get distinct sequence numbers
# without an explicit application-level lock. date_key is the JOB's
# own creation date (not "today"), so a job spanning several days
# keeps drawing from the same day's counter throughout — the same
# reasoning job_no's own date component uses (see create_job above).
# Only Loose Gear calls this — every other equipment type keeps its
# own existing cert_no scheme and just tags jobRef (see
# InspectionWorkspace.tsx's handleJobSelected).
@router.post("/{job_no}/reserve-cert-no", response_model=JobReserveResult)
def reserve_cert_no(
    job_no: str,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_EDIT)),
):
    job = db.query(Job).filter(Job.job_no == job_no).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status != "open":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job {job_no} is closed — no new certificates can be created under it.",
        )
    date_key = job.created_at.strftime("%Y%m%d")
    result = db.execute(
        text(
            """
            INSERT INTO cert_number_counters (tag, date_key, next_seq)
            VALUES (:tag, :date_key, 2)
            ON CONFLICT (tag, date_key) DO UPDATE SET next_seq = cert_number_counters.next_seq + 1
            RETURNING next_seq - 1
            """
        ),
        {"tag": "LG", "date_key": date_key},
    )
    seq = result.scalar_one()
    db.commit()
    cert_no = f"CERT/HMZC/LG/{date_key}-{seq:03d}"
    return JobReserveResult(cert_no=cert_no, job_no=job_no)


@router.post("/{job_no}/close", response_model=JobResponse)
def close_job(
    job_no: str,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(JOB_CREATE)),
):
    job = db.query(Job).filter(Job.job_no == job_no).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status == "closed":
        return _job_response(db, job)
    job.status = "closed"
    job.closed_by_id = current_user.id
    job.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return _job_response(db, job)
