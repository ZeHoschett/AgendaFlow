# AgendaFlow

SaaS multi-tenant de agendamento online para estabelecimentos de serviços (barbearias, salões, clínicas estéticas e similares).

---

## Visão geral

Cada estabelecimento tem seu próprio portal (`/[slug]`) onde clientes agendam sem criar conta. O admin gerencia profissionais, serviços, produtos e visualiza relatórios financeiros e de CRM. Profissionais acessam a agenda e dashboard de desempenho.

**Status atual:** Backend + Frontend completos com hardening de segurança aplicado. Aguardando domínio, VPS e fase de deploy.

---

## Stack

| Camada | Tecnologias |
|---|---|
| Backend | Python 3.12, FastAPI, PostgreSQL 16, SQLAlchemy, python-jose, passlib, slowapi, python-json-logger |
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Zustand, Axios, Lucide React |
| Infra (planejado) | Docker, Nginx, Let's Encrypt, Redis |

---

## Estrutura do projeto

```
agendaflow/
├── backend/          # API FastAPI
│   ├── app/
│   │   ├── auth/         # Login, logout, JWT
│   │   ├── tenants/      # Provisionamento, anamnese, tema
│   │   ├── appointments/ # Agendamentos, slots, agenda
│   │   ├── professionals/
│   │   ├── services/
│   │   ├── products/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   ├── crm/
│   │   └── core/         # DB, security, logging, config
│   ├── .env              # Variáveis de ambiente (não commitado)
│   └── requirements.txt
└── frontend/         # Next.js App Router
    ├── app/
    │   ├── [slug]/       # Portal do cliente + painel admin/profissional
    │   └── login/
    ├── lib/api.ts        # Axios com withCredentials: true
    └── store/            # Zustand (useAuthStore)
```

---

## Rodando localmente

### Pré-requisitos

- Python 3.12+
- Node.js 18+
- PostgreSQL 16 rodando localmente

### Backend

```bash
cd agendaflow/backend

# Ativar virtualenv (Windows)
..\venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Criar arquivo .env (ver seção abaixo)

# Rodar servidor
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd agendaflow/frontend

npm install
npm run dev
```

Frontend disponível em `http://localhost:3000`.  
Backend disponível em `http://127.0.0.1:8000`.  
Docs da API (dev only): `http://127.0.0.1:8000/docs`.

### Variáveis de ambiente (backend/.env)

```env
DATABASE_URL=postgresql://postgres:suasenha@localhost:5432/agendaflow
SECRET_KEY=chave-secreta-longa-e-aleatoria
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000
PROVISIONING_KEY=chave-de-provisionamento
```

---

## Dados de teste

| Campo | Valor |
|---|---|
| Tenant | `nano-banana` |
| Portal | `http://localhost:3000/nano-banana` |
| Admin | joao@nanobanana.com / senha123 |
| Profissional | maria@nanobanana.com / senha123 |

---

## Autenticação

- JWT armazenado em cookie HttpOnly `agendaflow_session` (nunca exposto ao JavaScript)
- `withCredentials: true` em todos os requests Axios
- Logout revoga o token via blacklist PostgreSQL (`public.token_blacklist`)
- Roles: `admin`, `professional`
- Rotas públicas: portal do cliente, fluxo de agendamento, lista de serviços/profissionais/produtos

---

## Segurança implementada

| Item | Status |
|---|---|
| JWT em cookie HttpOnly (proteção XSS) | ✅ |
| Rate limiting no login (5/min por IP) | ✅ |
| Revogação de token (blacklist PostgreSQL) | ✅ |
| CORS com origens explícitas | ✅ |
| Headers HTTP de segurança (X-Frame-Options, CSP, HSTS, etc.) | ✅ |
| Todas as rotas CRUD protegidas com `requer_role` | ✅ |
| Bcrypt rounds=12 | ✅ |
| Logging JSON estruturado com correlation ID | ✅ |
| Scheduler com `pg_advisory_lock` (multi-worker safe) | ✅ |
| `/docs` desabilitado em produção | ✅ |
| SQL Injection: schema isolado por tenant via slug validado | ✅ |

**Pendente para produção:** refresh tokens, HTTPS/SSL, validação de tenant no token, Redis.

---

## Roadmap

### Fase 1 — Concluída
Backend + Frontend completos com isolamento multi-tenant e hardening de segurança.

### Fase 2 — Deploy (aguardando VPS + domínio)
Docker + docker-compose, Nginx, SSL via Let's Encrypt, Alembic migrations, variáveis de produção, refresh tokens.

### Fase 3 — Notificações
Emails via **Resend**, WhatsApp via **Evolution API**, fila assíncrona com Celery + Redis.

### Fase 4 — Operacional
Redis para cache e blacklist, Sentry para erros, audit log, monitoramento de uptime.

### Fase 5 — Monetização
Planos por tenant (Free/Pro/Business), Stripe ou Mercado Pago, painel SaaS com MRR e churn.
