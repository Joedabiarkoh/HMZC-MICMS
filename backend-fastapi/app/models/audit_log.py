from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Scoped deliberately narrow: login, certificate/invoice/quotation saves,
# and role changes — the events where "who did what, when, from where"
# actually matters for a certification platform (a dispute over who
# issued a certificate, or who granted themselves/someone else admin
# access). Logging every read or every keystroke would bury the events
# that matter in noise without adding real traceability value.
class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User")

    action = Column(String, nullable=False)  # e.g. "login", "certificate.save", "user.role_change"
    resource_type = Column(String, nullable=True)  # e.g. "certificate", "invoice", "user"
    resource_id = Column(String, nullable=True)  # e.g. a cert_no, invoice_no, or user id as a string
    detail = Column(String, nullable=True)  # short human-readable note, e.g. "role changed to admin"
    ip_address = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
