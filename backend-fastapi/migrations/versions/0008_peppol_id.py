"""add peppol_id to notification_settings

Revision ID: 0008_peppol_id
Revises: 0007_expenses
Create Date: 2026-07-28

HMZC's own PEPPOL (Pan-European Public Procurement OnLine) participant
ID — a company-wide identifier printed on invoices/quotations, not
per-customer. Added to the existing notification_settings singleton
row rather than a new table: it's the same kind of thing (an
admin-editable, company-wide setting), and this table already exists
for exactly that purpose (see models/notification_settings.py). No
actual PEPPOL network transmission — this is display/record-keeping
only, printed on finance documents so a customer's own accounts system
can look HMZC up on the network if they choose to.
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_peppol_id"
down_revision = "0007_expenses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notification_settings", sa.Column("peppol_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("notification_settings", "peppol_id")
