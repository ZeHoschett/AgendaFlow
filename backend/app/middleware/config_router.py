# FastAPI para criar rotas e gerenciar dependências
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
import logging

# Importa a sessão do banco de dados
from app.core.database import get_db
from app.core.security import requer_role

# Importa o serviço de tenant
from app.tenants import service as tenant_service

logger = logging.getLogger(__name__)

# Cria o roteador de configurações do estabelecimento
router = APIRouter(
    prefix="/config",
    tags=["Configurações"],
)


class ConfigEstabelecimento(BaseModel):
    """
    Dados de configuração do estabelecimento.
    Definidos pelo admin no painel de configurações.
    """
    opening_time: str        # Ex: "08:00"
    closing_time: str        # Ex: "20:00"
    working_days: str        # Ex: "1,2,3,4,5" (seg a sex)
    cancellation_hours: int  # Horas mínimas para cancelamento pelo cliente
    address: str = ""        # Endereço do estabelecimento


class DataBloqueada(BaseModel):
    """Dados para bloquear uma data específica no estabelecimento."""
    blocked_date: str        # Ex: "2026-12-25"
    reason: Optional[str] = None  # Ex: "Natal"


@router.post("/{tenant_slug}")
def salvar_configuracao(
    tenant_slug: str,
    dados: ConfigEstabelecimento,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Salva ou atualiza as configurações do estabelecimento.
    Usa INSERT ... ON CONFLICT para criar ou atualizar em uma só operação.
    """
    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    try:
        # Verifica se já existe configuração — busca o id para usar no WHERE
        existente = db.execute(text(f"""
            SELECT id FROM "{tenant.schema_name}".establishment_config
            LIMIT 1
        """)).mappings().first()

        if existente:
            # Atualiza configuração existente usando o id encontrado
            db.execute(text(f"""
                UPDATE "{tenant.schema_name}".establishment_config
                SET opening_time = :opening_time,
                    closing_time = :closing_time,
                    working_days = :working_days,
                    cancellation_hours = :cancellation_hours,
                    address = :address,
                    updated_at = now()
                WHERE id = :id
            """), {
                "id": existente["id"],
                "opening_time": dados.opening_time,
                "closing_time": dados.closing_time,
                "working_days": dados.working_days,
                "cancellation_hours": dados.cancellation_hours,
                "address": dados.address,
            })
        else:
            # Cria nova configuração
            db.execute(text(f"""
                INSERT INTO "{tenant.schema_name}".establishment_config
                    (opening_time, closing_time, working_days, cancellation_hours, address)
                VALUES
                    (:opening_time, :closing_time, :working_days, :cancellation_hours, :address)
            """), {
                "opening_time": dados.opening_time,
                "closing_time": dados.closing_time,
                "working_days": dados.working_days,
                "cancellation_hours": dados.cancellation_hours,
                "address": dados.address,
            })

        db.commit()
        return {"message": "Configurações salvas com sucesso"}

    except Exception as e:
        logger.error("Erro ao salvar config [%s]: %s", tenant_slug, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao salvar configurações: {str(e)}",
        )


@router.get("/{tenant_slug}")
def buscar_configuracao(
    tenant_slug: str,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Busca as configurações atuais do estabelecimento.
    Retorna valores padrão se ainda não configurado.
    """
    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    try:
        config = db.execute(text(f"""
            SELECT opening_time, closing_time, working_days, cancellation_hours, address
            FROM "{tenant.schema_name}".establishment_config
            LIMIT 1
        """)).mappings().first()

        if not config:
            return {
                "opening_time": "08:00",
                "closing_time": "20:00",
                "working_days": "1,2,3,4,5",
                "cancellation_hours": 24,
                "address": "",
            }

        return {
            "opening_time": str(config["opening_time"]),
            "closing_time": str(config["closing_time"]),
            "working_days": config["working_days"],
            "cancellation_hours": int(config["cancellation_hours"]),
            "address": config["address"] or "",
        }

    except Exception as e:
        logger.error("Erro ao buscar config [%s]: %s", tenant_slug, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar configurações: {str(e)}",
        )


@router.get("/{tenant_slug}/public")
def buscar_configuracao_publica(
    tenant_slug: str,
    db: Session = Depends(get_db),
):
    """
    Retorna dados públicos do estabelecimento para o portal do cliente.
    Rota sem JWT — acessível por qualquer visitante do portal.
    Combina dados de establishment_config e da tabela anamnese do tenant.
    """
    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    try:
        config = db.execute(text(f"""
            SELECT opening_time, closing_time, working_days, cancellation_hours, address
            FROM "{tenant.schema_name}".establishment_config
            LIMIT 1
        """)).mappings().first()

        anamnese = db.execute(text(f"""
            SELECT responsible_whatsapp
            FROM "{tenant.schema_name}".anamnese
            LIMIT 1
        """)).mappings().first()

        return {
            "opening_time": str(config["opening_time"]) if config and config["opening_time"] else "08:00",
            "closing_time": str(config["closing_time"]) if config and config["closing_time"] else "20:00",
            "working_days": config["working_days"] if config and config["working_days"] else "1,2,3,4,5",
            "cancellation_hours": int(config["cancellation_hours"]) if config and config["cancellation_hours"] else 24,
            "address": config["address"] if config and config["address"] else "",
            "responsible_whatsapp": anamnese["responsible_whatsapp"] if anamnese and anamnese["responsible_whatsapp"] else "",
        }

    except Exception as e:
        logger.error("Erro ao buscar config pública [%s]: %s", tenant_slug, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar dados públicos: {str(e)}",
        )


@router.post("/{tenant_slug}/blocked-dates")
def bloquear_data(
    tenant_slug: str,
    dados: DataBloqueada,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Bloqueia uma data específica no estabelecimento.
    Ex: feriados, férias, manutenção.
    Clientes não conseguem agendar em datas bloqueadas.
    """
    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    try:
        db.execute(text(f"""
            INSERT INTO "{tenant.schema_name}".blocked_dates
                (blocked_date, reason)
            VALUES
                (:blocked_date, :reason)
        """), {
            "blocked_date": dados.blocked_date,
            "reason": dados.reason,
        })

        db.commit()
        return {"message": f"Data {dados.blocked_date} bloqueada com sucesso"}

    except Exception as e:
        logger.error("Erro ao bloquear data [%s] %s: %s", tenant_slug, dados.blocked_date, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao bloquear data: {str(e)}",
        )


@router.get("/{tenant_slug}/blocked-dates")
def listar_datas_bloqueadas(
    tenant_slug: str,
    db: Session = Depends(get_db),
):
    """
    Lista todas as datas bloqueadas do estabelecimento.
    Usado no frontend para desabilitar datas no calendário de agendamento.
    """
    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    try:
        datas = db.execute(text(f"""
            SELECT id, TO_CHAR(blocked_date, 'YYYY-MM-DD') as blocked_date, reason
            FROM "{tenant.schema_name}".blocked_dates
            ORDER BY blocked_date ASC
        """)).mappings().all()

        return [
            {"id": str(d["id"]), "blocked_date": d["blocked_date"], "reason": d["reason"]}
            for d in datas
        ]

    except Exception as e:
        logger.error("Erro ao listar datas bloqueadas [%s]: %s", tenant_slug, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar datas bloqueadas: {str(e)}",
        )
