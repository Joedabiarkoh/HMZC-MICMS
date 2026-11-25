"""purchase orders, their attachments, and company identity settings

Revision ID: 0027_purchase_orders
Revises: 0026_trusted_devices
Create Date: 2026-11-25

Requested directly: a section to create a purchase order (modelled on the
approved PO 25-0022) and track it, with the NIF, the registered company
name and the standard terms page printed on finance documents.

* purchase_orders / purchase_order_attachments: new tables.
* notification_settings: company_legal_name, company_nif, company_phones
  (finance letterhead) and po_terms_conditions (the terms page), seeded
  with HMZC's own values from that PO so the first printout is already
  right; an administrator can edit all four in Settings.
"""
from alembic import op
import sqlalchemy as sa

from app.core.po_terms import DEFAULT_LEGAL_NAME, DEFAULT_NIF, DEFAULT_PHONES, DEFAULT_PO_TERMS

revision = "0027_purchase_orders"
down_revision = "0026_trusted_devices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("po_no", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("status", sa.String(), nullable=False, server_default="draft", index=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("revision_date", sa.Date(), nullable=True),
        sa.Column("order_date", sa.Date(), nullable=True),
        sa.Column("delivery_date", sa.Date(), nullable=True),
        sa.Column("delivery_terms", sa.String(), nullable=True),
        sa.Column("quote_ref", sa.String(), nullable=True),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("job_no", sa.String(), nullable=True, index=True),
        sa.Column("vendor_name", sa.String(), nullable=False),
        sa.Column("vendor_vat", sa.String(), nullable=True),
        sa.Column("vendor_phone", sa.String(), nullable=True),
        sa.Column("vendor_email", sa.String(), nullable=True),
        sa.Column("vendor_physical_address", sa.Text(), nullable=True),
        sa.Column("vendor_postal_address", sa.Text(), nullable=True),
        sa.Column("delivery_address", sa.Text(), nullable=True),
        sa.Column("delivery_contact_phone", sa.String(), nullable=True),
        sa.Column("delivery_contact_email", sa.String(), nullable=True),
        sa.Column("currency", sa.String(), nullable=False, server_default="USD"),
        sa.Column("line_items", sa.JSON(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("written_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("written_by_name", sa.String(), nullable=True),
        sa.Column("written_by_title", sa.String(), nullable=True),
        sa.Column("written_by_signature_url", sa.String(), nullable=True),
        sa.Column("approved_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by_name", sa.String(), nullable=True),
        sa.Column("approved_by_title", sa.String(), nullable=True),
        sa.Column("approved_by_signature_url", sa.String(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.Date(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.String(), nullable=True),
        sa.Column("return_reason", sa.String(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "purchase_order_attachments",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("purchase_order_id", sa.Integer(), sa.ForeignKey("purchase_orders.id"), nullable=False, index=True),
        sa.Column("label", sa.String(), nullable=False, server_default="Other"),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("stored_filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.add_column("notification_settings", sa.Column("company_legal_name", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("company_nif", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("company_phones", sa.String(), nullable=True))
    op.add_column("notification_settings", sa.Column("po_terms_conditions", sa.Text(), nullable=True))

    # Seed the single settings row (id=1, created by migration 0006) with
    # HMZC's own values, only where nothing has been entered yet.
    settings_table = sa.table(
        "notification_settings",
        sa.column("id", sa.Integer),
        sa.column("company_legal_name", sa.String),
        sa.column("company_nif", sa.String),
        sa.column("company_phones", sa.String),
        sa.column("po_terms_conditions", sa.Text),
    )
    op.execute(
        settings_table.update()
        .where(settings_table.c.id == 1)
        .values(
            company_legal_name=DEFAULT_LEGAL_NAME,
            company_nif=DEFAULT_NIF,
            company_phones=DEFAULT_PHONES,
            po_terms_conditions=DEFAULT_PO_TERMS,
        )
    )


def downgrade() -> None:
    op.drop_column("notification_settings", "po_terms_conditions")
    op.drop_column("notification_settings", "company_phones")
    op.drop_column("notification_settings", "company_nif")
    op.drop_column("notification_settings", "company_legal_name")
    op.drop_table("purchase_order_attachments")
    op.drop_table("purchase_orders")
