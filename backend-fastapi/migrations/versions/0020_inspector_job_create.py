"""backfill jobs.create onto existing Inspector accounts

Revision ID: 0020_inspector_job_create
Revises: 0019_cert_number_counters
Create Date: 2026-08-09

Reported directly: "check the Create & close jobs as some technician
has been assigned this role but it cannot be changed, even when you
undo and click save." Root cause — jobs.create was a hardcoded role
default for Inspector (core/permissions.py), and User.extra_permissions
can only ever ADD to a role default, never subtract from one (see that
file's own comment). Unchecking "Create & close jobs" for a Technical
account in Manage Access saved fine, but get_user_permissions still
returned it via the role default regardless, so the checkbox always
reverted on reload — a true no-op, not a display bug.

jobs.create is no longer an Inspector role default as of this
migration's matching code change. This backfill grants it explicitly,
as a real extra_permissions entry, to every account that was an
Inspector *before* this change — so nobody's actual day-to-day ability
to open/close a job changes today. Only from this point on can an
admin actually revoke it for one specific person via Manage Access,
which is the whole point of the report above.
"""
from alembic import op
import sqlalchemy as sa

revision = "0020_inspector_job_create"
down_revision = "0019_cert_number_counters"
branch_labels = None
depends_on = None

JOB_CREATE = "jobs.create"


def upgrade() -> None:
    conn = op.get_bind()
    users = sa.table(
        "users",
        sa.column("id", sa.Integer),
        sa.column("role", sa.String),
        sa.column("extra_permissions", sa.JSON),
    )
    # role is a native Postgres enum (userrole) — cast to text to
    # compare against a plain string literal rather than relying on
    # SQLAlchemy to know about a type it wasn't told to reflect here.
    # The stored label is the Python enum MEMBER NAME ("INSPECTOR"),
    # not UserRole.INSPECTOR.value ("inspector") — SQLAlchemy's Enum
    # column persists .name by default unless values_callable says
    # otherwise, which this project's User.role column doesn't set
    # (see models/user.py) despite that file's own comment claiming
    # the stored value is lowercase. Confirmed directly against a live
    # database rather than trusting that comment.
    rows = conn.execute(
        sa.select(users.c.id, users.c.extra_permissions).where(sa.text("role::text = 'INSPECTOR'"))
    ).fetchall()
    for row in rows:
        current = list(row.extra_permissions or [])
        if JOB_CREATE not in current:
            current.append(JOB_CREATE)
            conn.execute(users.update().where(users.c.id == row.id).values(extra_permissions=current))


def downgrade() -> None:
    # Deliberately a no-op: reversing this would strip jobs.create from
    # every account that has it, including any granted or revoked by an
    # admin's own deliberate choice after this migration ran — there's
    # no way to distinguish "backfilled by this migration" from "granted
    # normally afterward" once both are just entries in the same list.
    pass
