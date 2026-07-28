"""add notification_settings table

Revision ID: 0006_notification_settings
Revises: 0005_expiry_reminder
Create Date: 2026-07-28

Lets an administrator change the certificate expiry reminder
recipient list from inside the app (see api/routes/settings.py)
instead of editing the server's EXPIRY_REMINDER_EMAILS env var and
restarting the backend container — the env var still works as a
fallback (core/expiry_reminders.py) for deployments that set it and
never touch this table, but this is now the primary path since it
needs no server access when the responsible person's role changes.
Seeded as a single row (id=1) with a null email list — same
"unconfigured until someone sets a real address" convention
Settings.EXPIRY_REMINDER_EMAILS itself already used, since there's no
safe default recipient for a specific business's internal staff.
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_notification_settings"
down_revision = "0005_expiry_reminder"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("expiry_reminder_emails", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.execute("INSERT INTO notification_settings (id, expiry_reminder_emails) VALUES (1, NULL)")


def downgrade() -> None:
    op.drop_table("notification_settings")
