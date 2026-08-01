"""add supplier_boarding_submissions table

Revision ID: 0013_supplier_boarding
Revises: 0012_invoice_attachments
Create Date: 2026-08-01

Requested directly: a Supplier Boarding section — download the blank
New Supplier Form template, fill it in, upload it back. This table is
the submissions log; see models/supplier_boarding.py for why it's a
simple log rather than a full Supplier register.
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_supplier_boarding"
down_revision = "0012_invoice_attachments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "supplier_boarding_submissions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("supplier_name", sa.String(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("stored_filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("supplier_boarding_submissions")
