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

# Importa o serviço de tenant
from app.tenants import service as tenant_service

# Importa funções de segurança para hash de senha
from app.core.security import hash_senha, requer_role

logger = logging.getLogger(__name__)

# Cria o roteador do módulo de profissionais
router = APIRouter(
    prefix="/professionals",
    tags=["Profissionais"],
)


class ProfissionalCreate(BaseModel):
    """
    Dados para cadastrar um novo profissional.
    commission_rate é opcional — só aparece no dashboard se configurado.
    """
    full_name: str
    email: str
    password: str
    phone: Optional[str] = None
    # Percentual de comissão por serviço — ex: 10.0 = 10%
    # Se 0 ou não informado, profissional tem salário fixo sem comissão
    commission_rate: Optional[float] = 0.0


class ProfissionalUpdate(BaseModel):
    full_name: str
    phone: Optional[str] = None
    commission_rate: Optional[float] = 0.0


@router.post("/{tenant_slug}", status_code=status.HTTP_201_CREATED)
def cadastrar_profissional(
    tenant_slug: str,
    dados: ProfissionalCreate,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Cadastra um novo profissional no estabelecimento.
    Usado pelo admin para adicionar membros da equipe.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        # Verifica se já existe profissional com esse email
        existente = db.execute(text(f"""
            SELECT id FROM "{tenant.schema_name}".users
            WHERE email = :email
        """), {"email": dados.email}).first()

        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{dados.email}' já está cadastrado",
            )

        # Cria o profissional com role fixo 'professional'
        profissional = db.execute(text(f"""
            INSERT INTO "{tenant.schema_name}".users
                (email, password_hash, role, full_name, phone, commission_rate)
            VALUES
                (:email, :password_hash, 'professional', :full_name, :phone, :commission_rate)
            RETURNING id, email, role, full_name, phone, commission_rate, is_active, created_at
        """), {
            "email": dados.email,
            "password_hash": hash_senha(dados.password),
            "full_name": dados.full_name,
            "phone": dados.phone,
            "commission_rate": dados.commission_rate,
        }).mappings().first()

        db.commit()
        return dict(profissional)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao cadastrar profissional: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{tenant_slug}")
