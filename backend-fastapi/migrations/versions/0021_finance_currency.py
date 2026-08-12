"""add currency and exchange_rate to quotations/invoices

Revision ID: 0021_finance_currency
Revises: 0020_inspector_job_create
Create Date: 2026-08-12

Requested directly: "improve invoice and quote, using the USD as the
main price, invoice can be issued in any currency, have a section to
change currency." subtotal/discount_total/total and every line item's
unit_price/line_total stay in USD, unchanged — that's what "USD as the
main price" means here, and it's also what keeps the Finance Dashboard/
Job Costing's cross-document SUM()s correct without any changes there,
since every stored total is still the same currency regardless of what
a given document was actually issued in. `currency` + `exchange_rate`
(units of that currency per 1 USD) are purely presentation metadata,
applied at display/PDF time to convert the stored USD figures for
whoever's reading the printed document. Existing rows default to
USD/1.0, which is a no-op conversion — identical to current behavior.
"""
from alembic import op
import sqlalchemy as sa

revision = "0021_finance_currency"
down_revision = "0020_inspector_job_create"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotations", sa.Column("currency", sa.String(), nullable=False, server_default="USD"))
    op.add_column("quotations", sa.Column("exchange_rate", sa.Float(), nullable=False, server_default="1"))
    op.add_column("invoices", sa.Column("currency", sa.String(), nullable=False, server_default="USD"))
    op.add_column("invoices", sa.Column("exchange_rate", sa.Float(), nullable=False, server_default="1"))


def downgrade() -> None:
    op.drop_column("invoices", "exchange_rate")
    op.drop_column("invoices", "currency")
    op.drop_column("quotations", "exchange_rate")
    op.drop_column("quotations", "currency")
