import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, JSON, String, func

from app.models.base import BaseModel

# Transcribed from the pasted Module 2 chat output (app/models/user.py) and
# adapted to fit this project's existing conventions:
#   - inherits from app.models.base.BaseModel (the project's own
#     `__abstract__` base) instead of importing Base directly, matching
#     how future models are expected to be written (see models/base.py).
#   - created_at/updated_at use server_default=func.now() rather than a
#     Python-side default, so the timestamp is set by Postgres itself.


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    # Stored value kept as "inspector" rather than renamed to "technical"
    # — renaming a Postgres enum value needs an ALTER TYPE ... RENAME
    # VALUE migration, which is riskier to get right without a live
    # database to test against than just labelling it "Technical"
    # everywhere it's shown to a person (see ROLE_LABELS in
    # core/permissions.py-adjacent frontend code) while leaving the
    # actual stored identifier alone.
    INSPECTOR = "inspector"
    FINANCE = "finance"
    CLIENT = "client"
    # Added for the Certificates/Finance access-separation request:
    # Sales, Administration, and Service Coordination all get the same
    # permissions by default (view + download certificates, no editing)
    # — kept as distinct roles rather than one generic "viewer" so it's
    # still visible on the Users page which department someone's
    # actually in, not just what they're allowed to do.
    SALES = "sales"
    ADMINISTRATION = "administration"
    SERVICE_COORDINATION = "service_coordination"
    # "Others with limited administrative role" — a baseline (see
    # ROLE_DEFAULT_PERMISSIONS) that the main administrator is expected
    # to extend per-person via User.extra_permissions below, not a
    # fixed bundle like every other role here.
    LIMITED_ADMIN = "limited_admin"


class User(BaseModel):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    # Was Column(Enum(UserRole), ...) with no explicit name — relied on
    # SQLAlchemy's default naming convention (lowercased class name) to
    # match what migrations/versions/0001_baseline.py independently
    # guessed the Postgres enum type would be called. That was flagged
    # directly as unverified (no live database to confirm it against)
    # in a project-readiness review. Naming it explicitly here removes
    # the guesswork entirely — both places now say "userrole" because
    # it's declared, not inferred.
    role = Column(Enum(UserRole, name="userrole"), default=UserRole.INSPECTOR, nullable=False)
    # Was default=True. New accounts now start inactive and need an
    # admin to approve them before they can sign in — see register_user
    # and the new approve_user/deactivate_user endpoints in
    # api/routes/auth.py. (The very first account ever created is an
    # exception — see the bootstrap note there.)
    is_active = Column(Boolean, default=False, nullable=False)
    # Set when an admin resets someone's password (see reset_user_password
    # in api/routes/auth.py) — forces a real password change on next
    # login instead of leaving them on a temporary one indefinitely, and
    # means the admin never continues to "know" the account's password.
    must_change_password = Column(Boolean, default=False, nullable=False)
    # Per-person permission grants beyond whatever their role gives by
    # default (see core/permissions.py's get_user_permissions) — a list
    # of permission strings like ["finance.edit"]. Only ever adds to the
    # role default, never used to take something away; set by an admin
    # via PATCH /auth/users/{id}/permissions. Empty list, not null, by
    # default — simplifies get_user_permissions (no None-check needed).
    extra_permissions = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def permissions(self):
        # Local import to avoid a circular import — core/permissions.py
        # imports User/UserRole from this module, so this can't be a
        # top-level import here. A property (not a Column) so every
        # existing route that returns a User/UserResponse picks this up
        # automatically via Pydantic's from_attributes, with no changes
        # needed at each individual return statement.
        from app.core.permissions import get_user_permissions
        return sorted(get_user_permissions(self))
