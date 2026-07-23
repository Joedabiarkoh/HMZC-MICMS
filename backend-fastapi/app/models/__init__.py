from app.models.user import User  # noqa: F401
from app.models.certificate import Certificate  # noqa: F401
from app.models.finance_item import FinanceItem  # noqa: F401
from app.models.finance_document import Quotation, Invoice  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401

# Empty before this — meant Base.metadata.create_all(bind=engine) in
# main.py only picked up whichever models happened to already be
# imported via the route modules. Explicit imports here make table
# creation reliable regardless of import order.
