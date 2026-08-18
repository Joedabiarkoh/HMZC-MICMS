from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole

# Transcribed from the pasted Module 2 chat output (app/schemas/user.py).
# No adaptation needed here — only the model/security imports elsewhere
# had to change to match this project's existing structure.


# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.INSPECTOR


# Request schema for user creation. `is_active` deliberately isn't a
# field here (it was on UserBase before) — whether a new account starts
# active is a server-side decision (see register_user's bootstrap/
# approval logic), not something a registration request should be able
# to set directly.
class UserCreate(UserBase):
    password: str


# Response schema for returning a user
class UserResponse(UserBase):
    id: int
    is_active: bool
    must_change_password: bool
    # Read from User.permissions (a computed @property, not a real
    # column — see models/user.py) rather than exposing extra_permissions
    # directly: this is role defaults + extras already combined into the
    # actual final answer to "what can this person do," which is what
    # the frontend needs to gate UI on, not the raw pieces that produced it.
    permissions: List[str]
    created_at: datetime
    # URL of this user's saved default signature, if they've set one (see
    # User.saved_signature_url) — None for accounts that never sign a
    # certificate, or that just haven't saved one yet.
    saved_signature_url: Optional[str] = None

    class Config:
        from_attributes = True


# JWT Token Response Schema
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ---- Added for admin-assisted password recovery and self-service change ----

class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class PasswordResetResult(BaseModel):
    # The plaintext temporary password is returned exactly once, here,
    # to the admin who requested the reset — never stored in plaintext,
    # never logged (see record_audit's call site), and unrecoverable
    # after this response. The admin's job is to relay it to the person
    # through some other channel (phone call, in person, chat) right
    # now, not to keep it.
    temporary_password: str
    user: UserResponse
    # True if an email was actually sent (SMTP configured and the send
    # succeeded) — see core/email.py. The temporary password is still
    # returned above either way, so the admin can relay it manually if
    # this is False (email not configured, or the send failed) rather
    # than the person being silently locked out with no way in.
    email_sent: bool = False


# Requested directly, from the UX audit: "for a field team that will
# absolutely forget passwords, [no self-service reset] isn't optional
# polish, it's a support-ticket generator waiting to happen." Public
# (no-auth) request — deliberately NOT the same shape as
# PasswordResetResult above: this is self-service, so the plaintext
# temporary password can never come back in this response the way it
# does for an admin-initiated reset (an admin is a trusted party
# reading their own request's response; here the caller is anonymous
# and could be typing in anyone's email, so returning the password
# would let anyone take over any account just by knowing its email
# address). The email is the only channel the new credential travels
# through.
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# Requested directly: only an admin creates accounts, not self-service
# sign-up. No `is_active`/`must_change_password` here — those are
# always True/True for an admin-created account (see create_user in
# api/routes/auth.py), not something the request body controls.
class AdminCreateUser(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.INSPECTOR


# ---- Added for the Certificates/Finance permission-separation request ----

class PermissionUpdate(BaseModel):
    # The raw extra_permissions list to store — see the field's comment
    # in models/user.py. Not validated against ALL_PERMISSIONS here on
    # purpose: that check lives in the route (api/routes/auth.py) so the
    # error message can name exactly which permission string was invalid.
    extra_permissions: List[str]


# Requested directly: "let admin be able to work on the profile and
# make changes in how the account name for users or email changes" —
# an admin correcting a typo'd name or a changed email address, not
# the account holder themselves (that's a separate, not-yet-built
# self-service flow). Both fields optional so the admin can send just
# the one they're actually changing.
class AdminUpdateProfile(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None


# ---- Added for per-user reusable signatures ----

class SignatureUpdate(BaseModel):
    # A data:image/...;base64,... URI, same shape SignatureCanvas.tsx
    # already produces for a certificate's own signature fields — see
    # core/photo_storage.py's externalize_signature for how this gets
    # turned into a stored file + URL.
    signature: str
