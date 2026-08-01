"""add conditions to invoices

Revision ID: 0014_invoice_conditions
Revises: 0013_supplier_boarding
Create Date: 2026-08-02

Requested directly: short, per-invoice condition bullets ("Overtime
rate applies...", "Client is responsible for technician's
accommodation, local transportation, and flights") printed to the left
of the totals block — distinct from the long, company-wide Terms and
Conditions legal text at the bottom of the invoice (see 0010). These
are editable per invoice, not a single admin-managed setting: each
invoice gets its own JSON array of strings, defaulting to a suggested
set in the frontend when a NEW invoice is created (see
freshInvoiceConditions in inspectionHelpers-equivalent finance code) —
existing invoices simply start with an empty list.
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_invoice_conditions"
down_revision = "0013_supplier_boarding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("conditions", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("invoices", "conditions")
