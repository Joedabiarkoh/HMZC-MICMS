from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
import io

from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_permission
from app.core.config import settings
from app.core.database import get_database
from app.core.file_storage import delete_upload, read_upload, save_upload
from app.core.permissions import SUPPLIER_MANAGE, SUPPLIER_VIEW
from app.models.supplier_boarding import SupplierBoardingSubmission
from app.models.user import User
from app.schemas.supplier import SupplierBoardingSubmissionResponse

# Requested directly: "create a section for suppliers boarding, allow
# for the document to be downloaded and uploaded after it has been
# filled, use this type of form." /template serves the reference New
# Supplier Form unmodified (see app/static/templates/ — copied as-is,
# not rebuilt, so its dropdown data-validation survives; openpyxl warns
# it can't preserve that extension on save, so this deliberately never
# round-trips the file through openpyxl at all). The rest is a simple
# submissions log — see models/supplier_boarding.py for why this isn't
# a full Supplier register.
router = APIRouter(tags=["suppliers"])

TEMPLATE_PATH = Path(__file__).resolve().parent.parent.parent / "static" / "templates" / "supplier_boarding_form.xlsx"
TEMPLATE_DOWNLOAD_NAME = "New Supplier Form.xlsx"


@router.get("/boarding-template")
def download_boarding_template(_user: User = Depends(require_permission(SUPPLIER_VIEW))):
    if not TEMPLATE_PATH.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Boarding form template is not available.")
    return FileResponse(
        TEMPLATE_PATH,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=TEMPLATE_DOWNLOAD_NAME,
    )


@router.get("/boarding", response_model=List[SupplierBoardingSubmissionResponse])
def list_boarding_submissions(
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(SUPPLIER_VIEW)),
):
    return (
        db.query(SupplierBoardingSubmission)
        .options(joinedload(SupplierBoardingSubmission.uploaded_by))
        .order_by(SupplierBoardingSubmission.created_at.desc())
        .all()
    )


@router.post("/boarding", response_model=SupplierBoardingSubmissionResponse, status_code=status.HTTP_201_CREATED)
def upload_boarding_submission(
    supplier_name: str = Form(...),
    notes: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(SUPPLIER_MANAGE)),
):
    if not supplier_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier name is required.")
    raw = file.file.read()
    stored_filename = save_upload(file, settings.SUPPLIER_BOARDING_DIR, raw)
    submission = SupplierBoardingSubmission(
        supplier_name=supplier_name.strip(),
        notes=notes.strip() or None,
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        content_type=file.content_type,
        size_bytes=len(raw),
        uploaded_by_id=current_user.id,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def _get_submission_or_404(submission_id: int, db: Session) -> SupplierBoardingSubmission:
    submission = db.query(SupplierBoardingSubmission).filter(SupplierBoardingSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return submission


@router.get("/boarding/{submission_id}/download")
def download_boarding_submission(
    submission_id: int,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(SUPPLIER_VIEW)),
):
    submission = _get_submission_or_404(submission_id, db)
    raw = read_upload(settings.SUPPLIER_BOARDING_DIR, submission.stored_filename)
    return StreamingResponse(
        io.BytesIO(raw),
        media_type=submission.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{submission.original_filename}"'},
    )


@router.delete("/boarding/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_boarding_submission(
    submission_id: int,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(SUPPLIER_MANAGE)),
):
    submission = _get_submission_or_404(submission_id, db)
    delete_upload(settings.SUPPLIER_BOARDING_DIR, submission.stored_filename)
    db.delete(submission)
    db.commit()
