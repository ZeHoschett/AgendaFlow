# Importações do SQLAlchemy para executar queries e DDL (criar schemas)
from sqlalchemy.orm import Session
from sqlalchemy import text
from types import SimpleNamespace
import time

# Model e schema do tenant
from app.tenants.models import Tenant
from app.tenants.schemas import TenantCreate

# Cache em memória para evitar SELECT repetido a cada requisição.
# Chave: slug do tenant | Valor: {"tenant": objeto, "timestamp": float}
_tenant_cache: dict = {}

# Tempo de vida do cache: 5 minutos (300 segundos)
CACHE_TTL_SEGUNDOS = 300


def gerar_schema_name(slug: str) -> str:
    """
    Gera o nome do schema PostgreSQL a partir do slug do tenant.
    Ex: "nano-banana" vira "tenant_nano_banana"

    Usamos prefixo "tenant_" para separar claramente os schemas
    de clientes do schema público da aplicação.
    """
    slug_formatado = slug.replace("-", "_")
    return f"tenant_{slug_formatado}"


def criar_tabelas_tenant(db: Session, schema_name: str) -> None:
    """
    Cria todas as tabelas necessárias dentro do schema do tenant.
    Executado uma única vez no momento do cadastro do estabelecimento.
    Ordem importa — tabelas com FK devem vir depois das que referenciam.
    """

    # Tabela de usuários — admin, profissionais e clientes do tenant
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            commission_rate NUMERIC(5,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT true NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        )
    """))

    # Índices de users — acelera login (busca por email) e listagem por role
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_users_email ON "{schema_name}".users(email)'))
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_users_role ON "{schema_name}".users(role)'))

    # Configurações gerais do estabelecimento
    # Uma única linha por tenant — horários, dias de funcionamento
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".establishment_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            opening_time TIME NOT NULL DEFAULT '08:00',
            closing_time TIME NOT NULL DEFAULT '20:00',
            working_days VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5',
            cancellation_hours INTEGER NOT NULL DEFAULT 24,
            address VARCHAR(500),
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
        )
    """))

    # Serviços oferecidos pelo estabelecimento
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".services (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price NUMERIC(10,2) NOT NULL,
            category VARCHAR(100) NOT NULL DEFAULT 'Geral',
            category_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN DEFAULT true NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        )
    """))

    # Índice de services — acelera listagem de serviços ativos
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_services_active ON "{schema_name}".services(is_active)'))

    # Produtos do estabelecimento — usados no upsell durante agendamento
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price NUMERIC(10,2) NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            category VARCHAR(100) NOT NULL DEFAULT 'Geral',
            category_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN DEFAULT true NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        )
    """))

    # Índices de products — acelera listagem de ativos e alertas de estoque baixo
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_products_active ON "{schema_name}".products(is_active)'))
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_products_stock ON "{schema_name}".products(stock)'))

    # Relacionamento entre serviços e produtos recomendados
    # Ex: "Corte Degradê" recomenda "Pomada Modeladora"
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".service_products (
            service_id UUID NOT NULL REFERENCES "{schema_name}".services(id),
            product_id UUID NOT NULL REFERENCES "{schema_name}".products(id),
            PRIMARY KEY (service_id, product_id)
        )
    """))

    # Agendamentos — coração do sistema
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".appointments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_name VARCHAR(255) NOT NULL,
            client_phone VARCHAR(20) NOT NULL,
            client_id UUID REFERENCES "{schema_name}".users(id),
            professional_id UUID NOT NULL REFERENCES "{schema_name}".users(id),
            service_id UUID NOT NULL REFERENCES "{schema_name}".services(id),
            scheduled_date DATE NOT NULL,
            scheduled_time TIME NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        )
    """))

    # Índices de appointments — acelera Agenda (busca por data/profissional), relatório financeiro e status
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_appointments_date ON "{schema_name}".appointments(scheduled_date)'))
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_appointments_professional ON "{schema_name}".appointments(professional_id)'))
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_appointments_status ON "{schema_name}".appointments(status)'))
    # Índice composto — otimiza a query mais frequente: agenda do dia por profissional
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_appointments_date_prof ON "{schema_name}".appointments(scheduled_date, professional_id)'))

    # Produtos adicionados ao agendamento pelo cliente no upsell
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".appointment_products (
            appointment_id UUID NOT NULL REFERENCES "{schema_name}".appointments(id),
            product_id UUID NOT NULL REFERENCES "{schema_name}".products(id),
            quantity INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (appointment_id, product_id)
        )
    """))

    # Serviços adicionais vinculados ao agendamento (além do service_id principal)
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".appointment_services (
            appointment_id UUID NOT NULL REFERENCES "{schema_name}".appointments(id),
            service_id UUID NOT NULL REFERENCES "{schema_name}".services(id),
            PRIMARY KEY (appointment_id, service_id)
        )
    """))

    # Datas bloqueadas pelo admin — feriados, férias, manutenção
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".blocked_dates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            blocked_date DATE NOT NULL,
            reason VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        )
    """))

    # Índice de blocked_dates — acelera verificação de disponibilidade no agendamento
    db.execute(text(f'CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON "{schema_name}".blocked_dates(blocked_date)'))

    # Tabela de notas do CRM — anotações manuais sobre clientes
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}".client_notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_phone VARCHAR(20) NOT NULL,
            client_name VARCHAR(255) NOT NULL,
            note TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        )
    """))

    db.commit()


