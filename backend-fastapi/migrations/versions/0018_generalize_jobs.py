"""generalize loose_gear_jobs into a universal jobs table

Revision ID: 0018_generalize_jobs
Revises: 0017_add_loose_gear_jobs
Create Date: 2026-08-09

Requested directly: "the job creation number should be for all the
certificate, so that all certificate issued will stay under that job
number and easy to track, as the same vessel can be visited on
different occassion for different POs, include PO required, if PO not
available include a section for PO not available now[, and] if PO not
available allow to enter customer name." Renames the Loose-Gear-only
table from 0017 into a universal one every equipment type's
certificates now reference (see certificates.job_no below), and adds
the PO/customer identification fields.
"""
from alembic import op
import sqlalchemy as sa

revision = "0018_generalize_jobs"
down_revision = "0017_add_loose_gear_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table("loose_gear_jobs", "jobs")
    op.add_column("jobs", sa.Column("po_number", sa.String(), nullable=True))
    op.add_column("jobs", sa.Column("po_pending", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("jobs", sa.Column("customer_name", sa.String(), nullable=True))
    op.add_column("certificates", sa.Column("job_no", sa.String(), nullable=True))
    op.create_index("ix_certificates_job_no", "certificates", ["job_no"])


def downgrade() -> None:
    op.drop_index("ix_certificates_job_no", table_name="certificates")
    op.drop_column("certificates", "job_no")
    op.drop_column("jobs", "customer_name")
    op.drop_column("jobs", "po_pending")
    op.drop_column("jobs", "po_number")
    op.rename_table("jobs", "loose_gear_jobs")
