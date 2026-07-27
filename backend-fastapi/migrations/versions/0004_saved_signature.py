"""add users.saved_signature_url

Revision ID: 0004_saved_signature
Revises: 0003_permissions_and_roles
Create Date: 2026-07-27

Requested directly: a technician re-draws their own signature on every
single certificate they issue — this column lets them save it once and
have it reused automatically on new certificates. Nullable, no default:
most accounts (Sales, Admin, Client roles) never sign a certificate at
all. See app/models/user.py for the full explanation.
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_saved_signature"
down_revision = "0003_permissions_and_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("saved_signature_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "saved_signature_url")
