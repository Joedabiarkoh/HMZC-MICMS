"""add invoice_attachments table

Revision ID: 0012_invoice_attachments
Revises: 0011_travel_admin_cert_items
Create Date: 2026-08-01

Requested directly: supporting documents (service report, PO, delivery
note, any other document) can be uploaded and saved against an invoice,
then downloaded together as one bundle — see models/finance_attachment.py.
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_invoice_attachments"
down_revision = "0011_travel_admin_cert_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invoice_attachments",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id"), nullable=False, index=True),
        sa.Column("label", sa.String(), nullable=False, server_default="Other"),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("stored_filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("invoice_attachments")
