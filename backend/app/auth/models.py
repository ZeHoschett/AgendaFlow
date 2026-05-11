# Importações do SQLAlchemy para definir colunas e tipos de dados


from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

# Importa a classe Base que registra todos os models no SQLAlchemy
from app.core.database import Base


class User(Base):
    """
    Representa um usuário dentro de um tenant.
    Essa tabela é criada dentro do schema de cada tenant — não no schema público.
    
    Um usuário pode ter 3 roles:
    - admin: dono do estabelecimento — acesso total
    - professional: barbeiro, cabeleireiro, etc — acesso à sua agenda
    - client: cliente final — acesso ao portal de agendamento
    """

    __tablename__ = "users"

    # Identificador único universal
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    # Email usado para login — único dentro do tenant
    
    email = Column(String(255), unique=True, nullable=False, index=True)

    # Hash da senha — nunca salvamos a senha original
    password_hash = Column(String(255), nullable=False)

    # Permissão do usuário no sistema
    role = Column(String(20), nullable=False)

    # Nome completo do usuário
    full_name = Column(String(255), nullable=False)

    # Telefone — usado para notificações WhatsApp
    phone = Column(String(20), nullable=True)

    # Controla se o usuário está ativo
    is_active = Column(Boolean, default=True, nullable=False)

    # Data de cadastro — gerada automaticamente
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )