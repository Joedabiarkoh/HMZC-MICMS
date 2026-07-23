from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings

# .env.example ships SECRET_KEY=change_this_secret_key as a placeholder
# — a readiness review flagged that nothing stops that placeholder from
# actually being deployed, which would mean every JWT this app issues
# is signed with a secret anyone could find by reading a public example
# file. Rather than rely on someone remembering to change it, the app
# now refuses to start at all if it wasn't — a loud failure at startup
# instead of a silent vulnerability in production. Generate a real one
# with `openssl rand -hex 32` (or `python -c "import secrets;
# print(secrets.token_hex(32))"` if openssl isn't available) and put it
# in your real `.env` — never in a file that ships with the repo.
PLACEHOLDER_SECRET_KEY = "change_this_secret_key"
MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    APP_NAME: str
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # Was allow_origins=["*"] in main.py — actually invalid together with
    # allow_credentials=True (browsers silently reject a wildcard origin
    # combined with credentials, per the CORS spec), independent of
    # anything else. Configurable per environment rather than
    # hardcoding a guessed deployment URL: set CORS_ORIGINS in .env as a
    # comma-separated list for prod (e.g. your actual Railway/hosting
    # frontend URL); the default below covers local Vite dev only.
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Optional on purpose — unlike SECRET_KEY, there's no safe default to
    # refuse-to-start on here. An email feature (see core/email.py) that
    # requires a real SMTP account (Gmail app password, SendGrid,
    # Postmark, AWS SES, etc. — this app doesn't provide one, since that's
    # a real external account someone has to actually set up) shouldn't
    # block the whole API from starting just because it hasn't been
    # configured yet. When any of these are missing, send_email() logs a
    # clear warning and returns False instead of sending — see that
    # file's own comments for exactly what that means in practice.
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_USE_TLS: bool = True

    # Used to build the sign-in link in account-creation/password-reset
    # emails (core/email.py) — the backend has no way to know the
    # frontend's real deployed URL otherwise. Defaults to local Vite dev.
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_postgres_scheme(cls, v: str) -> str:
        # Some hosts (Render, formerly Heroku) hand out connection strings
        # starting "postgres://" — valid for libpq, but SQLAlchemy 2.x +
        # psycopg2 reject that scheme outright (NoSuchModuleError). Accept
        # either and normalize, rather than requiring every hosting
        # provider's copy-pasted URL to be hand-edited first.
        if v.startswith("postgres://"):
            return "postgresql://" + v[len("postgres://"):]
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_changed_and_strong(cls, v: str) -> str:
        if v == PLACEHOLDER_SECRET_KEY:
            raise ValueError(
                "SECRET_KEY is still the placeholder value from .env.example. "
                "Generate a real one (`openssl rand -hex 32`) and set it in your "
                "actual .env before starting this app — every login token is "
                "signed with this value, so leaving it as the public example "
                "means anyone can forge a valid login."
            )
        if len(v) < MIN_SECRET_KEY_LENGTH:
            raise ValueError(
                f"SECRET_KEY is only {len(v)} characters — use at least "
                f"{MIN_SECRET_KEY_LENGTH} (`openssl rand -hex 32` gives you 64)."
            )
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
