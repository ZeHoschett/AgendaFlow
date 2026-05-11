import logging

# FastAPI para criar rotas e gerenciar dependências
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID
from typing import Optional
from pydantic import BaseModel

# Importa a sessão do banco de dados
from app.core.database import get_db
from app.core.security import requer_role

# Importa schemas de agendamento
from app.appointments.schemas import ServiceCreate

# Importa o serviço de tenant
from app.tenants import service as tenant_service

logger = logging.getLogger(__name__)


class ServicoUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    # Categoria para agrupamento visual — opcional, padrão "Geral"
    category: Optional[str] = "Geral"
    category_order: Optional[int] = 0

# Cria o roteador do módulo de serviços
router = APIRouter(
    prefix="/services",
    tags=["Serviços"],
)


@router.post("/{tenant_slug}", status_code=status.HTTP_201_CREATED)
def criar_servico(
    tenant_slug: str,
    dados: ServiceCreate,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Cria um novo serviço no estabelecimento.
    Usado pelo admin para cadastrar os serviços oferecidos.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        servico = db.execute(text(f"""
            INSERT INTO "{tenant.schema_name}".services
                (name, description, price, category, category_order)
            VALUES
                (:name, :description, :price, :category, :category_order)
            RETURNING id, name, description, price, category, category_order, is_active
        """), {
            "name": dados.name,
            "description": dados.description,
            "price": dados.price,
            "category": dados.category or "Geral",
            "category_order": dados.category_order or 0,
        }).mappings().first()

        db.commit()
        return dict(servico)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar serviço: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{tenant_slug}")
def listar_servicos(
    tenant_slug: str,
    db: Session = Depends(get_db),
):
    """
    Lista todos os serviços ativos do estabelecimento.
    Usado no portal do cliente para escolher o serviço.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        servicos = db.execute(text(f"""
            SELECT id, name, description, price, category, category_order, is_active
            FROM "{tenant.schema_name}".services
            WHERE is_active = true
            ORDER BY category_order ASC, category ASC, name ASC
        """)).mappings().all()

        return [dict(s) for s in servicos]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar serviços: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{tenant_slug}/{service_id}/products/{product_id}")
def vincular_produto_servico(
    tenant_slug: str,
    service_id: UUID,
    product_id: UUID,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Vincula um produto a um serviço como recomendação de upsell.
    Ex: vincula "Pomada Modeladora" ao serviço "Corte Degradê".
    Quando o cliente agendar esse serviço, verá esse produto sugerido.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        # Verifica se o vínculo já existe para evitar duplicata
        existente = db.execute(text(f"""
            SELECT service_id FROM "{tenant.schema_name}".service_products
            WHERE service_id = :service_id AND product_id = :product_id
        """), {
            "service_id": str(service_id),
            "product_id": str(product_id),
        }).first()

        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Produto já vinculado a esse serviço",
            )

        db.execute(text(f"""
            INSERT INTO "{tenant.schema_name}".service_products
                (service_id, product_id)
            VALUES
                (:service_id, :product_id)
        """), {
            "service_id": str(service_id),
            "product_id": str(product_id),
        })

        db.commit()
        return {"message": "Produto vinculado ao serviço com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao vincular produto ao serviço: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{tenant_slug}/{service_id}/products")
def listar_produtos_recomendados(
    tenant_slug: str,
    service_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Lista os produtos recomendados para um serviço específico.
    Usado no passo de upsell durante o fluxo de agendamento do cliente.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        produtos = db.execute(text(f"""
            SELECT p.id, p.name, p.description, p.price, p.stock
            FROM "{tenant.schema_name}".products p
            JOIN "{tenant.schema_name}".service_products sp ON sp.product_id = p.id
            WHERE sp.service_id = :service_id
            AND p.is_active = true
            AND p.stock > 0
            ORDER BY p.name ASC
        """), {"service_id": str(service_id)}).mappings().all()

        return [dict(p) for p in produtos]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar produtos recomendados: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{tenant_slug}/{service_id}")
def atualizar_servico(
    tenant_slug: str,
    service_id: UUID,
    dados: ServicoUpdate,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        resultado = db.execute(text(f"""
            UPDATE "{tenant.schema_name}".services
            SET name = :name,
                description = :description,
                price = :price,
                category = :category,
                category_order = :category_order
            WHERE id = :id
            AND is_active = true
            RETURNING id, name, description, price, category, category_order, is_active
        """), {
            "id": str(service_id),
            "name": dados.name,
            "description": dados.description,
            "price": dados.price,
            "category": dados.category or "Geral",
            "category_order": dados.category_order or 0,
        }).mappings().first()

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Serviço não encontrado",
            )

        db.commit()
        return dict(resultado)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar serviço: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{tenant_slug}/{service_id}")
def desativar_servico(
    tenant_slug: str,
    service_id: UUID,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Desativa um serviço do estabelecimento.
    Não deletamos — apenas marcamos como inativo para preservar histórico.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        db.execute(text(f"""
            UPDATE "{tenant.schema_name}".services
            SET is_active = false
            WHERE id = :id
        """), {"id": str(service_id)})

        db.commit()
        return {"message": "Serviço desativado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao desativar serviço: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
