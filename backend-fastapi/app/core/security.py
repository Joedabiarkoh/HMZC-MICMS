from datetime import datetime, timedelta
from secrets import choice
from string import ascii_lowercase, ascii_uppercase, digits

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# The original chat only specified JWT creation, not password hashing.
# passlib[bcrypt] is in requirements.txt (it's used for "Password Hashing"
# in Module 2), so the hashing helpers are added here for consistency.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict):
    payload = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload.update({"exp": expire})

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# Added for admin-initiated password resets (see reset_user_password in
# api/routes/auth.py). Uses `secrets.choice`, not `random` — this needs
# to be unguessable, not just varied. Deliberately excludes visually
# ambiguous characters (0/O, 1/l/I) since an admin is going to read this
# out loud or type it somewhere for someone else to enter.
def generate_temporary_password(length: int = 10) -> str:
    alphabet = (ascii_uppercase + ascii_lowercase + digits).translate(str.maketrans("", "", "0O1lI"))
    return "".join(choice(alphabet) for _ in range(length))
