# SQLAlchemy é o ORM que usamos para conversar com o PostgreSQL
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Importa as configurações centrais do projeto
from app.core.config import settings

# Cria o motor de conexão com o banco de dados
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Testa se a conexão ainda está viva antes de usar
    pool_size=10,        # Máximo de conexões simultâneas no pool
    max_overflow=20,     # Conexões extras permitidas em pico de uso
)

# Fábrica de sessões — cada request da API abre uma sessão e fecha ao terminar
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Classe base para todos os models do projeto
# Usando declarative_base() clássico — compatível com todas as versões do SQLAlchemy 2.0
Base = declarative_base()


def get_db():
    """
    Gerador de sessão do banco de dados.
    Usado como dependência nas rotas do FastAPI.
    Abre uma sessão antes do request e fecha automaticamente após.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 