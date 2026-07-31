"""add supplier bank account details to notification_settings

Revision ID: 0009_bank_details
Revises: 0008_peppol_id
Create Date: 2026-07-29

HMZC's own supplier bank account details, printed on invoices (not
quotations — not a payment demand yet). Same admin-editable,
company-wide setting pattern as peppol_id. Seeded directly with the
real values supplied, so they're live immediately rather than requiring
an admin to re-type ten fields into Settings by hand — still editable
there afterward if anything changes.
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_bank_details"
down_revision = "0008_peppol_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notification_settings", sa.Column("bank_name", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_address", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_town", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_postcode", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_country", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_beneficiary", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_account_number", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_sort_code", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_swift_code", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("bank_iban", sa.String(), nullable=True))

    op.execute(
        """
        UPDATE notification_settings SET
            bank_name = 'FNB (First Rand Bank Limited)',
            bank_address = '6th Floor, 1 First Place, Simmonds Street, Johannesburg, 2001, South Africa.',
            bank_town = 'Cape Town',
            bank_country = 'South Africa',
            bank_beneficiary = 'HMZC SERVICE PROVIDER (PTY) LTD',
            bank_account_number = '63216107474',
            bank_sort_code = '251650',
            bank_swift_code = 'FIRNZAJJ'
        WHERE id = 1
        """
    )


def downgrade() -> None:
    op.drop_column("notification_settings", "bank_iban")
    op.drop_column("notification_settings", "bank_swift_code")
    op.drop_column("notification_settings", "bank_sort_code")
    op.drop_column("notification_settings", "bank_account_number")
    op.drop_column("notification_settings", "bank_beneficiary")
    op.drop_column("notification_settings", "bank_country")
    op.drop_column("notification_settings", "bank_postcode")
    op.drop_column("notification_settings", "bank_town")
    op.drop_column("notification_settings", "bank_address")
    op.drop_column("notification_settings", "bank_name")
