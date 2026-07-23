"""add users.must_change_password

Revision ID: 0002_must_change_password
Revises: 0001_baseline
Create Date: 2026-07-21

The column added alongside admin-initiated password resets (see
"Account approval and password recovery" in the root README). This is
the migration that actually matters for anyone who deployed before
today: their `users` table already exists (from the previous
Base.metadata.create_all() setup) and is missing only this one column —
run `alembic stamp 0001_baseline` first (marks the baseline as already
applied without re-creating tables that already exist), then
`alembic upgrade head` to apply just this.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_must_change_password"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
