# Pydantic é usado para validar e serializar dados da API

from pydantic import BaseModel, field_validator
from datetime import datetime
from uuid import UUID
import re


class TenantCreate(BaseModel):
    """
    Dados necessários para cadastrar um novo tenant.
    Esses são os campos que o formulário de cadastro envia para a API.
    """

    # Nome do estabelecimento
    name: str

    # Slug gerado a partir do nome — apenas letras minúsculas, números e hífens
    # Ex: "Nano Banana" vira "nano-banana"
    slug: str

    # Segmento do negócio escolhido na anamnese
    segment: str

    @field_validator("slug")
    @classmethod
    def slug_deve_ser_valido(cls, v: str) -> str:
        """
        Valida que o slug contém apenas caracteres permitidos em URLs.
        Impede slugs com espaços, acentos ou caracteres especiais
        que quebrariam a URL pública do cliente.
        """
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError(
                "Slug deve conter apenas letras minúsculas, números e hífens"
            )
        return v


class TenantResponse(BaseModel):
    """
    Dados retornados pela API após criar ou buscar um tenant.
    Nunca expõe campos sensíveis como schema_name.
    """

    id: UUID
    name: str
    slug: str
    segment: str
    is_active: bool
    created_at: datetime

    class Config:
        # Permite que o Pydantic leia dados diretamente do model SQLAlchemy
        from_attributes = True