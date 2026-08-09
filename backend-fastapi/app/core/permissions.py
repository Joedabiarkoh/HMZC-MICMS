from typing import Set

from app.models.user import User, UserRole

# Requested directly: Technical issues certificates; Sales,
# Administration, and Service Coordination can see and download issued
# certificates but not change them; a "limited administrative" role can
# do some things across both Certificates and Finance, with exactly
# which things decided per-person by the main administrator.
#
# That last requirement — per-person, not just per-role — is why this
# isn't just a bigger role-check like get_current_admin_user/
# get_current_finance_user (api/deps.py) were before this. Two people
# with the same role can end up with different actual access: ROLE_
# DEFAULT_PERMISSIONS below is what a role grants automatically, and
# User.extra_permissions (see models/user.py) is what an admin has
# individually added on top for one specific person — never used to
# take permissions away below the role default, only to add to it.

CERT_VIEW = "certificates.view"      # see your OWN issued certificates, open/print/download them
CERT_VIEW_ALL = "certificates.view_all"  # see EVERYONE's issued certificates, not just your own
CERT_EDIT = "certificates.edit"      # create new certificates, save/finalize changes to existing ones
CERT_DELETE = "certificates.delete"

# Requested directly: "the job number creation should be... assigned
# to be assigned to someone as how it is for other roles or access" —
# a Job (models/job.py) has to exist before ANY certificate can be
# created (see JobPicker.tsx), so who's allowed to actually open/close
# one is its own, separately grantable permission rather than folded
# into certificates.edit — same shape as certificates.delete being its
# own permission below. jobs.view (list/search open jobs to join one,
# needed by the picker) is deliberately separate from jobs.create
# (open a brand-new job or close one) — day-to-day certificate work
# needs the former; the latter is the one an admin might want to
# restrict to specific people.
JOB_VIEW = "jobs.view"
JOB_CREATE = "jobs.create"

FIN_VIEW = "finance.view"            # see the dashboard, quotations, invoices, and search the item catalog
FIN_EDIT = "finance.edit"            # create/save quotations and invoices
FIN_DELETE = "finance.delete"
FIN_CATALOG_MANAGE = "finance.catalog_manage"  # add/edit the item/price catalog itself

USERS_MANAGE = "users.manage"        # approve/deactivate accounts, change roles, reset passwords

SUPPLIER_VIEW = "suppliers.view"      # download the boarding form template, see/download submitted forms
SUPPLIER_MANAGE = "suppliers.manage"  # upload a completed form, delete a submission

ALL_PERMISSIONS = {
    CERT_VIEW, CERT_VIEW_ALL, CERT_EDIT, CERT_DELETE,
    JOB_VIEW, JOB_CREATE,
    FIN_VIEW, FIN_EDIT, FIN_DELETE, FIN_CATALOG_MANAGE,
    USERS_MANAGE,
    SUPPLIER_VIEW, SUPPLIER_MANAGE,
}

# Every role gets at least an empty set — CLIENT included, deliberately:
# an external client account shouldn't see internal certificate/finance
# data by default just for existing. If a specific client needs to see
# something (e.g., their own vessel's certificates, once that kind of
# scoping exists), that's a case for extra_permissions on that one
# account, not a blanket default for every client.
#
# CERT_VIEW_ALL was added directly on request: "each person only sees
# what certificate he has issued, except the main admin who can see
# all." Technical/Inspector — the people who actually issue
# certificates — get CERT_VIEW only, meaning list_certificates
# (api/routes/certificates.py) filters them down to their own
# issued_by_id. Sales, Administration, and Service Coordination get
# CERT_VIEW_ALL too, on top of CERT_VIEW — their entire reason for
# existing in this permission model is company-wide visibility (see
# and download every certificate for clients/fleet tracking), not
# tracking their own issuance, since they don't issue any. Admin has it
# via ALL_PERMISSIONS below either way.
ROLE_DEFAULT_PERMISSIONS = {
    UserRole.ADMIN: set(ALL_PERMISSIONS),
    # jobs.view defaults on for Inspector alongside certificates.edit —
    # every certificate now requires a Job first (see JobPicker.tsx),
    # so without this the role that actually issues certificates
    # couldn't even find/join one. jobs.create is deliberately NOT a
    # role default here (was, until an admin reported it directly:
    # "some technician has been assigned this role but it cannot be
    # changed, even when you undo and click save" — extra_permissions
    # can only ADD to a role default, never subtract, so unchecking a
    # baked-in default like this was silently a no-op every time).
    # jobs.create is granted per-person instead, via Manage Access —
    # see migration 0020_inspector_job_create.py, which
    # grants it to every ALREADY-EXISTING Inspector as an explicit
    # extra_permissions entry at the moment this changed, so nobody's
    # actual day-to-day access changed — only whether an admin can
    # later revoke it for one specific person, which now actually
    # works.
    UserRole.INSPECTOR: {CERT_VIEW, CERT_EDIT, JOB_VIEW},  # "Technical" in the UI — see the note in models/user.py on why the stored value isn't renamed
    UserRole.SALES: {CERT_VIEW, CERT_VIEW_ALL, SUPPLIER_VIEW},
    # Supplier boarding paperwork is the kind of thing Administration
    # actually processes day to day, so they get suppliers.manage
    # (upload/delete a submission) on top of the company-wide visibility
    # every other role in this "sees everything" group already has —
    # Sales/Service Coordination get view-only, same reasoning as their
    # existing certificates.view_all-but-not-edit split above.
    UserRole.ADMINISTRATION: {CERT_VIEW, CERT_VIEW_ALL, SUPPLIER_VIEW, SUPPLIER_MANAGE},
    UserRole.SERVICE_COORDINATION: {CERT_VIEW, CERT_VIEW_ALL, SUPPLIER_VIEW},
    UserRole.FINANCE: {FIN_VIEW, FIN_EDIT, SUPPLIER_VIEW, SUPPLIER_MANAGE},
    UserRole.LIMITED_ADMIN: {CERT_VIEW, FIN_VIEW},  # baseline only — the admin is expected to grant specific extras per person
    UserRole.CLIENT: set(),
}


def get_user_permissions(user: User) -> Set[str]:
    base = set(ROLE_DEFAULT_PERMISSIONS.get(user.role, set()))
    extra = set(user.extra_permissions or [])
    return base | extra
