"""add certificates.expiry_reminder_sent_at

Revision ID: 0005_expiry_reminder
Revises: 0004_saved_signature
Create Date: 2026-07-28

Requested directly: certificates are valid for one year from
date_of_servicing, and staff should get an email reminder before one
lapses. This column tracks whether the (single, digest) reminder email
has already gone out for a given certificate, so the scheduled check
in core/expiry_reminders.py doesn't re-notify about the same expiring
certificate every time it runs. Nullable — every existing certificate
starts as "not yet reminded," which is correct: none of them have had
a reminder sent before this feature existed.
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_expiry_reminder"
down_revision = "0004_saved_signature"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("certificates", sa.Column("expiry_reminder_sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("certificates", "expiry_reminder_sent_at")
