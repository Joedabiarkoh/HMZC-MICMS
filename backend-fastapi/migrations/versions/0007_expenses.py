"""add expenses table

Revision ID: 0007_expenses
Revises: 0006_notification_settings
Create Date: 2026-07-28

A simple company-wide expense ledger (category, amount, date, note),
with an optional vessel_name so a cost can be attributed to a specific
job when relevant — see models/expense.py's own comment. Needed before
Job Costing can show a real profit-per-vessel number, since profit is
revenue (paid invoices) minus tracked cost, and there was previously no
cost data anywhere in this system at all.
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_expenses"
down_revision = "0006_notification_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("expense_date", sa.String(), nullable=False),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("vessel_name", sa.String(), nullable=True),
        sa.Column("logged_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("expenses")
