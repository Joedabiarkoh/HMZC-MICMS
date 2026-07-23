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

FIN_VIEW = "finance.view"            # see the dashboard, quotations, invoices, and search the item catalog
FIN_EDIT = "finance.edit"            # create/save quotations and invoices
FIN_DELETE = "finance.delete"
FIN_CATALOG_MANAGE = "finance.catalog_manage"  # add/edit the item/price catalog itself

USERS_MANAGE = "users.manage"        # approve/deactivate accounts, change roles, reset passwords

ALL_PERMISSIONS = {
    CERT_VIEW, CERT_VIEW_ALL, CERT_EDIT, CERT_DELETE,
    FIN_VIEW, FIN_EDIT, FIN_DELETE, FIN_CATALOG_MANAGE,
    USERS_MANAGE,
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
    UserRole.INSPECTOR: {CERT_VIEW, CERT_EDIT},  # "Technical" in the UI — see the note in models/user.py on why the stored value isn't renamed
    UserRole.SALES: {CERT_VIEW, CERT_VIEW_ALL},
    UserRole.ADMINISTRATION: {CERT_VIEW, CERT_VIEW_ALL},
    UserRole.SERVICE_COORDINATION: {CERT_VIEW, CERT_VIEW_ALL},
    UserRole.FINANCE: {FIN_VIEW, FIN_EDIT},
    UserRole.LIMITED_ADMIN: {CERT_VIEW, FIN_VIEW},  # baseline only — the admin is expected to grant specific extras per person
    UserRole.CLIENT: set(),
}


def get_user_permissions(user: User) -> Set[str]:
    base = set(ROLE_DEFAULT_PERMISSIONS.get(user.role, set()))
    extra = set(user.extra_permissions or [])
    return base | extra
