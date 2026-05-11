# FastAPI para criar rotas e gerenciar dependências
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

# Importa a sessão do banco de dados
from app.core.database import get_db

# Importa o serviço de tenant
from app.tenants import service as tenant_service

# Importa a dependência de autenticação
from app.core.security import get_usuario_atual


def _verificar_admin_do_tenant(tenant_slug: str, usuario: dict) -> None:
    """Garante que o usuário é admin e pertence ao tenant da URL."""
    if usuario.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    if usuario.get("tenant_slug") != tenant_slug:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para este estabelecimento")

# Cria o roteador da anamnese
router = APIRouter(
    prefix="/anamnese",
    tags=["Anamnese"],
)


class RespostasAnamnese(BaseModel):
    """
    Respostas completas da anamnese do estabelecimento.
    Cada campo corresponde a uma pergunta do formulário de onboarding.
    """

    # Bloco 1 — Identidade do negócio
    segment: str                    # barbearia, salao, clinica_estetica, etc
    professional_count: str         # "1", "2-5", "6-10", "10+"
    scheduling_mode: str            # "agendamento", "ordem_chegada", "ambos"

    # Bloco 2 — Serviços e produtos
    has_products: bool              # Se vende produtos físicos
    has_fixed_duration: bool        # Se serviços têm duração fixa

    # Bloco 3 — Modelo financeiro
    remuneration_model: str         # "fixo", "comissao", "fixo_comissao", "fixo_meta"
    has_commission: bool            # Se tem percentual de comissão
    commission_rate: Optional[float] = 0.0   # Percentual padrão de comissão
    has_goals: bool                 # Se tem metas mensais
    has_tips: bool                  # Se trabalha com gorjeta
    payment_methods: str            # "pix,cartao,estabelecimento" (separados por vírgula)

    # Bloco 4 — Experiência do cliente
    professional_title: str         # "Barbeiro", "Cabeleireiro", "Especialista", etc
    whatsapp_notify: bool           # Se quer notificação no WhatsApp

    # Bloco 5 — Dados do responsável (seu CRM interno)
    responsible_name: str           # Nome do dono
    responsible_whatsapp: str       # WhatsApp do dono
    city: str                       # Cidade do estabelecimento
    how_found: str                  # "indicacao", "instagram", "google", "outro"
    monthly_revenue: str            # Faixa de faturamento

    # Tema visual — opcional, padrão dark (admin controla via painel após onboarding)
    tema: Optional[str] = "dark"    # "dark" ou "light"


