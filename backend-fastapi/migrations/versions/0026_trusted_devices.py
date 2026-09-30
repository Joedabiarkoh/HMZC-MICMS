"""add trusted_devices table

Revision ID: 0026_trusted_devices
Revises: 0025_two_factor_auth
Create Date: 2026-09-30

Requested directly: 2FA asking for a code on every single sign-in was
"very difficult for some users" on the two roles it's enforced for
(Admin/Finance). Lets a login skip the 2FA challenge on a device this
exact account already proved itself on recently (password + a valid
TOTP/recovery code), without weakening what 2FA protects against — see
core/trusted_devices.py's own comment for the full reasoning. A new
table, not a column on users, since one account can reasonably trust
more than one device, each with its own independent expiry/revocation.
"""
from alembic import op
import sqlalchemy as sa

revision = "0026_trusted_devices"
down_revision = "0025_two_factor_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trusted_devices",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("token_hash", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("trusted_devices")
