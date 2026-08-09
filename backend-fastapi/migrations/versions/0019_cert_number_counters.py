"""add cert_number_counters, drop unused jobs.next_item_seq

Revision ID: 0019_cert_number_counters
Revises: 0018_generalize_jobs
Create Date: 2026-08-09

Requested directly: "the loose gear seems to use only job number, the
two section, make one certificate number which keep count for the
certificate of loose gear created under that job number while the job
number stays same for all those certificate." See
models/cert_number_counter.py for the full reasoning — Loose Gear's
own cert_no is now generated from a (tag, date) atomic counter, the
same shape every other equipment type's client-side generateCertNo
already uses, instead of being the Job's own job_no with a suffix
appended. jobs.next_item_seq was that suffix's source and has no other
use now that certificate_count (a real query, added in 0018's own
follow-up work) already covers "how many certificates under this job."
"""
from alembic import op
import sqlalchemy as sa

revision = "0019_cert_number_counters"
down_revision = "0018_generalize_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cert_number_counters",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("tag", sa.String(), nullable=False),
        sa.Column("date_key", sa.String(), nullable=False),
        sa.Column("next_seq", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("tag", "date_key", name="uq_cert_number_counters_tag_date"),
    )
    op.drop_column("jobs", "next_item_seq")


def downgrade() -> None:
    op.add_column("jobs", sa.Column("next_item_seq", sa.Integer(), nullable=False, server_default="1"))
    op.drop_table("cert_number_counters")