def criar_schema_tenant(db: Session, schema_name: str) -> None:
    """
    Cria um schema isolado no PostgreSQL para o tenant.
    Cada tenant tem seu próprio schema — isolamento total de dados.
    """
    db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
    db.commit()


def criar_tenant(db: Session, dados: TenantCreate) -> Tenant:
    """
    Cria um novo tenant na plataforma AgendaFlow.

    Fluxo:
    1. Verifica se slug já existe
    2. Gera o nome do schema PostgreSQL
    3. Salva o tenant na tabela pública
    4. Cria o schema isolado no banco
    5. Cria as tabelas dentro do schema
    6. Retorna o tenant criado
    """

    # Verifica se já existe um tenant com esse slug
    tenant_existente = db.query(Tenant).filter(
        Tenant.slug == dados.slug
    ).first()

    if tenant_existente:
        raise ValueError(f"Slug '{dados.slug}' já está em uso")

    # Gera o nome do schema a partir do slug
    schema_name = gerar_schema_name(dados.slug)

    # Cria o registro do tenant na tabela pública
    novo_tenant = Tenant(
        name=dados.name,
        slug=dados.slug,
        schema_name=schema_name,
        segment=dados.segment,
    )

    db.add(novo_tenant)
    db.commit()
    db.refresh(novo_tenant)

    # Cria o schema isolado no PostgreSQL para esse tenant
    criar_schema_tenant(db, schema_name)

    # Cria todas as tabelas dentro do schema do tenant
    criar_tabelas_tenant(db, schema_name)

    return novo_tenant


def buscar_tenant_por_slug(db: Session, slug: str):
    """
    Busca um tenant pelo slug com cache em memória.
    Evita SELECT repetido ao banco a cada requisição.
    Cache expira após CACHE_TTL_SEGUNDOS (5 minutos).

    O cache armazena apenas dados escalares (dict), nunca o objeto ORM.
    Retornar o objeto ORM diretamente causava "Instance is not bound to a
    Session" porque o SQLAlchemy expira os atributos quando a sessão fecha.
    """
    agora = time.time()

    entrada = _tenant_cache.get(slug)
    if entrada and (agora - entrada["timestamp"]) < CACHE_TTL_SEGUNDOS:
        # Cache hit: reconstrói um namespace leve com os campos necessários
        dados = entrada["data"]
        return SimpleNamespace(**dados) if dados else None

    # Cache expirou ou slug ainda não foi buscado — consulta o banco
    tenant = db.query(Tenant).filter(
        Tenant.slug == slug,
        Tenant.is_active == True
    ).first()

    # Persiste apenas os campos escalares — nunca o objeto ORM vinculado à sessão
    _tenant_cache[slug] = {
        "data": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "schema_name": tenant.schema_name,
            "segment": tenant.segment,
            "is_active": tenant.is_active,
        } if tenant else None,
        "timestamp": agora,
    }

    return tenant


def limpar_cache_tenant(slug: str) -> None:
    """
    Remove o tenant do cache para forçar re-leitura do banco.
    Deve ser chamado quando os dados do tenant forem atualizados.
    """
    _tenant_cache.pop(slug, None) 