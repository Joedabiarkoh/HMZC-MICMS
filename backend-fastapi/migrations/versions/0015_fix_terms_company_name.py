"""fix invoice terms & conditions company name to HMZC

Revision ID: 0015_fix_terms_company_name
Revises: 0014_invoice_conditions
Create Date: 2026-08-02

Requested directly: the seeded Terms and Conditions text (0010) named
the contracting party "Bluetech Marine Services LLC" — the reference
document's own original company name — but every invoice this actually
prints on is HMZC's. Replaced in place (SQL REPLACE, not an overwrite
of the whole column) so any edit an admin has since made to the rest of
the text via Settings survives untouched.
"""
from alembic import op
import sqlalchemy as sa

revision = "0015_fix_terms_company_name"
down_revision = "0014_invoice_conditions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE notification_settings SET terms_conditions = REPLACE(terms_conditions, 'Bluetech Marine Services LLC', 'HMZC') WHERE id = 1"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE notification_settings SET terms_conditions = REPLACE(terms_conditions, 'HMZC', 'Bluetech Marine Services LLC') WHERE id = 1"
        )
    )
