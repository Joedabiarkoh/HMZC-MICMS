"""add loose_gear_jobs table

Revision ID: 0017_add_loose_gear_jobs
Revises: 0016_conditions_to_quotations
Create Date: 2026-08-09

Requested directly: "before you create a certificate job number must
be created for you and all the certificate that will be created
within that job number will be grouped under that job number and
once the job is completed that job number can be closed and no other
certificate can be created using that job number." A vessel's Loose
Gear inspection can take days and produce hundreds of individual item
certificates — this table is the real, enforced parent record they
attach to, replacing the old client-guessed jobNo free-text field
(kept on LooseGearStandardReportData only for certificates that
predate this table).
"""
from alembic import op
import sqlalchemy as sa

revision = "0017_add_loose_gear_jobs"
down_revision = "0016_conditions_to_quotations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "loose_gear_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("job_no", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("vessel_name", sa.String(), nullable=False, index=True),
        sa.Column("imo_no", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="open"),
        sa.Column("next_item_seq", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("closed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("loose_gear_jobs")
