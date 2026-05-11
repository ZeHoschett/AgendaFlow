# Pydantic para validação de dados da API


from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from uuid import UUID
from typing import Optional


class UserCreate(BaseModel):
    """
    Dados necessários para registrar um novo usuário.
    Usado pelo admin ao cadastrar profissionais ou pelo cliente ao se registrar.
    """

    full_name: str
    email: EmailStr  # Valida automaticamente se o email é válido
    password: str
    phone: Optional[str] = None

    # Role define o nível de acesso do usuário no sistema
    # admin: dono do estabelecimento
    # professional: profissional do estabelecimento
    # client: cliente final
    role: str = "client"

    @field_validator("password")
    @classmethod
    def validar_forca_senha(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("A senha deve ter pelo menos 8 caracteres")
        if not any(c.isupper() for c in v):
            raise ValueError("A senha deve ter pelo menos 1 letra maiúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("A senha deve ter pelo menos 1 número")
        return v

    @field_validator("phone")
    @classmethod
    def validar_telefone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        digitos = "".join(c for c in v if c.isdigit())
        if len(digitos) not in (10, 11):
            raise ValueError("Telefone inválido — informe DDD + número (10 ou 11 dígitos)")
        return digitos


class UserResponse(BaseModel):
    """
    Dados retornados pela API após criar ou buscar um usuário.
    Nunca retornamos o password_hash — apenas dados seguros.
    """

    id: UUID
    full_name: str
    email: str
    role: str
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    """
    Dados enviados pelo usuário na tela de login.
    """

    email: EmailStr
    password: str

    # Slug do tenant — identifica qual estabelecimento o usuário pertence
    # Ex: "nano-banana"
    tenant_slug: str


class TokenResponse(BaseModel):
    """
    Resposta retornada após login bem sucedido.
    O access_token é o JWT que o frontend guarda e envia em cada request.
    """

    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str


class LoginResponse(BaseModel):
    """
    Resposta do login com autenticação via cookie HttpOnly.
    O token não é exposto no JSON — o browser gerencia o cookie automaticamente.
    """

    role: str
    full_name: str
    user_id: str