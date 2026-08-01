"""move conditions from invoices to quotations

Revision ID: 0016_conditions_to_quotations
Revises: 0015_fix_terms_company_name
Create Date: 2026-08-02

Requested directly: "put the condition in the quotation not the
invoice." 0014 added `conditions` to invoices; this drops it there and
adds the same column to quotations instead — a quotation is the
pre-service pricing proposal, which is where standing terms like
overtime/standby rates and accommodation/transport/flight
responsibility actually belong, stated up front. No data migration
needed: 0014 shipped in this same batch of work, so there's no real
invoice.conditions data anywhere yet to carry over.
"""
from alembic import op
import sqlalchemy as sa

revision = "0016_conditions_to_quotations"
down_revision = "0015_fix_terms_company_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotations", sa.Column("conditions", sa.JSON(), nullable=False, server_default="[]"))
    op.drop_column("invoices", "conditions")


def downgrade() -> None:
    op.add_column("invoices", sa.Column("conditions", sa.JSON(), nullable=False, server_default="[]"))
    op.drop_column("quotations", "conditions")
