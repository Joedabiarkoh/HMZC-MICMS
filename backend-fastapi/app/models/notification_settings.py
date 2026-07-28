from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Session, relationship

from app.models.base import BaseModel

# Single-row table (always id=1) for settings an administrator needs to
# change from inside the app itself, not by editing the server's .env
# and restarting the backend container. Starts with just the
# certificate expiry reminder recipient list — it needs to move
# whenever the person responsible for renewals changes role or leaves,
# which an admin should be able to do from Settings, not by asking
# whoever has server access to edit EXPIRY_REMINDER_EMAILS and redeploy.
# That env var (core/config.py) still works as a fallback for any
# deployment that set it and never touches this table — see
# core/expiry_reminders.py for the priority order.
class NotificationSettings(BaseModel):
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True)
    expiry_reminder_emails = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = relationship("User")


SETTINGS_ROW_ID = 1


def get_notification_settings(db: Session) -> NotificationSettings:
    """
    Get-or-create for the single settings row. Migration 0006 seeds row
    id=1 already, so the create path here only matters for a database
    that somehow reached this code without that migration's INSERT
    (never expected in practice, but cheaper to handle than to assume).
    """
    row = db.query(NotificationSettings).filter(NotificationSettings.id == SETTINGS_ROW_ID).first()
    if row is None:
        row = NotificationSettings(id=SETTINGS_ROW_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
