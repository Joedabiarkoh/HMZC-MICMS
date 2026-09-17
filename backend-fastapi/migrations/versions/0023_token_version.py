"""add users.token_version

Revision ID: 0023_token_version
Revises: 0022_overall_discount
Create Date: 2026-09-24

Found during a security review: a JWT was valid until its own natural
expiry no matter what happened to the account afterward — deactivating
a compromised account, or resetting its password, didn't invalidate a
token already issued against it. Every new token now carries the
account's current token_version as a "tv" claim (see login() in
api/routes/auth.py), checked against this column on every request (see
get_current_user in api/deps.py) — bumping it instantly invalidates
every token issued before the bump. Existing rows default to 1, the
same value every freshly-created user starts at, so this is a no-op
for every account until the next password change/deactivation/
logout-everywhere actually bumps it.

Note: a token issued before this migration deploys has no "tv" claim
at all and will be rejected the first time get_current_user checks it
— a one-time, self-resolving side effect (that session's user just
logs in again), not a bug.
"""
from alembic import op
import sqlalchemy as sa

revision = "0023_token_version"
down_revision = "0022_overall_discount"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    op.drop_column("users", "token_version")
