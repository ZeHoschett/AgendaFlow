# Rota de provisionamento completo de um novo tenant
# Cria o tenant + schema + usuário admin em uma única operação
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr, field_validator

# Importa a sessão do banco de dados
from app.core.database import get_db

# Importa serviços necessários
from app.tenants import service as tenant_service
from app.tenants.schemas import TenantCreate
from app.core.security import hash_senha
from app.core.config import settings

# Cria o roteador de provisionamento
router = APIRouter(
    prefix="/provisioning",
    tags=["Provisionamento"],
)


def verificar_chave_provisionamento(
    x_provisioning_key: str = Header(..., alias="X-Provisioning-Key"),
):
    """Exige a chave secreta de provisionamento no header X-Provisioning-Key."""
    if x_provisioning_key != settings.PROVISIONING_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de provisionamento inválida",
        )


class ProvisionamentoCompleto(BaseModel):
    """
    Dados necessários para provisionar um novo cliente do SaaS.
    Cria o tenant, o schema isolado e o usuário admin em uma única operação.
    """

    # Dados do estabelecimento
    name: str           # Nome do estabelecimento — ex: "Barbearia do João"
    slug: str           # Slug único — ex: "barbearia-joao"
    segment: str        # Segmento — ex: "barbearia"

    # Dados do admin do estabelecimento
    admin_name: str           # Nome do responsável
    admin_email: EmailStr     # Email de acesso
    admin_password: str       # Senha inicial
    admin_phone: str = ""     # Telefone do responsável — DDD + número (10 ou 11 dígitos)

    @field_validator("admin_phone")
    @classmethod
    def validar_telefone(cls, v: str) -> str:
        if not v:
            return v
        digitos = "".join(c for c in v if c.isdigit())
        if len(digitos) not in (10, 11):
            raise ValueError("Telefone inválido — informe DDD + número (10 ou 11 dígitos)")
        return digitos


class ProvisionamentoResponse(BaseModel):
    """Resposta após provisionamento bem sucedido."""
    tenant_slug: str
    tenant_name: str
    admin_email: str
    link_onboarding: str
    link_cliente: str
    message: str


@router.post("/", response_model=ProvisionamentoResponse, status_code=status.HTTP_201_CREATED)
def provisionar_tenant(
    dados: ProvisionamentoCompleto,
    db: Session = Depends(get_db),
    _: None = Depends(verificar_chave_provisionamento),
):
    """
    Provisiona um novo cliente do AgendaFlow em uma única operação.

    Fluxo completo:
    1. Valida se o slug já existe
    2. Cria o tenant na tabela pública
    3. Cria o schema isolado no PostgreSQL
    4. Cria todas as tabelas dentro do schema
    5. Cria o usuário admin dentro do schema do tenant
    6. Retorna os links de acesso para enviar ao cliente

    Usado pelo SaaS Admin (você) para cadastrar novos clientes
    após fechar um contrato.
    """

    # Verifica se o slug já está em uso
    existente = db.execute(text("""
        SELECT id FROM public.tenants WHERE slug = :slug
    """), {"slug": dados.slug}).first()

    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Slug '{dados.slug}' já está em uso. Escolha outro.",
        )

    # Cria o tenant usando o serviço existente
    try:
        tenant_data = TenantCreate(
            name=dados.name,
            slug=dados.slug,
            segment=dados.segment,
        )
        tenant = tenant_service.criar_tenant(db, tenant_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    schema = tenant.schema_name

    # Verifica se o email do admin já existe no schema
    email_existente = db.execute(text(f"""
        SELECT id FROM "{schema}".users WHERE email = :email
    """), {"email": dados.admin_email}).first()

    if email_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{dados.admin_email}' já está cadastrado.",
        )

    # Cria o usuário admin dentro do schema do tenant
    db.execute(text(f"""
        INSERT INTO "{schema}".users
            (email, password_hash, role, full_name, phone)
        VALUES
            (:email, :password_hash, 'admin', :full_name, :phone)
    """), {
        "email": dados.admin_email,
        "password_hash": hash_senha(dados.admin_password),
        "full_name": dados.admin_name,
        "phone": dados.admin_phone,
    })

    db.commit()

    return ProvisionamentoResponse(
        tenant_slug=dados.slug,
        tenant_name=dados.name,
        admin_email=dados.admin_email,
        # Links prontos para enviar ao cliente
        link_onboarding=f"http://localhost:3000/login",
        link_cliente=f"http://localhost:3000/{dados.slug}",
        message=f"Tenant '{dados.name}' provisionado com sucesso. Envie o link de onboarding ao cliente.",
    )


@router.get("/")
def listar_tenants(
    db: Session = Depends(get_db),
    _: None = Depends(verificar_chave_provisionamento),
):
    """
    Lista todos os tenants cadastrados no AgendaFlow.
    Visão geral do SaaS Admin — todos os clientes ativos e inativos.
    """
    tenants = db.execute(text("""
        SELECT
            id,
            name,
            slug,
            segment,
            is_active,
            anamnese_concluida,
            tema,
            created_at
        FROM public.tenants
        ORDER BY created_at DESC
    """)).mappings().all()

    return [dict(t) for t in tenants]