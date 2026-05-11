# Importações do SQLAlchemy para definir colunas e tipos de dados
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

# Importa a classe Base que registra todos os models no SQLAlchemy
from app.core.database import Base


class Tenant(Base):
    """
    Representa um estabelecimento cadastrado na plataforma AgendaFlow.
    Cada registro aqui é um cliente do SaaS (barbearia, salão, clínica, etc).
    Essa tabela fica no schema público — visível para toda a aplicação.
    """

    __tablename__ = "tenants"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    name = Column(String(255), nullable=False)

    slug = Column(String(100), unique=True, nullable=False, index=True)

    schema_name = Column(String(100), unique=True, nullable=False)

    segment = Column(String(50), nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )