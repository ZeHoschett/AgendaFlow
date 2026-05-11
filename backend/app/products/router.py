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

# Importa schemas de agendamento — reutilizamos ProductCreate e ProductResponse
from app.appointments.schemas import ProductCreate, ProductResponse

# Importa o serviço de tenant
from app.tenants import service as tenant_service

logger = logging.getLogger(__name__)


class ProdutoUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    stock: int
    # Categoria para agrupamento visual — opcional, padrão "Geral"
    category: Optional[str] = "Geral"
    category_order: Optional[int] = 0

# Cria o roteador do módulo de produtos
router = APIRouter(
    prefix="/products",
    tags=["Produtos"],
)


@router.post("/{tenant_slug}", status_code=status.HTTP_201_CREATED)
def criar_produto(
    tenant_slug: str,
    dados: ProductCreate,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Cria um novo produto no estabelecimento.
    Usado pelo admin para cadastrar produtos disponíveis para upsell.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        produto = db.execute(text(f"""
            INSERT INTO "{tenant.schema_name}".products
                (name, description, price, stock, category, category_order)
            VALUES
                (:name, :description, :price, :stock, :category, :category_order)
            RETURNING id, name, description, price, stock, category, category_order, is_active
        """), {
            "name": dados.name,
            "description": dados.description,
            "price": dados.price,
            "stock": dados.stock,
            "category": dados.category or "Geral",
            "category_order": dados.category_order or 0,
        }).mappings().first()

        db.commit()
        return dict(produto)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar produto: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{tenant_slug}")
def listar_produtos(
    tenant_slug: str,
    db: Session = Depends(get_db),
):
    """
    Lista todos os produtos ativos do estabelecimento.
    Usado no upsell durante o fluxo de agendamento do cliente.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        produtos = db.execute(text(f"""
            SELECT id, name, description, price, stock, category, category_order, is_active
            FROM "{tenant.schema_name}".products
            WHERE is_active = true
            ORDER BY category_order ASC, category ASC, name ASC
        """)).mappings().all()

        return [dict(p) for p in produtos]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar produtos: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{tenant_slug}/{product_id}")
def atualizar_produto(
    tenant_slug: str,
    product_id: UUID,
    dados: ProdutoUpdate,
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
            UPDATE "{tenant.schema_name}".products
            SET name = :name,
                description = :description,
                price = :price,
                stock = :stock,
                category = :category,
                category_order = :category_order
            WHERE id = :id
            AND is_active = true
            RETURNING id, name, description, price, stock, category, category_order, is_active
        """), {
            "id": str(product_id),
            "name": dados.name,
            "description": dados.description,
            "price": dados.price,
            "stock": dados.stock,
            "category": dados.category or "Geral",
            "category_order": dados.category_order or 0,
        }).mappings().first()

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Produto não encontrado",
            )

        db.commit()
        return dict(resultado)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar produto: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{tenant_slug}/{product_id}")
def desativar_produto(
    tenant_slug: str,
    product_id: UUID,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Desativa um produto do estabelecimento.
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
            UPDATE "{tenant.schema_name}".products
            SET is_active = false
            WHERE id = :id
        """), {"id": str(product_id)})

        db.commit()
        return {"message": "Produto desativado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao desativar produto: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
