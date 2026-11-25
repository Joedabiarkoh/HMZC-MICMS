"""Kwanza bank details on notification_settings

Revision ID: 0029_kwanza_bank
Revises: 0028_invoice_tax
Create Date: 2026-11-25

Requested directly: use HMZC's Kwanza bank details (BAI) and NIF on every
Kwanza invoice, quotation and purchase order. Seeded from the company's own
proforma; editable in Settings.
"""
from alembic import op
import sqlalchemy as sa

from app.core.po_terms import DEFAULT_KWANZA_BANK

revision = "0029_kwanza_bank"
down_revision = "0028_invoice_tax"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notification_settings", sa.Column("kwanza_bank_details", sa.Text(), nullable=True))
    t = sa.table("notification_settings", sa.column("id", sa.Integer), sa.column("kwanza_bank_details", sa.Text))
    op.execute(t.update().where(t.c.id == 1).values(kwanza_bank_details=DEFAULT_KWANZA_BANK))


def downgrade() -> None:
    op.drop_column("notification_settings", "kwanza_bank_details")
