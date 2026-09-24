from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

from messfit_api.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# alembic doesn't speak asyncpg; swap the driver for sync psycopg / psycopg2
sync_url = settings.database_url.replace("+asyncpg", "")
# ConfigParser treats "%" as interpolation; a percent-encoded password (e.g. %40)
# must have it doubled or alembic refuses to start.
config.set_main_option("sqlalchemy.url", sync_url.replace("%", "%%"))

from messfit_api.db import Base
# Import all model modules so they register with Base
from messfit_api.auth import models as auth_models
from messfit_api.profile import models as profile_models
from messfit_api.mess import models as mess_models
from messfit_api.chatbot import models as chatbot_models
from messfit_api.notifications import models as notif_models
from messfit_api.tracking import models as tracking_models
from messfit_api.workouts import models as workouts_models

target_metadata = Base.metadata


def run_migrations_offline() -> None:
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
