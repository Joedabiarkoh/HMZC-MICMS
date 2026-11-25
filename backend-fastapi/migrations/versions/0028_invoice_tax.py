"""IVA and withholding fields on invoices (Kwanza invoices)

Revision ID: 0028_invoice_tax
Revises: 0027_purchase_orders
Create Date: 2026-11-25

Requested directly: a Kwanza invoice must calculate Angolan tax (IVA, and
the customer's withholding on services). Existing invoices keep 0 / 0 so
they print exactly as before.
"""
from alembic import op
import sqlalchemy as sa

revision = "0028_invoice_tax"
down_revision = "0027_purchase_orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("tax_nature", sa.String(), nullable=False, server_default="service"))
    op.add_column("invoices", sa.Column("iva_rate", sa.Float(), nullable=False, server_default="0"))
    op.add_column("invoices", sa.Column("withholding_rate", sa.Float(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("invoices", "withholding_rate")
    op.drop_column("invoices", "iva_rate")
    op.drop_column("invoices", "tax_nature")
