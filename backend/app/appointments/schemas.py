# Pydantic para validação de dados da API


from pydantic import BaseModel
from datetime import date, time, datetime
from uuid import UUID
from typing import Optional, List


class ServiceCreate(BaseModel):
    """Dados para criar um novo serviço no estabelecimento."""
    name: str
    description: Optional[str] = None
    price: float
    # Categoria para agrupamento visual — opcional, padrão "Geral"
    category: Optional[str] = "Geral"
    category_order: Optional[int] = 0


class ServiceResponse(BaseModel):
    """Dados retornados ao buscar um serviço."""
    id: UUID
    name: str
    description: Optional[str] = None
    price: float
    category: Optional[str] = "Geral"
    category_order: Optional[int] = 0
    is_active: bool

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    """Dados para criar um novo produto no estabelecimento."""
    name: str
    description: Optional[str] = None
    price: float
    stock: int = 0
    # Categoria para agrupamento visual — opcional, padrão "Geral"
    category: Optional[str] = "Geral"
    category_order: Optional[int] = 0


class ProductResponse(BaseModel):
    """Dados retornados ao buscar um produto."""
    id: UUID
    name: str
    description: Optional[str] = None
    price: float
    stock: int
    category: Optional[str] = "Geral"
    category_order: Optional[int] = 0
    is_active: bool

    class Config:
        from_attributes = True


class AppointmentCreate(BaseModel):
    """
    Dados enviados pelo cliente para criar um agendamento.
    client_id é opcional — cliente pode agendar sem estar cadastrado.
    """
    client_name: str
    client_phone: str
    professional_id: UUID
    service_id: UUID
    scheduled_date: date
    scheduled_time: time
    notes: Optional[str] = None
    # Produtos selecionados no upsell — pode ser vazio
    product_ids: Optional[List[UUID]] = []
    # Serviços adicionais além do principal (service_id) — informativos por enquanto
    service_ids: Optional[List[UUID]] = []


class AppointmentResponse(BaseModel):
    """Dados retornados ao criar ou buscar um agendamento."""
    id: UUID
    client_name: str
    client_phone: str
    professional_id: UUID
    service_id: UUID
    scheduled_date: date
    scheduled_time: time
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AvailableSlot(BaseModel):
    """
    Representa um horário disponível para agendamento.
    Retornado ao cliente quando ele escolhe data e profissional.
    """
    time: str          # Ex: "09:00"
    period: str        # "manha", "tarde" ou "noite"
    available: bool
    # Se o profissional escolhido estiver ocupado, sugere alternativas
    alternative_professionals: Optional[List[dict]] = []