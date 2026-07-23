from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_database
from app.core.permissions import get_user_permissions
from app.models.user import User, UserRole
from app.schemas.user import TokenData

# Transcribed from the pasted Module 2 chat output (app/api/deps.py) with
# three adaptations to match what already existed in this project before
# this module was added:
#   - SECRET_KEY/ALGORITHM come from app.core.config.settings (already the
#     project's config pattern) instead of re-reading os.getenv directly.
#   - get_db -> app.core.database.get_database (existing function name).
#   - tokenUrl points at /api/auth/login, matching how auth.router is
#     mounted in main.py (see notes there).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    db: Session = Depends(get_database),
    token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=int(user_id))
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return user


# Not in the pasted chat output — added so the new "who has signed up, who's
# working at each level" admin visibility (requested alongside this code)
# has a real dependency to gate on, rather than checking user.role inline
# in every route that needs it.
def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires administrator access.",
        )
    return current_user


# Added for the Certificates/Finance access-separation request: Technical
# issues certificates, Sales/Administration/Service Coordination can view
# and download but not edit, and a "limited administrative" role can be
# granted specific extra permissions per person — none of that fits a
# fixed small set of role-check functions like get_current_admin_user
# above (kept as-is — certificates.py's delete and every admin-only
# endpoint in auth.py still use it unchanged). This is a dependency
# *factory* — call it with the permission string a route needs, e.g.
# Depends(require_permission(CERT_EDIT)) — rather than a fixed
# dependency, since the actual check (get_user_permissions, see
# core/permissions.py) is the same for every permission, only which
# string it's checking for differs per route. Replaced a narrower
# get_current_finance_user that only checked role == finance/admin —
# every route that used it now checks a specific permission instead
# (finance.view or finance.edit), which is what actually lets a
# limited-admin be granted finance access without also being made a
# full Finance-role account.
def require_permission(permission: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if permission not in get_user_permissions(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the '{permission}' permission.",
            )
        return current_user

    return checker