def listar_profissionais(
    tenant_slug: str,
    db: Session = Depends(get_db),
):
    """
    Lista todos os profissionais ativos do estabelecimento.
    Usado no portal do cliente para escolher o profissional.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        profissionais = db.execute(text(f"""
            SELECT id, full_name, phone, commission_rate, is_active
            FROM "{tenant.schema_name}".users
            WHERE role = 'professional'
            AND is_active = true
            ORDER BY full_name ASC
        """)).mappings().all()

        return [dict(p) for p in profissionais]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar profissionais: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{tenant_slug}/{professional_id}/dashboard")
def dashboard_profissional(
    tenant_slug: str,
    professional_id: UUID,
    mes: int = None,
    ano: int = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin", "professional"])),
):
    """
    Retorna o dashboard do profissional.
    Mostra faturamento, comissão e histórico de atendimentos do mês.
    Comissão só aparece se commission_rate > 0.
    """
    try:
        from datetime import date
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        hoje = date.today()
        mes_busca = mes or hoje.month
        ano_busca = ano or hoje.year
        schema = tenant.schema_name

        # Busca dados do profissional incluindo taxa de comissão
        profissional = db.execute(text(f"""
            SELECT id, full_name, commission_rate
            FROM "{schema}".users
            WHERE id = :id AND role = 'professional'
        """), {"id": str(professional_id)}).mappings().first()

        if not profissional:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profissional não encontrado",
            )

        # Contagem de atendimentos e faturamento do serviço principal
        faturamento = db.execute(text(f"""
            SELECT
                COUNT(a.id) as total_atendimentos,
                COALESCE(SUM(s.price), 0) as fat_servicos_principal
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            WHERE a.professional_id = :prof_id
            AND a.status = 'completed'
            AND EXTRACT(MONTH FROM a.scheduled_date) = :mes
            AND EXTRACT(YEAR FROM a.scheduled_date) = :ano
        """), {
            "prof_id": str(professional_id),
            "mes": mes_busca,
            "ano": ano_busca,
        }).mappings().first()

        # Faturamento de serviços adicionais (appointment_services)
        fat_servicos_adicionais = db.execute(text(f"""
            SELECT COALESCE(SUM(s2.price), 0) as total
            FROM "{schema}".appointments a
            JOIN "{schema}".appointment_services aserv ON aserv.appointment_id = a.id
            JOIN "{schema}".services s2 ON s2.id = aserv.service_id
            WHERE a.professional_id = :prof_id
            AND a.status = 'completed'
            AND EXTRACT(MONTH FROM a.scheduled_date) = :mes
            AND EXTRACT(YEAR FROM a.scheduled_date) = :ano
        """), {
            "prof_id": str(professional_id),
            "mes": mes_busca,
            "ano": ano_busca,
        }).mappings().first()

        # Faturamento de produtos vendidos nos atendimentos
        fat_produtos = db.execute(text(f"""
            SELECT COALESCE(SUM(p.price), 0) as total
            FROM "{schema}".appointments a
            JOIN "{schema}".appointment_products ap ON ap.appointment_id = a.id
            JOIN "{schema}".products p ON p.id = ap.product_id
            WHERE a.professional_id = :prof_id
            AND a.status = 'completed'
            AND EXTRACT(MONTH FROM a.scheduled_date) = :mes
            AND EXTRACT(YEAR FROM a.scheduled_date) = :ano
        """), {
            "prof_id": str(professional_id),
            "mes": mes_busca,
            "ano": ano_busca,
        }).mappings().first()

        # Histórico com total de produtos e serviços adicionais por atendimento
        historico = db.execute(text(f"""
            SELECT
                a.id,
                a.client_name,
                TO_CHAR(a.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
                a.scheduled_time,
                a.status,
                s.name as service_name,
                s.price as service_price,
                COALESCE((
                    SELECT SUM(s2.price)
                    FROM "{schema}".appointment_services aserv
                    JOIN "{schema}".services s2 ON s2.id = aserv.service_id
                    WHERE aserv.appointment_id = a.id
                ), 0) as servicos_adicionais_total,
                COALESCE((
                    SELECT SUM(p.price)
                    FROM "{schema}".appointment_products ap
                    JOIN "{schema}".products p ON p.id = ap.product_id
                    WHERE ap.appointment_id = a.id
                ), 0) as produto_total
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            WHERE a.professional_id = :prof_id
            AND EXTRACT(MONTH FROM a.scheduled_date) = :mes
            AND EXTRACT(YEAR FROM a.scheduled_date) = :ano
            ORDER BY a.scheduled_date DESC, a.scheduled_time DESC
        """), {
            "prof_id": str(professional_id),
            "mes": mes_busca,
            "ano": ano_busca,
        }).mappings().all()

        # Combina serviços (principal + adicionais) e produtos
        faturamento_servicos = float(faturamento["fat_servicos_principal"]) + float(fat_servicos_adicionais["total"])
        faturamento_produtos = float(fat_produtos["total"])
        faturamento_total = faturamento_servicos + faturamento_produtos
        commission_rate = float(profissional["commission_rate"])

        # Comissão calculada sobre o faturamento total (serviços + produtos)
        comissao = round(faturamento_total * (commission_rate / 100), 2) if commission_rate > 0 else None

        return {
            "profissional": profissional["full_name"],
            "periodo": f"{mes_busca:02d}/{ano_busca}",
            "total_atendimentos": int(faturamento["total_atendimentos"]),
            "faturamento_servicos": round(faturamento_servicos, 2),
            "faturamento_produtos": round(faturamento_produtos, 2),
            "faturamento_total": round(faturamento_total, 2),
            "commission_rate": commission_rate,
            "comissao_a_receber": comissao,
            "historico": [
                {
                    "id": str(h["id"]),
                    "client_name": h["client_name"],
                    "scheduled_date": h["scheduled_date"],
                    "scheduled_time": str(h["scheduled_time"])[:5],
                    "status": h["status"],
                    "service_name": h["service_name"],
                    "service_price": float(h["service_price"]),
                    "servicos_adicionais_total": float(h["servicos_adicionais_total"]),
                    "produto_total": float(h["produto_total"]),
                    "total_item": float(h["service_price"]) + float(h["servicos_adicionais_total"]) + float(h["produto_total"]),
                }
                for h in historico
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar dashboard do profissional: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{tenant_slug}/{professional_id}")
def atualizar_profissional(
    tenant_slug: str,
    professional_id: UUID,
    dados: ProfissionalUpdate,
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
            UPDATE "{tenant.schema_name}".users
            SET full_name = :full_name,
                phone = :phone,
                commission_rate = :commission_rate
            WHERE id = :id
            AND role = 'professional'
            RETURNING id, full_name, phone, commission_rate, is_active
        """), {
            "id": str(professional_id),
            "full_name": dados.full_name,
            "phone": dados.phone,
            "commission_rate": dados.commission_rate,
        }).mappings().first()

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profissional não encontrado",
            )

        db.commit()
        return dict(resultado)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar profissional: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{tenant_slug}/{professional_id}")
def desativar_profissional(
    tenant_slug: str,
    professional_id: UUID,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Desativa um profissional do estabelecimento.
    Não deletamos — preservamos o histórico de agendamentos.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        db.execute(text(f"""
            UPDATE "{tenant.schema_name}".users
            SET is_active = false
            WHERE id = :id
            AND role = 'professional'
        """), {"id": str(professional_id)})

        db.commit()
        return {"message": "Profissional desativado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao desativar profissional: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
