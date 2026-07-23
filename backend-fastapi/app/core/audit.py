from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def record_audit(
    db: Session,
    request: Request,
    action: str,
    user_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    detail: Optional[str] = None,
) -> None:
    """
    Fire-and-forget audit entry. Deliberately does its own commit rather
    than relying on the caller's — an audit record failing to save
    shouldn't be tied to (or able to roll back) the actual operation it's
    describing, and shouldn't block the response if something about
    logging itself goes wrong.
    """
    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
            ip_address=request.client.host if request.client else None,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
