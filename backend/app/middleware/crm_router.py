# Router do CRM — Central de Relacionamento com Clientes
# Todos os dados são calculados em tempo real a partir da tabela appointments
# Isolamento garantido por schema por tenant — nenhum dado vaza entre estabelecimentos
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from app.core.database import get_db
from app.core.security import requer_role
from app.tenants import service as tenant_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/crm",
    tags=["CRM"],
)


# ─────────────────────────────────────────────
# LÓGICA DE CLASSIFICAÇÃO DE CLIENTES
# Frequente: 4+ agendamentos nos últimos 90 dias
# Regular:   2-3 agendamentos nos últimos 90 dias
# Em Risco:  tem histórico mas não agenda há 45+ dias
# ─────────────────────────────────────────────
def calcular_grupo(total_90_dias: int, dias_desde_ultimo: int, tem_historico: bool) -> str:
    if dias_desde_ultimo >= 45 and tem_historico:
        return "Em Risco"
    if total_90_dias >= 4:
        return "Frequente"
    if total_90_dias >= 2:
        return "Regular"
    return "Em Risco"


class NotaCreate(BaseModel):
    client_phone: str
    client_name: str
    note: str


@router.get("/{tenant_slug}/dashboard")
def dashboard_crm(
    tenant_slug: str,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """Métricas de retenção calculadas em tempo real."""
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)
        if not tenant:
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        schema = tenant.schema_name
        hoje = date.today()
        inicio_mes = hoje.replace(day=1)
        inicio_mes_anterior = (inicio_mes - timedelta(days=1)).replace(day=1)
        noventa_dias_atras = hoje - timedelta(days=90)

        total_unicos = db.execute(text(f"""
            SELECT COUNT(DISTINCT client_phone) AS total
            FROM "{schema}".appointments
            WHERE status != 'cancelled'
        """)).mappings().first()

        novos_mes = db.execute(text(f"""
            SELECT COUNT(DISTINCT client_phone) AS total
            FROM "{schema}".appointments
            WHERE status != 'cancelled'
              AND scheduled_date >= :inicio_mes
              AND client_phone NOT IN (
                  SELECT DISTINCT client_phone
                  FROM "{schema}".appointments
                  WHERE scheduled_date < :inicio_mes
                    AND status != 'cancelled'
              )
        """), {"inicio_mes": inicio_mes}).mappings().first()

        voltaram_mes = db.execute(text(f"""
            SELECT COUNT(DISTINCT a1.client_phone) AS total
            FROM "{schema}".appointments a1
            WHERE a1.status != 'cancelled'
              AND a1.scheduled_date >= :inicio_mes
              AND a1.client_phone IN (
                  SELECT DISTINCT client_phone
                  FROM "{schema}".appointments
                  WHERE scheduled_date >= :inicio_mes_anterior
                    AND scheduled_date < :inicio_mes
                    AND status != 'cancelled'
              )
        """), {"inicio_mes": inicio_mes, "inicio_mes_anterior": inicio_mes_anterior}).mappings().first()

        total_mes_anterior = db.execute(text(f"""
            SELECT COUNT(DISTINCT client_phone) AS total
            FROM "{schema}".appointments
            WHERE status != 'cancelled'
              AND scheduled_date >= :inicio_mes_anterior
              AND scheduled_date < :inicio_mes
        """), {"inicio_mes": inicio_mes, "inicio_mes_anterior": inicio_mes_anterior}).mappings().first()

        taxa_retorno = 0.0
        if total_mes_anterior["total"] > 0:
            taxa_retorno = round((voltaram_mes["total"] / total_mes_anterior["total"]) * 100, 1)

        frequentes = db.execute(text(f"""
            SELECT COUNT(*) AS total FROM (
                SELECT client_phone
                FROM "{schema}".appointments
                WHERE status != 'cancelled'
                  AND scheduled_date >= :noventa_dias_atras
                GROUP BY client_phone
                HAVING COUNT(*) >= 4
            ) sub
        """), {"noventa_dias_atras": noventa_dias_atras}).mappings().first()

        regulares = db.execute(text(f"""
            SELECT COUNT(*) AS total FROM (
                SELECT client_phone
                FROM "{schema}".appointments
                WHERE status != 'cancelled'
                  AND scheduled_date >= :noventa_dias_atras
                GROUP BY client_phone
                HAVING COUNT(*) BETWEEN 2 AND 3
            ) sub
        """), {"noventa_dias_atras": noventa_dias_atras}).mappings().first()

        # Em Risco replica calcular_grupo: 45+ dias sem aparecer OU menos de 2 agendamentos nos últimos 90 dias
        em_risco = db.execute(text(f"""
            SELECT COUNT(*) AS total FROM (
                SELECT
                    client_phone,
                    COUNT(CASE WHEN scheduled_date >= :noventa_dias_atras THEN 1 END) AS agendamentos_90_dias,
                    (CURRENT_DATE - MAX(scheduled_date)::date)                        AS dias_desde_ultimo
                FROM "{schema}".appointments
                WHERE status != 'cancelled'
                GROUP BY client_phone
            ) sub
            WHERE dias_desde_ultimo >= 45 OR agendamentos_90_dias < 2
        """), {"noventa_dias_atras": noventa_dias_atras}).mappings().first()

        return {
            "total_clientes_unicos": int(total_unicos["total"]),
            "novos_este_mes": int(novos_mes["total"]),
            "voltaram_este_mes": int(voltaram_mes["total"]),
            "taxa_retorno_percentual": taxa_retorno,
            "frequentes": int(frequentes["total"]),
            "regulares": int(regulares["total"]),
            "em_risco": int(em_risco["total"]),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro no dashboard CRM: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Erro ao calcular métricas do CRM")


@router.get("/{tenant_slug}/clientes")
def listar_clientes_crm(
    tenant_slug: str,
    grupo: Optional[str] = None,
    profissional_id: Optional[str] = None,
    sem_preferencia_profissional: Optional[bool] = False,
    servico: Optional[str] = None,
    dias_sem_aparecer: Optional[int] = None,
    ticket_minimo: Optional[float] = None,
    ticket_maximo: Optional[float] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Lista clientes únicos com métricas.
    Serviço e profissional favoritos são calculados via subquery
    para evitar N+1 queries por cliente.
    """
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)
        if not tenant:
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        schema = tenant.schema_name
        hoje = date.today()
        noventa_dias_atras = hoje - timedelta(days=90)
        quarenta_cinco_dias_atras = hoje - timedelta(days=45)

        # Uma única query com CTE resolve serviço/profissional favoritos sem N+1
        clientes_raw = db.execute(text(f"""
            WITH base AS (
                SELECT
                    a.client_phone,
                    MAX(a.client_name)                                                    AS client_name,
                    COUNT(a.id)                                                           AS total_agendamentos,
                    COUNT(CASE WHEN a.scheduled_date >= :noventa_dias_atras THEN 1 END)   AS agendamentos_90_dias,
                    MAX(a.scheduled_date)                                                 AS ultimo_agendamento,
                    MIN(a.scheduled_date)                                                 AS primeiro_agendamento,
                    ROUND(AVG(s.price)::numeric, 2)                                       AS ticket_medio,
                    COUNT(DISTINCT a.professional_id)                                     AS total_profissionais_distintos
                FROM "{schema}".appointments a
                JOIN "{schema}".services s ON s.id = a.service_id
                WHERE a.status != 'cancelled'
                GROUP BY a.client_phone
            ),
            servico_fav AS (
                SELECT DISTINCT ON (a.client_phone)
                    a.client_phone,
                    s.name AS servico_favorito
                FROM "{schema}".appointments a
                JOIN "{schema}".services s ON s.id = a.service_id
                WHERE a.status != 'cancelled'
                ORDER BY a.client_phone, COUNT(*) OVER (PARTITION BY a.client_phone, s.name) DESC
            ),
            prof_fav AS (
                SELECT DISTINCT ON (a.client_phone)
                    a.client_phone,
                    u.full_name AS profissional_favorito,
                    u.id        AS profissional_favorito_id
                FROM "{schema}".appointments a
                JOIN "{schema}".users u ON u.id = a.professional_id
                WHERE a.status != 'cancelled'
                ORDER BY a.client_phone, COUNT(*) OVER (PARTITION BY a.client_phone, u.id) DESC
            )
            SELECT
                b.*,
                sf.servico_favorito,
                pf.profissional_favorito,
                pf.profissional_favorito_id::text
            FROM base b
            LEFT JOIN servico_fav sf ON sf.client_phone = b.client_phone
            LEFT JOIN prof_fav   pf ON pf.client_phone = b.client_phone
            ORDER BY b.ultimo_agendamento DESC
        """), {"noventa_dias_atras": noventa_dias_atras}).mappings().all()

        clientes = []
        for c in clientes_raw:
            dias_desde_ultimo = (hoje - c["ultimo_agendamento"]).days
            grupo_calculado = calcular_grupo(
                int(c["agendamentos_90_dias"]),
                dias_desde_ultimo,
                int(c["total_agendamentos"]) > 0,
            )

            cliente = {
                "client_phone": c["client_phone"],
                "client_name": c["client_name"],
                "total_agendamentos": int(c["total_agendamentos"]),
                "agendamentos_90_dias": int(c["agendamentos_90_dias"]),
                "ultimo_agendamento": str(c["ultimo_agendamento"]),
                "primeiro_agendamento": str(c["primeiro_agendamento"]),
                "dias_desde_ultimo": dias_desde_ultimo,
                "ticket_medio": float(c["ticket_medio"]) if c["ticket_medio"] else 0.0,
                "grupo": grupo_calculado,
                "servico_favorito": c["servico_favorito"],
                "profissional_favorito": c["profissional_favorito"],
                "profissional_favorito_id": c["profissional_favorito_id"],
                "total_profissionais_distintos": int(c["total_profissionais_distintos"]),
            }

            if grupo and cliente["grupo"] != grupo:
                continue
            if profissional_id:
                if cliente["profissional_favorito_id"] != profissional_id:
                    continue
                if cliente["total_profissionais_distintos"] > 1:
                    continue
            if sem_preferencia_profissional and cliente["total_profissionais_distintos"] < 2:
                continue
            if servico and cliente["servico_favorito"] != servico:
                continue
            if dias_sem_aparecer and cliente["dias_desde_ultimo"] < dias_sem_aparecer:
                continue
            if ticket_minimo and cliente["ticket_medio"] < ticket_minimo:
                continue
            if ticket_maximo and cliente["ticket_medio"] > ticket_maximo:
                continue

            clientes.append(cliente)

        return clientes
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro ao listar clientes CRM: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Erro ao listar clientes do CRM")


@router.get("/{tenant_slug}/clientes/{phone}")
def perfil_cliente_crm(
    tenant_slug: str,
    phone: str,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """Perfil detalhado do cliente — histórico, métricas e notas."""
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)
        if not tenant:
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        schema = tenant.schema_name
        hoje = date.today()
        noventa_dias_atras = hoje - timedelta(days=90)

        metricas = db.execute(text(f"""
            SELECT
                MAX(a.client_name)                                                        AS client_name,
                COUNT(a.id)                                                               AS total_agendamentos,
                COUNT(CASE WHEN a.scheduled_date >= :noventa_dias_atras THEN 1 END)       AS agendamentos_90_dias,
                MAX(a.scheduled_date)                                                     AS ultimo_agendamento,
                MIN(a.scheduled_date)                                                     AS primeiro_agendamento,
                ROUND(AVG(s.price)::numeric, 2)                                           AS ticket_medio,
                ROUND(SUM(s.price)::numeric, 2)                                           AS total_gasto
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            WHERE a.client_phone = :phone
              AND a.status != 'cancelled'
        """), {"phone": phone, "noventa_dias_atras": noventa_dias_atras}).mappings().first()

        if not metricas or not metricas["client_name"]:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")

        historico = db.execute(text(f"""
            SELECT
                a.id::text,
                TO_CHAR(a.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
                TO_CHAR(a.scheduled_time, 'HH24:MI')    AS scheduled_time,
                a.status,
                s.name   AS servico,
                s.price  AS valor,
                u.full_name AS profissional
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            JOIN "{schema}".users   u ON u.id = a.professional_id
            WHERE a.client_phone = :phone
              AND a.status != 'cancelled'
            ORDER BY a.scheduled_date DESC, a.scheduled_time DESC
        """), {"phone": phone}).mappings().all()

        servicos_frequentes = db.execute(text(f"""
            SELECT s.name, COUNT(*) AS total
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            WHERE a.client_phone = :phone AND a.status != 'cancelled'
            GROUP BY s.name
            ORDER BY total DESC
            LIMIT 3
        """), {"phone": phone}).mappings().all()

        profissionais_frequentes = db.execute(text(f"""
            SELECT u.full_name, COUNT(*) AS total
            FROM "{schema}".appointments a
            JOIN "{schema}".users u ON u.id = a.professional_id
            WHERE a.client_phone = :phone AND a.status != 'cancelled'
            GROUP BY u.full_name
            ORDER BY total DESC
            LIMIT 3
        """), {"phone": phone}).mappings().all()

        # Notas: retorna lista vazia se a tabela ainda não existir
        notas = []
        try:
            notas_raw = db.execute(text(f"""
                SELECT id::text, note, TO_CHAR(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS created_at
                FROM "{schema}".client_notes
                WHERE client_phone = :phone
                ORDER BY created_at DESC
            """), {"phone": phone}).mappings().all()
            notas = [dict(n) for n in notas_raw]
        except Exception:
            db.rollback()

        dias_desde_ultimo = (hoje - metricas["ultimo_agendamento"]).days

        return {
            "client_phone": phone,
            "client_name": metricas["client_name"],
            "total_agendamentos": int(metricas["total_agendamentos"]),
            "agendamentos_90_dias": int(metricas["agendamentos_90_dias"]),
            "ultimo_agendamento": str(metricas["ultimo_agendamento"]),
            "primeiro_agendamento": str(metricas["primeiro_agendamento"]),
            "dias_desde_ultimo": dias_desde_ultimo,
            "ticket_medio": float(metricas["ticket_medio"]) if metricas["ticket_medio"] else 0.0,
            "total_gasto": float(metricas["total_gasto"]) if metricas["total_gasto"] else 0.0,
            "grupo": calcular_grupo(int(metricas["agendamentos_90_dias"]), dias_desde_ultimo, True),
            "servicos_frequentes": [dict(s) for s in servicos_frequentes],
            "profissionais_frequentes": [dict(p) for p in profissionais_frequentes],
            "historico": [dict(h) for h in historico],
            "notas": notas,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro no perfil CRM (%s): %s", phone, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Erro ao buscar perfil do cliente")


@router.post("/{tenant_slug}/notas", status_code=201)
def adicionar_nota_cliente(
    tenant_slug: str,
    dados: NotaCreate,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """Adiciona nota manual sobre um cliente."""
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)
        if not tenant:
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        schema = tenant.schema_name

        # Garante que a tabela existe — necessário para tenants criados antes dessa feature
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{schema}".client_notes (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_phone VARCHAR(20)  NOT NULL,
                client_name  VARCHAR(255) NOT NULL,
                note         TEXT         NOT NULL,
                created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
            )
        """))

        nota = db.execute(text(f"""
            INSERT INTO "{schema}".client_notes (client_phone, client_name, note)
            VALUES (:phone, :name, :note)
            RETURNING id::text, client_phone, client_name, note,
                      TO_CHAR(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS created_at
        """), {"phone": dados.client_phone, "name": dados.client_name, "note": dados.note}).mappings().first()

        db.commit()
        return dict(nota)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro ao salvar nota CRM: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Erro ao salvar nota")


@router.get("/{tenant_slug}/exportar")
def exportar_clientes_crm(
    tenant_slug: str,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """Retorna dados para geração de PDF no frontend."""
    try:
        tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)
        if not tenant:
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        schema = tenant.schema_name
        hoje = date.today()
        noventa_dias_atras = hoje - timedelta(days=90)

        # Mesma CTE da listagem — sem N+1
        clientes_raw = db.execute(text(f"""
            WITH base AS (
                SELECT
                    a.client_phone,
                    MAX(a.client_name)                                                  AS client_name,
                    COUNT(a.id)                                                         AS total_agendamentos,
                    COUNT(CASE WHEN a.scheduled_date >= :noventa_dias_atras THEN 1 END) AS agendamentos_90_dias,
                    MAX(a.scheduled_date)                                               AS ultimo_agendamento,
                    ROUND(AVG(s.price)::numeric, 2)                                     AS ticket_medio
                FROM "{schema}".appointments a
                JOIN "{schema}".services s ON s.id = a.service_id
                WHERE a.status != 'cancelled'
                GROUP BY a.client_phone
            ),
            servico_fav AS (
                SELECT DISTINCT ON (a.client_phone)
                    a.client_phone,
                    s.name AS servico_favorito
                FROM "{schema}".appointments a
                JOIN "{schema}".services s ON s.id = a.service_id
                WHERE a.status != 'cancelled'
                ORDER BY a.client_phone, COUNT(*) OVER (PARTITION BY a.client_phone, s.name) DESC
            )
            SELECT b.*, sf.servico_favorito
            FROM base b
            LEFT JOIN servico_fav sf ON sf.client_phone = b.client_phone
            ORDER BY b.ultimo_agendamento DESC
        """), {"noventa_dias_atras": noventa_dias_atras}).mappings().all()

        clientes_exportacao = []
        for c in clientes_raw:
            dias_desde_ultimo = (hoje - c["ultimo_agendamento"]).days
            clientes_exportacao.append({
                "nome": c["client_name"],
                "telefone": c["client_phone"],
                "grupo": calcular_grupo(int(c["agendamentos_90_dias"]), dias_desde_ultimo, True),
                "total_agendamentos": int(c["total_agendamentos"]),
                "ultimo_agendamento": str(c["ultimo_agendamento"]),
                "servico_favorito": c["servico_favorito"] or "-",
                "ticket_medio": float(c["ticket_medio"]) if c["ticket_medio"] else 0.0,
            })

        return {
            "estabelecimento": tenant.name,
            "data_exportacao": str(hoje),
            "clientes": clientes_exportacao,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro na exportação CRM: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Erro ao exportar dados do CRM")
