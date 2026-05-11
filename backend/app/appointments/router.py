import logging

# FastAPI para criar rotas e gerenciar dependências
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, datetime, timezone, timedelta
from uuid import UUID

# Importa a sessão do banco de dados
from app.core.database import get_db
from app.core.security import requer_role

# Importa schemas e serviços de agendamento
from app.appointments.schemas import AppointmentCreate
from app.appointments import service as appointment_service

# Importa o serviço de tenant
from app.tenants import service as tenant_service

logger = logging.getLogger(__name__)

# Cria o roteador do módulo de agendamentos
router = APIRouter(
    prefix="/appointments",
    tags=["Agendamentos"],
)


@router.get("/slots/{tenant_slug}/{professional_id}/{data}")
def buscar_horarios_disponiveis(
    tenant_slug: str,
    professional_id: UUID,
    data: date,
    db: Session = Depends(get_db),
):
    """
    Retorna os horários disponíveis para um profissional em uma data.
    Organizado por período: manhã, tarde e noite.
    Para slots ocupados, retorna profissionais alternativos disponíveis.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        slots = appointment_service.buscar_horarios_disponiveis(
            db,
            tenant.schema_name,
            str(professional_id),
            data,
        )

        # Organiza os slots por período para facilitar a exibição no frontend
        resultado = {
            "manha": [s for s in slots if s["period"] == "manha"],
            "tarde": [s for s in slots if s["period"] == "tarde"],
            "noite": [s for s in slots if s["period"] == "noite"],
        }

        return resultado
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar horários disponíveis: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{tenant_slug}", status_code=status.HTTP_201_CREATED)
def criar_agendamento(
    tenant_slug: str,
    dados: AppointmentCreate,
    db: Session = Depends(get_db),
):
    """
    Cria um novo agendamento para um cliente.
    Valida disponibilidade do horário antes de confirmar.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        agendamento = appointment_service.criar_agendamento(
            db,
            tenant.schema_name,
            dados.model_dump(),
        )
        return agendamento
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Erro ao criar agendamento: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/agenda/{tenant_slug}/{professional_id}/{data}")
def buscar_agenda_profissional(
    tenant_slug: str,
    professional_id: UUID,
    data: date,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin", "professional"])),
):
    """
    Retorna a agenda do dia de um profissional.
    Usado no portal do profissional para visualizar seus atendimentos.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        agenda = appointment_service.buscar_agenda_profissional(
            db,
            tenant.schema_name,
            str(professional_id),
            data,
        )

        return {"data": str(data), "agendamentos": agenda}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar agenda do profissional: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch("/{tenant_slug}/{appointment_id}/cancelar")
def cancelar_agendamento_cliente(
    tenant_slug: str,
    appointment_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Cancela um agendamento pelo cliente.
    Regra: só permite cancelar com pelo menos 24 horas de antecedência.
    Após esse prazo apenas o admin pode cancelar.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        # Busca o agendamento pelo ID
        agendamento = db.execute(text(f"""
            SELECT id, scheduled_date, scheduled_time, status
            FROM "{tenant.schema_name}".appointments
            WHERE id = :id
        """), {"id": str(appointment_id)}).mappings().first()

        if not agendamento:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agendamento não encontrado",
            )

        # Verifica se já está cancelado
        if agendamento["status"] == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Agendamento já está cancelado",
            )

        # Combina data e hora do agendamento para calcular antecedência
        data_hora_agendamento = datetime.combine(
            agendamento["scheduled_date"],
            agendamento["scheduled_time"],
        ).replace(tzinfo=timezone.utc)

        agora = datetime.now(timezone.utc)
        horas_restantes = (data_hora_agendamento - agora).total_seconds() / 3600

        # Valida a regra de 24 horas de antecedência
        if horas_restantes < 24:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancelamento só é permitido com pelo menos 24 horas de antecedência",
            )

        # Cancela o agendamento
        db.execute(text(f"""
            UPDATE "{tenant.schema_name}".appointments
            SET status = 'cancelled'
            WHERE id = :id
        """), {"id": str(appointment_id)})

        db.commit()
        return {"message": "Agendamento cancelado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao cancelar agendamento (cliente): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/admin/{tenant_slug}")
def listar_agendamentos_admin(
    tenant_slug: str,
    data: date = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Lista todos os agendamentos do estabelecimento.
    Usado no painel do admin para visão geral da agenda.
    Filtra por data se informada, senão retorna os do dia atual.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        # Se não informar data, usa o dia atual
        data_busca = data or date.today()

        agendamentos = db.execute(text(f"""
            SELECT
                a.id,
                a.client_name,
                a.client_phone,
                a.scheduled_date,
                a.scheduled_time,
                a.status,
                a.notes,
                s.name as service_name,
                s.price as service_price,
                u.full_name as professional_name,
                COALESCE(ap_prod.produtos_total, 0) AS products_total,
                s.price + COALESCE(ap_prod.produtos_total, 0) AS total_price
            FROM "{tenant.schema_name}".appointments a
            JOIN "{tenant.schema_name}".services s ON s.id = a.service_id
            JOIN "{tenant.schema_name}".users u ON u.id = a.professional_id
            LEFT JOIN (
                SELECT ap.appointment_id, SUM(p.price) AS produtos_total
                FROM "{tenant.schema_name}".appointment_products ap
                JOIN "{tenant.schema_name}".products p ON p.id = ap.product_id
                GROUP BY ap.appointment_id
            ) ap_prod ON ap_prod.appointment_id = a.id
            WHERE a.scheduled_date = :data
            ORDER BY a.scheduled_time ASC
        """), {"data": data_busca}).mappings().all()

        return {
            "data": str(data_busca),
            "total": len(agendamentos),
            "agendamentos": [dict(a) for a in agendamentos],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar agendamentos (admin): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch("/{tenant_slug}/{appointment_id}/confirmar")
def confirmar_agendamento(
    tenant_slug: str,
    appointment_id: UUID,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin", "professional"])),
):
    """
    Confirma um agendamento pendente.
    Usado pelo admin quando o cliente chega ou para confirmar via telefone.
    Transição permitida: pending → confirmed.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        agendamento = db.execute(text(f"""
            SELECT id, status FROM "{tenant.schema_name}".appointments
            WHERE id = :id
        """), {"id": str(appointment_id)}).mappings().first()

        if not agendamento:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agendamento não encontrado",
            )

        if agendamento["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Agendamento não pode ser confirmado — status atual: {agendamento['status']}",
            )

        db.execute(text(f"""
            UPDATE "{tenant.schema_name}".appointments
            SET status = 'confirmed'
            WHERE id = :id
        """), {"id": str(appointment_id)})

        db.commit()
        return {"message": "Agendamento confirmado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao confirmar agendamento: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch("/{tenant_slug}/{appointment_id}/concluir")
def concluir_agendamento(
    tenant_slug: str,
    appointment_id: UUID,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin", "professional"])),
):
    """
    Conclui um agendamento confirmado.
    Usado pelo admin após o atendimento ser realizado.
    Transição permitida: confirmed → completed.
    O agendamento entra no cálculo de faturamento e comissão a partir daqui.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        agendamento = db.execute(text(f"""
            SELECT id, status FROM "{tenant.schema_name}".appointments
            WHERE id = :id
        """), {"id": str(appointment_id)}).mappings().first()

        if not agendamento:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agendamento não encontrado",
            )

        # Aceita confirmed ou in_progress (legado) para concluir
        if agendamento["status"] not in ("confirmed", "in_progress"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Agendamento não pode ser concluído — status atual: {agendamento['status']}",
            )

        db.execute(text(f"""
            UPDATE "{tenant.schema_name}".appointments
            SET status = 'completed'
            WHERE id = :id
        """), {"id": str(appointment_id)})

        # Debita 1 unidade do estoque para cada produto vinculado ao agendamento.
        # AND stock > 0 impede estoque negativo caso o produto já esteja zerado.
        db.execute(text(f"""
            UPDATE "{tenant.schema_name}".products
            SET stock = stock - 1
            WHERE id IN (
                SELECT product_id
                FROM "{tenant.schema_name}".appointment_products
                WHERE appointment_id = :id
            )
            AND stock > 0
        """), {"id": str(appointment_id)})

        db.commit()
        return {"message": "Agendamento concluído com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao concluir agendamento: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch("/{tenant_slug}/{appointment_id}/cancelar-admin")
def cancelar_agendamento_admin(
    tenant_slug: str,
    appointment_id: UUID,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Cancela um agendamento pelo admin.
    Admin pode cancelar a qualquer momento sem restrição de horário.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estabelecimento '{tenant_slug}' não encontrado",
            )

        agendamento = db.execute(text(f"""
            SELECT id, status FROM "{tenant.schema_name}".appointments
            WHERE id = :id
        """), {"id": str(appointment_id)}).mappings().first()

        if not agendamento:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agendamento não encontrado",
            )

        if agendamento["status"] == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Agendamento já está cancelado",
            )

        db.execute(text(f"""
            UPDATE "{tenant.schema_name}".appointments
            SET status = 'cancelled'
            WHERE id = :id
        """), {"id": str(appointment_id)})

        db.commit()
        return {"message": "Agendamento cancelado pelo admin com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao cancelar agendamento (admin): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
