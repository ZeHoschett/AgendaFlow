# Importações padrão do Alembic para gerenciar migrations
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Importa o Base que contém todos os models registrados
# O Alembic precisa conhecer os models para gerar as migrations automaticamente
from app.core.database import Base

# Importa os models explicitamente para que o Alembic os detecte
# Cada model importado aqui será monitorado para mudanças
from app.tenants.models import Tenant

# Configuração padrão do Alembic — lê o alembic.ini
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Informa ao Alembic quais tabelas monitorar
# target_metadata = None significa que o Alembic não gera migrations automáticas
# Com o Base.metadata ele detecta todos os models importados acima
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Executa migrations sem conexão ativa com o banco.
    Útil para gerar scripts SQL para revisar antes de aplicar.
    """
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
    """
    Executa migrations com conexão ativa ao banco.
    Modo padrão usado no desenvolvimento e produção.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


# Decide qual modo usar baseado no contexto de execução
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()