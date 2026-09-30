"""add users.failed_login_attempts and locked_until

Revision ID: 0024_account_lockout
Revises: 0023_token_version
Create Date: 2026-09-30

Found during a security review's follow-up: the existing per-IP rate
limiter (core/rate_limit.py) caps how fast someone can guess a
password, not how many guesses one specific account gets across many
IPs — rotating IPs (or spacing attempts a minute apart) let an attacker
grind one account's password indefinitely. failed_login_attempts
counts consecutive failures and resets to 0 on any successful login;
locked_until is set once it reaches MAX_FAILED_ATTEMPTS (see
core/account_lockout.py) and cleared either once it naturally expires
or an admin unlocks the account early. Existing rows default to 0/NULL
— every account starts unlocked, same as a freshly-created one.
"""
from alembic import op
import sqlalchemy as sa

revision = "0024_account_lockout"
down_revision = "0023_token_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
