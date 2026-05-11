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

# Importa a proteção de rotas
from app.core.security import requer_role

logger = logging.getLogger(__name__)

# Cria o roteador de relatórios
router = APIRouter(
    prefix="/reports",
    tags=["Relatórios"],
)


@router.get("/{tenant_slug}/financial")
def relatorio_financeiro(
    tenant_slug: str,
    data_inicio: date,
    data_fim: date,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requer_role(["admin"])),
):
    """
    Relatório financeiro detalhado por período.
    Apenas admin pode acessar.

    Retorna:
    - Resumo geral do período
    - Faturamento por serviço
    - Faturamento por produto
    - Faturamento por profissional com comissão (serviços + produtos)
    - Comparativo dia a dia (serviços + produtos)
    """
    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    schema = tenant.schema_name

    # Subquery reutilizável: soma de produtos por agendamento
    subq_produtos = f"""
        SELECT ap.appointment_id, SUM(p.price) AS produto_total
        FROM "{schema}".appointment_products ap
        JOIN "{schema}".products p ON p.id = ap.product_id
        GROUP BY ap.appointment_id
    """

    try:
        # Resumo geral do período — faturamento de serviços (base para o card principal)
        resumo = db.execute(text(f"""
            SELECT
                COUNT(a.id) as total_agendamentos,
                COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as concluidos,
                COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelados,
                COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price END), 0) as faturamento_servicos
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            WHERE a.scheduled_date BETWEEN :inicio AND :fim
        """), {"inicio": data_inicio, "fim": data_fim}).mappings().first()

        # Faturamento por produto no período
        faturamento_produtos = db.execute(text(f"""
            SELECT
                p.name as produto,
                COUNT(ap.product_id) as quantidade_vendida,
                COALESCE(SUM(p.price), 0) as faturamento
            FROM "{schema}".appointment_products ap
            JOIN "{schema}".products p ON p.id = ap.product_id
            JOIN "{schema}".appointments a ON a.id = ap.appointment_id
            WHERE a.status = 'completed'
            AND a.scheduled_date BETWEEN :inicio AND :fim
            GROUP BY p.id, p.name
            ORDER BY faturamento DESC
        """), {"inicio": data_inicio, "fim": data_fim}).mappings().all()

        total_produtos = sum(float(p["faturamento"]) for p in faturamento_produtos)

        # Faturamento por serviço no período
        faturamento_servicos = db.execute(text(f"""
            SELECT
                s.name as servico,
                COUNT(a.id) as quantidade,
                COALESCE(SUM(s.price), 0) as faturamento
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            WHERE a.status = 'completed'
            AND a.scheduled_date BETWEEN :inicio AND :fim
            GROUP BY s.id, s.name
            ORDER BY faturamento DESC
        """), {"inicio": data_inicio, "fim": data_fim}).mappings().all()

        # Faturamento por profissional com comissão — inclui serviços + produtos
        # commission_rate dividido como numeric para evitar divisão inteira no PostgreSQL
        faturamento_profissionais = db.execute(text(f"""
            SELECT
                u.full_name as profissional,
                u.commission_rate,
                COUNT(DISTINCT a.id) as total_atendimentos,
                COALESCE(SUM(s.price), 0) + COALESCE(SUM(ap_prod.produto_total), 0) AS faturamento_gerado,
                CASE
                    WHEN u.commission_rate > 0
                    THEN (COALESCE(SUM(s.price), 0) + COALESCE(SUM(ap_prod.produto_total), 0))
                         * (u.commission_rate::numeric / 100)
                    ELSE 0
                END as comissao_a_pagar
            FROM "{schema}".appointments a
            JOIN "{schema}".users u ON u.id = a.professional_id
            JOIN "{schema}".services s ON s.id = a.service_id
            LEFT JOIN ({subq_produtos}) ap_prod ON ap_prod.appointment_id = a.id
            WHERE a.status = 'completed'
            AND a.scheduled_date BETWEEN :inicio AND :fim
            GROUP BY u.id, u.full_name, u.commission_rate
            ORDER BY faturamento_gerado DESC
        """), {"inicio": data_inicio, "fim": data_fim}).mappings().all()

        # Faturamento dia a dia — inclui serviços + produtos para consistência com os totais
        faturamento_diario = db.execute(text(f"""
            SELECT
                TO_CHAR(a.scheduled_date, 'YYYY-MM-DD') as data,
                COUNT(DISTINCT a.id) as atendimentos,
                COALESCE(SUM(s.price), 0) + COALESCE(SUM(ap_prod.produto_total), 0) AS faturamento
            FROM "{schema}".appointments a
            JOIN "{schema}".services s ON s.id = a.service_id
            LEFT JOIN ({subq_produtos}) ap_prod ON ap_prod.appointment_id = a.id
            WHERE a.status = 'completed'
            AND a.scheduled_date BETWEEN :inicio AND :fim
            GROUP BY a.scheduled_date
            ORDER BY a.scheduled_date ASC
        """), {"inicio": data_inicio, "fim": data_fim}).mappings().all()

        faturamento_total = float(resumo["faturamento_servicos"]) + total_produtos

        # Ticket médio baseado no total (serviços + produtos) por agendamento concluído
        concluidos = int(resumo["concluidos"])
        ticket_medio = faturamento_total / concluidos if concluidos > 0 else 0

        return {
            "periodo": {
                "inicio": str(data_inicio),
                "fim": str(data_fim),
            },
            "resumo": {
                "total_agendamentos": int(resumo["total_agendamentos"]),
                "concluidos": concluidos,
                "cancelados": int(resumo["cancelados"]),
                "faturamento_servicos": float(resumo["faturamento_servicos"]),
                "faturamento_produtos": total_produtos,
                "faturamento_total": faturamento_total,
                "ticket_medio": round(ticket_medio, 2),
            },
            "por_servico": [
                {"servico": s["servico"], "quantidade": int(s["quantidade"]), "faturamento": float(s["faturamento"])}
                for s in faturamento_servicos
            ],
            "por_produto": [
                {"produto": p["produto"], "quantidade_vendida": int(p["quantidade_vendida"]), "faturamento": float(p["faturamento"])}
                for p in faturamento_produtos
            ],
            "por_profissional": [
                {
                    "profissional": p["profissional"],
                    "commission_rate": float(p["commission_rate"]),
                    "total_atendimentos": int(p["total_atendimentos"]),
                    "faturamento_gerado": float(p["faturamento_gerado"]),
                    "comissao_a_pagar": float(p["comissao_a_pagar"]),
                }
                for p in faturamento_profissionais
            ],
            "diario": [
                {"data": d["data"], "atendimentos": int(d["atendimentos"]), "faturamento": float(d["faturamento"])}
                for d in faturamento_diario
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Erro no relatório financeiro [%s] período %s→%s: %s",
            tenant_slug, data_inicio, data_fim, e,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao gerar relatório: {str(e)}",
        )
