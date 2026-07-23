"""add users.extra_permissions and new role values

Revision ID: 0003_permissions_and_roles
Revises: 0002_must_change_password
Create Date: 2026-07-21

Found by auditing the migrations against the actual current
app/models/user.py during a project-readiness review — the
Certificates/Finance permission-separation work added `extra_permissions`
and four new UserRole values (sales, administration,
service_coordination, limited_admin) to the model, but migrations were
never updated to match. Anyone who ran `alembic upgrade head` at 0002
would have a `users` table missing this column entirely, and inserting
a user with one of the new roles would fail outright (the Postgres enum
type wouldn't accept a value it doesn't know about).

IMPORTANT — not run against a real database, same caveat as every other
migration here. One thing specifically worth verifying on a real
Postgres instance: `ALTER TYPE ... ADD VALUE` cannot run inside the same
transaction as a statement that *uses* the newly-added value. This
migration only adds the values and does nothing else with them, which
should be safe — but "should be" is exactly the kind of claim that
needs a real database to actually confirm.
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_permissions_and_roles"
down_revision = "0002_must_change_password"
branch_labels = None
depends_on = None

NEW_ROLE_VALUES = ["sales", "administration", "service_coordination", "limited_admin"]


def upgrade() -> None:
    # Postgres requires ALTER TYPE ... ADD VALUE to run outside the
    # implicit transaction Alembic normally wraps a migration in on
    # PostgreSQL. autocommit_block() is Alembic's documented way to do
    # that for exactly this operation.
    with op.get_context().autocommit_block():
        for value in NEW_ROLE_VALUES:
            op.execute(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column(
        "users",
        sa.Column("extra_permissions", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    # Deliberately does not remove the four enum values — Postgres has
    # no direct "ALTER TYPE ... DROP VALUE"; removing one means
    # recreating the entire type and every column that depends on it,
    # which is real, risky work that isn't automated here (and would be
    # destructive if any user still has one of these roles). Rolling
    # back this migration removes the column only, which is safe and
    # reversible; the enum values simply become unused rather than
    # actively removed.
    op.drop_column("users", "extra_permissions")
