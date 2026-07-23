from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Makes every model register itself with Base.metadata before Alembic
# reads target_metadata below — the same reason app/models/__init__.py
# imports every model explicitly (see its own comment) rather than
# relying on whichever route module happened to import them first.
import app.models  # noqa: F401
from app.core.config import settings
from app.core.database import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Read the real connection string from this project's own settings
# (backed by .env — see core/config.py) instead of duplicating it in
# alembic.ini, where it could silently drift out of sync with the one
# the actual app uses.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Generates SQL without a live DB connection (`alembic upgrade head --sql`)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Normal path — runs migrations against a real, connected database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
