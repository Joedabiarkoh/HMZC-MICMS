"""add users.totp_secret / two_factor_enabled / totp_recovery_codes

Revision ID: 0025_two_factor_auth
Revises: 0024_account_lockout
Create Date: 2026-09-30

"2FA for Admin and Finance roles specifically" — a security review's
additional-layers recommendation. totp_secret/totp_recovery_codes stay
NULL/empty and two_factor_enabled stays False for every existing
account until each person actually completes setup (POST
/auth/2fa/setup then /auth/2fa/confirm) — this migration itself grants
nothing and revokes nothing, it only adds the columns. Enforcement
happens at the application layer (see User.requires_2fa_setup and
RequireAuth.tsx), not by this migration locking anyone out.
"""
from alembic import op
import sqlalchemy as sa

revision = "0025_two_factor_auth"
down_revision = "0024_account_lockout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.String(), nullable=True))
    op.add_column("users", sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("totp_recovery_codes", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("users", "totp_recovery_codes")
    op.drop_column("users", "two_factor_enabled")
    op.drop_column("users", "totp_secret")
