# FastAPI para criar rotas e gerenciar dependências

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

# Importa a sessão do banco de dados
from app.core.database import get_db

# Importa schemas e serviços do tenant
from app.tenants.schemas import TenantCreate, TenantResponse

logger = logging.getLogger(__name__)
from app.tenants import service

# Cria o roteador do módulo de tenants
# prefix="/tenants" significa que todas as rotas começam com /tenants
router = APIRouter(
    prefix="/tenants",
    tags=["Tenants"],  # Agrupa as rotas na documentação /docs
)


@router.post(
    "/",
    response_model=TenantResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_tenant(
    dados: TenantCreate,
    db: Session = Depends(get_db),
):
    """
    Cadastra um novo estabelecimento na plataforma AgendaFlow.
    Cria automaticamente o schema isolado no PostgreSQL.
    """
    try:
        tenant = service.criar_tenant(db, dados)
        return tenant
    except ValueError as e:
        # Retorna erro 400 se o slug já estiver em uso
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/{slug}",
    response_model=TenantResponse,
)
def buscar_tenant(
    slug: str,
    db: Session = Depends(get_db),
):
    """
    Busca um tenant pelo slug.
    Usado internamente para verificar se um estabelecimento existe.
    """
    tenant = service.buscar_tenant_por_slug(db, slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{slug}' não encontrado",
        )

    return tenant

@router.get("/{slug}/theme")
def buscar_tema_tenant(
    slug: str,
    db: Session = Depends(get_db),
):
    """
    Retorna as configurações visuais do tenant baseadas no segmento.
    Usado pelo frontend para aplicar o tema correto do estabelecimento.
    """
    try:
        tenant = service.buscar_tenant_por_slug(db, slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{slug}' não encontrado",
            )

        # Presets de tema por segmento
        presets = {
            "barbearia": {
                "tema": "dark",
                "cor_primaria": "#0EA5E9",
                "cor_secundaria": "#10B981",
                "titulo_profissional": "Barbeiro",
                "titulo_servico": "Corte",
            },
            "salao": {
                "tema": "light",
                "cor_primaria": "#EC4899",
                "cor_secundaria": "#8B5CF6",
                "titulo_profissional": "Cabeleireiro(a)",
                "titulo_servico": "Serviço",
            },
            "clinica_estetica": {
                "tema": "light",
                "cor_primaria": "#06B6D4",
                "cor_secundaria": "#0EA5E9",
                "titulo_profissional": "Especialista",
                "titulo_servico": "Procedimento",
            },
            "pilates": {
                "tema": "light",
                "cor_primaria": "#10B981",
                "cor_secundaria": "#06B6D4",
                "titulo_profissional": "Professor(a)",
                "titulo_servico": "Aula",
            },
            "tatuagem": {
                "tema": "dark",
                "cor_primaria": "#8B5CF6",
                "cor_secundaria": "#EC4899",
                "titulo_profissional": "Tatuador(a)",
                "titulo_servico": "Sessão",
            },
            "estetica_automotiva": {
                "tema": "dark",
                "cor_primaria": "#F59E0B",
                "cor_secundaria": "#EF4444",
                "titulo_profissional": "Especialista",
                "titulo_servico": "Serviço",
            },
        }

        # Retorna o preset do segmento ou um padrão genérico
        tema = presets.get(tenant.segment, {
            "tema": "dark",
            "cor_primaria": "#0EA5E9",
            "cor_secundaria": "#10B981",
            "titulo_profissional": "Profissional",
            "titulo_servico": "Serviço",
        })

        return {
            "slug": tenant.slug,
            "name": tenant.name,
            "segment": tenant.segment,
            **tema,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar tema do tenant '{slug}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar configurações do estabelecimento: {str(e)}",
        )
