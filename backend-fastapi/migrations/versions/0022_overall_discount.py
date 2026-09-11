"""add overall (document-level) discount to quotations/invoices

Revision ID: 0022_overall_discount
Revises: 0021_finance_currency
Create Date: 2026-09-11

Requested directly: "can we make the discount lumpsum for all the
invoice and not each line item." Line items already had a per-item
discount_type/discount_percent/discount_amount (see the frontend's
LineItem type) — this adds the same percent/amount duality one level
up, as a second discount applied to the whole document on top of
whatever the line items already discount, not a replacement for them.
Existing rows default to overall_discount_type="percent",
overall_discount_percent=0, overall_discount_amount=0 — a no-op, since
0% off nothing changes discount_total/total from what they already are.
"""
from alembic import op
import sqlalchemy as sa

revision = "0022_overall_discount"
down_revision = "0021_finance_currency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotations", sa.Column("overall_discount_type", sa.String(), nullable=False, server_default="percent"))
    op.add_column("quotations", sa.Column("overall_discount_percent", sa.Float(), nullable=False, server_default="0"))
    op.add_column("quotations", sa.Column("overall_discount_amount", sa.Float(), nullable=False, server_default="0"))
    op.add_column("invoices", sa.Column("overall_discount_type", sa.String(), nullable=False, server_default="percent"))
    op.add_column("invoices", sa.Column("overall_discount_percent", sa.Float(), nullable=False, server_default="0"))
    op.add_column("invoices", sa.Column("overall_discount_amount", sa.Float(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("invoices", "overall_discount_amount")
    op.drop_column("invoices", "overall_discount_percent")
    op.drop_column("invoices", "overall_discount_type")
    op.drop_column("quotations", "overall_discount_amount")
    op.drop_column("quotations", "overall_discount_percent")
    op.drop_column("quotations", "overall_discount_type")
