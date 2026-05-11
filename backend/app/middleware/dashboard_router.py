# FastAPI para criar rotas e gerenciar dependências
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date
import logging

# Importa a sessão do banco de dados
from app.core.database import get_db

# Importa o serviço de tenant
from app.tenants import service as tenant_service

# Importa a proteção de rotas por role
from app.core.security import requer_role

logger = logging.getLogger(__name__)

# Cria o roteador do dashboard
router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get("/{tenant_slug}")
def buscar_metricas_dashboard(
    tenant_slug: str,
    mes: int = None,
    ano: int = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Retorna todas as métricas do dashboard do admin.

    Métricas retornadas:
    - Faturamento líquido do mês (serviços + produtos − comissões dos profissionais)
    - Faturamento bruto e total de comissões (para breakdown no frontend)
    - Taxa de ocupação (slots ocupados / slots totais)
    - Total de cancelamentos
    - Top profissionais por faturamento (serviços + produtos)
    - Agendamentos de hoje
    - Alertas de estoque baixo
    """
    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    schema = tenant.schema_name

    # Usa mês e ano atual se não informados
    hoje = date.today()
    mes_busca = mes or hoje.month
    ano_busca = ano or hoje.year

    try:
        # Subquery reutilizável: soma de produtos por agendamento
        subq_produtos = f"""
            SELECT ap.appointment_id, SUM(p.price) AS produto_total
            FROM "{schema}".appointment_products ap
            JOIN "{schema}".products p ON p.id = ap.product_id
            GROUP BY ap.appointment_id
        """

        # Faturamento bruto de serviços no mês (apenas concluídos)
        total_servicos = db.execute(text(f"""
            SELECT COALESCE(SUM(s.price), 0) AS total
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            WHERE a.status = 'completed'
            AND EXTRACT(MONTH FROM a.scheduled_date) = :mes
            AND EXTRACT(YEAR FROM a.scheduled_date) = :ano
        """), {"mes": mes_busca, "ano": ano_busca}).mappings().first()

        # Faturamento bruto de produtos no mês (apenas concluídos)
        total_produtos = db.execute(text(f"""
            SELECT COALESCE(SUM(p.price), 0) AS total
            FROM "{schema}".appointment_products ap
            JOIN "{schema}".products p ON p.id = ap.product_id
            JOIN "{schema}".appointments a ON a.id = ap.appointment_id
            WHERE a.status = 'completed'
            AND EXTRACT(MONTH FROM a.scheduled_date) = :mes
            AND EXTRACT(YEAR FROM a.scheduled_date) = :ano
        """), {"mes": mes_busca, "ano": ano_busca}).mappings().first()

        # Total gerado por profissional (serviços + produtos) com sua taxa de comissão
        # Usado para calcular o total de comissões a deduzir do faturamento líquido
        por_profissional_comissao = db.execute(text(f"""
            SELECT
                u.commission_rate,
                COALESCE(SUM(s.price), 0) + COALESCE(SUM(ap_prod.produto_total), 0) AS total_gerado
            FROM "{schema}".appointments a
            JOIN "{schema}".users u ON u.id = a.professional_id
            JOIN "{schema}".services s ON s.id = a.service_id
            LEFT JOIN ({subq_produtos}) ap_prod ON ap_prod.appointment_id = a.id
            WHERE a.status = 'completed'
            AND EXTRACT(MONTH FROM a.scheduled_date) = :mes
            AND EXTRACT(YEAR FROM a.scheduled_date) = :ano
            GROUP BY u.id, u.commission_rate
        """), {"mes": mes_busca, "ano": ano_busca}).mappings().all()

        # Calcula comissões totais em Python (commission_rate é %, ex: 30 = 30%)
        total_comissoes = sum(
            float(p["total_gerado"]) * float(p["commission_rate"]) / 100
            for p in por_profissional_comissao
        )

        faturamento_bruto = float(total_servicos["total"]) + float(total_produtos["total"])
        faturamento_liquido = faturamento_bruto - total_comissoes

        # Total de agendamentos do mês para calcular taxa de ocupação
        total_agendamentos = db.execute(text(f"""
            SELECT COUNT(*) as total
            FROM "{schema}".appointments
            WHERE status NOT IN ('cancelled')
            AND EXTRACT(MONTH FROM scheduled_date) = :mes
            AND EXTRACT(YEAR FROM scheduled_date) = :ano
        """), {"mes": mes_busca, "ano": ano_busca}).mappings().first()

        # Total de cancelamentos do mês
        cancelamentos = db.execute(text(f"""
            SELECT COUNT(*) as total
            FROM "{schema}".appointments
            WHERE status = 'cancelled'
            AND EXTRACT(MONTH FROM scheduled_date) = :mes
            AND EXTRACT(YEAR FROM scheduled_date) = :ano
        """), {"mes": mes_busca, "ano": ano_busca}).mappings().first()

        # Top 5 profissionais por faturamento no mês (serviços + produtos)
        top_profissionais = db.execute(text(f"""
            SELECT
                u.full_name,
                COUNT(DISTINCT a.id) AS total_atendimentos,
                COALESCE(SUM(s.price), 0) + COALESCE(SUM(ap_prod.produto_total), 0) AS faturamento
            FROM "{schema}".appointments a
            JOIN "{schema}".users u ON u.id = a.professional_id
            JOIN "{schema}".services s ON s.id = a.service_id
            LEFT JOIN ({subq_produtos}) ap_prod ON ap_prod.appointment_id = a.id
            WHERE a.status = 'completed'
            AND EXTRACT(MONTH FROM a.scheduled_date) = :mes
            AND EXTRACT(YEAR FROM a.scheduled_date) = :ano
            GROUP BY u.id, u.full_name
            ORDER BY faturamento DESC
            LIMIT 5
        """), {"mes": mes_busca, "ano": ano_busca}).mappings().all()

        # Agendamentos de hoje
        agendamentos_hoje = db.execute(text(f"""
            SELECT COUNT(*) as total
            FROM "{schema}".appointments
            WHERE scheduled_date = :hoje
            AND status NOT IN ('cancelled')
        """), {"hoje": hoje}).mappings().first()

        # Alertas de estoque baixo — produtos com menos de 5 unidades
        estoque_baixo = db.execute(text(f"""
            SELECT name, stock
            FROM "{schema}".products
            WHERE stock <= 5
            AND is_active = true
            ORDER BY stock ASC
        """)).mappings().all()

        # Calcula taxa de ocupação do mês
        total_profissionais = db.execute(text(f"""
            SELECT COUNT(*) as total
            FROM "{schema}".users
            WHERE role = 'professional'
            AND is_active = true
        """)).mappings().first()

        config = db.execute(text(f"""
            SELECT opening_time, closing_time
            FROM "{schema}".establishment_config
            LIMIT 1
        """)).mappings().first()

        if config:
            abertura = int(str(config["opening_time"])[:2])
            fechamento = int(str(config["closing_time"])[:2])
            slots_por_dia = fechamento - abertura
        else:
            slots_por_dia = 12  # padrão 08:00 às 20:00

        import calendar
        dias_no_mes = calendar.monthrange(ano_busca, mes_busca)[1]
        total_slots = dias_no_mes * slots_por_dia * int(total_profissionais["total"])
        taxa_ocupacao = 0

        if total_slots > 0:
            taxa_ocupacao = round(
                (int(total_agendamentos["total"]) / total_slots) * 100, 1
            )

        return {
            "periodo": f"{mes_busca:02d}/{ano_busca}",
            # Faturamento líquido = bruto - comissões dos profissionais
            "faturamento_mes": round(faturamento_liquido, 2),
            "faturamento_bruto": round(faturamento_bruto, 2),
            "total_comissoes": round(total_comissoes, 2),
            "taxa_ocupacao": taxa_ocupacao,
            "cancelamentos": int(cancelamentos["total"]),
            "agendamentos_hoje": int(agendamentos_hoje["total"]),
            "top_profissionais": [dict(p) for p in top_profissionais],
            "alertas_estoque": [dict(e) for e in estoque_baixo],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Erro no dashboard [%s] %s/%s: %s",
            tenant_slug, mes_busca, ano_busca, e,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao carregar dashboard: {str(e)}",
        )