@router.post("/{tenant_slug}")
def salvar_anamnese(
    tenant_slug: str,
    respostas: RespostasAnamnese,
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_usuario_atual),
):
    """
    Salva as respostas da anamnese e marca o tenant como configurado.

    Fluxo:
    1. Busca o tenant pelo slug
    2. Salva as respostas na tabela de configuração do tenant
    3. Atualiza o segmento e tema do tenant
    4. Marca anamnese_concluida = true
    5. A partir desse momento o admin tem acesso ao painel completo
    """
    _verificar_admin_do_tenant(tenant_slug, usuario)

    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    schema = tenant.schema_name

    # Salva as configurações no schema do tenant
    # Verifica se já existe configuração
    existente = db.execute(text(f"""
        SELECT id FROM "{schema}".establishment_config LIMIT 1
    """)).first()

    if existente:
        db.execute(text(f"""
            UPDATE "{schema}".establishment_config
            SET opening_time = '08:00',
                closing_time = '20:00',
                working_days = '1,2,3,4,5',
                cancellation_hours = 24,
                updated_at = now()
        """))
    else:
        db.execute(text(f"""
            INSERT INTO "{schema}".establishment_config
                (opening_time, closing_time, working_days, cancellation_hours)
            VALUES ('08:00', '20:00', '1,2,3,4,5', 24)
        """))

    # Salva os dados da anamnese na tabela de configuração do tenant
    # Primeiro verifica se a tabela anamnese existe no schema
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema}".anamnese (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            professional_count VARCHAR(10),
            scheduling_mode VARCHAR(20),
            has_products BOOLEAN DEFAULT false,
            has_fixed_duration BOOLEAN DEFAULT true,
            remuneration_model VARCHAR(20),
            has_commission BOOLEAN DEFAULT false,
            commission_rate NUMERIC(5,2) DEFAULT 0,
            has_goals BOOLEAN DEFAULT false,
            has_tips BOOLEAN DEFAULT false,
            payment_methods VARCHAR(100),
            professional_title VARCHAR(50),
            whatsapp_notify BOOLEAN DEFAULT false,
            responsible_name VARCHAR(255),
            responsible_whatsapp VARCHAR(20),
            city VARCHAR(100),
            how_found VARCHAR(50),
            monthly_revenue VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """))

    # Limpa respostas anteriores e insere as novas
    db.execute(text(f'DELETE FROM "{schema}".anamnese'))

    db.execute(text(f"""
        INSERT INTO "{schema}".anamnese (
            professional_count, scheduling_mode, has_products,
            has_fixed_duration, remuneration_model, has_commission,
            commission_rate, has_goals, has_tips, payment_methods,
            professional_title, whatsapp_notify, responsible_name,
            responsible_whatsapp, city, how_found, monthly_revenue
        ) VALUES (
            :professional_count, :scheduling_mode, :has_products,
            :has_fixed_duration, :remuneration_model, :has_commission,
            :commission_rate, :has_goals, :has_tips, :payment_methods,
            :professional_title, :whatsapp_notify, :responsible_name,
            :responsible_whatsapp, :city, :how_found, :monthly_revenue
        )
    """), {
        "professional_count": respostas.professional_count,
        "scheduling_mode": respostas.scheduling_mode,
        "has_products": respostas.has_products,
        "has_fixed_duration": respostas.has_fixed_duration,
        "remuneration_model": respostas.remuneration_model,
        "has_commission": respostas.has_commission,
        "commission_rate": respostas.commission_rate,
        "has_goals": respostas.has_goals,
        "has_tips": respostas.has_tips,
        "payment_methods": respostas.payment_methods,
        "professional_title": respostas.professional_title,
        "whatsapp_notify": respostas.whatsapp_notify,
        "responsible_name": respostas.responsible_name,
        "responsible_whatsapp": respostas.responsible_whatsapp,
        "city": respostas.city,
        "how_found": respostas.how_found,
        "monthly_revenue": respostas.monthly_revenue,
    })

    # Atualiza o segmento, tema e marca anamnese como concluída no tenant
    db.execute(text("""
        UPDATE public.tenants
        SET segment = :segment,
            tema = :tema,
            anamnese_concluida = true
        WHERE slug = :slug
    """), {
        "segment": respostas.segment,
        "tema": respostas.tema,
        "slug": tenant_slug,
    })

    db.commit()

    return {
        "message": "Anamnese concluída com sucesso",
        "segment": respostas.segment,
        "tema": respostas.tema,
        "professional_title": respostas.professional_title,
    }


@router.get("/{tenant_slug}/status")
def verificar_status_anamnese(
    tenant_slug: str,
    db: Session = Depends(get_db),
):
    """
    Verifica se o tenant já respondeu a anamnese.
    Usado pelo frontend para decidir se redireciona para a anamnese ou para o painel.
    """
    resultado = db.execute(text("""
        SELECT anamnese_concluida, tema, segment
        FROM public.tenants
        WHERE slug = :slug AND is_active = true
    """), {"slug": tenant_slug}).mappings().first()

    if not resultado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estabelecimento não encontrado",
        )

    return {
        "anamnese_concluida": resultado["anamnese_concluida"],
        "tema": resultado["tema"],
        "segment": resultado["segment"],
    }


class TemaUpdate(BaseModel):
    """Body do PATCH /anamnese/{slug}/tema — enviado pelo admin via painel."""
    tema: str  # "dark" ou "light"


@router.patch("/{tenant_slug}/tema")
def atualizar_tema(
    tenant_slug: str,
    body: TemaUpdate,
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_usuario_atual),
):
    """
    Atualiza o tema visual do portal do cliente.
    Chamado pelo admin via painel — cliente vê a mudança na próxima visita.
    """
    _verificar_admin_do_tenant(tenant_slug, usuario)

    if body.tema not in ["dark", "light"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tema inválido. Use 'dark' ou 'light'.",
        )

    db.execute(text("""
        UPDATE public.tenants
        SET tema = :tema
        WHERE slug = :slug
    """), {"tema": body.tema, "slug": tenant_slug})

    db.commit()

    return {"message": f"Tema atualizado para '{body.tema}'"}