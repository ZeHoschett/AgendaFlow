# FastAPI é o framework principal da aplicação
import logging
import time
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.limiter import limiter
from app.core.logging_config import configurar_logging, request_id_var

# Importa as configurações centrais
from app.core.config import settings
from app.core.database import SessionLocal
from sqlalchemy import text

# Configura logging JSON estruturado antes de qualquer import que logue
configurar_logging()
logger = logging.getLogger(__name__)

# Importa o scheduler de atualização automática de status
from app.scheduler import iniciar_scheduler

# Importa os routers de cada módulo
from app.tenants.router import router as tenants_router
from app.tenants.anamnese_router import router as anamnese_router
from app.tenants.provisioning_router import router as provisioning_router
from app.auth.router import router as auth_router
from app.appointments.router import router as appointments_router
from app.services.router import router as services_router
from app.products.router import router as products_router
from app.professionals.router import router as professionals_router
from app.middleware.config_router import router as config_router
from app.middleware.dashboard_router import router as dashboard_router
from app.middleware.reports_router import router as reports_router
from app.middleware.crm_router import router as crm_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida da aplicação.
    O scheduler inicia quando a aplicação sobe e para quando ela encerra.
    """
    # Garante que a tabela de blacklist existe e descarta tokens já expirados
    db = SessionLocal()
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS public.token_blacklist (
                jti UUID PRIMARY KEY,
                expires_at TIMESTAMPTZ NOT NULL
            )
        """))
        db.execute(text("DELETE FROM public.token_blacklist WHERE expires_at <= now()"))
        db.commit()
    finally:
        db.close()

    scheduler = iniciar_scheduler()
    yield
    scheduler.shutdown()


# Cria a instância principal do FastAPI com o lifespan
app = FastAPI(
    title="AgendaFlow API",
    description="API do sistema de agendamento multi-tenant AgendaFlow",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Registra o limiter e o handler de erro 429 no estado da aplicação
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configura o CORS — apenas origens explicitamente listadas em ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# Registra os routers na aplicação
app.include_router(tenants_router)
app.include_router(anamnese_router)
app.include_router(provisioning_router)
app.include_router(auth_router)
app.include_router(appointments_router)
app.include_router(services_router)
app.include_router(products_router)
app.include_router(professionals_router)
app.include_router(config_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(crm_router)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """
    Gera um correlation ID único por request.
    Aceita X-Request-ID do cliente (útil para rastrear calls do frontend).
    Injeta no contexto de log e devolve no header da resposta.
    """
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    token = request_id_var.set(request_id)
    inicio = time.perf_counter()
    try:
        logger.info(
            "request_start",
            extra={"method": request.method, "path": request.url.path},
        )
        response = await call_next(request)
        duracao_ms = round((time.perf_counter() - inicio) * 1000)
        logger.info(
            "request_end",
            extra={"status": response.status_code, "duration_ms": duracao_ms},
        )
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        request_id_var.reset(token)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """
    Adiciona headers de segurança HTTP a todas as respostas.
    Mitiga clickjacking, MIME sniffing e vazamento de referrer.
    HSTS e CSP só em produção — em dev o Swagger UI precisa carregar recursos externos.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response


@app.exception_handler(Exception)
async def erro_global(request: Request, exc: Exception):
    """
    Captura qualquer exceção não tratada e loga com stack trace completo.
    Em produção retorna mensagem genérica — nunca expõe stack trace ao cliente.
    Inclui header CORS manualmente apenas para origens explicitamente permitidas,
    porque o JSONResponse retornado aqui pode não passar pelo CORSMiddleware.
    """
    logger.error(
        "unhandled_exception",
        exc_info=True,
        extra={"path": str(request.url)},
    )

    # Em produção, nunca expõe detalhes internos ao cliente
    mensagem = str(exc) if settings.ENVIRONMENT == "development" else "Erro interno do servidor"

    response = JSONResponse(
        status_code=500,
        content={"detail": mensagem},
    )

    # Só injeta CORS se a origem estiver na lista explícita — nunca usa origem arbitrária
    origem = request.headers.get("origin", "")
    if origem in settings.ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origem
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response


@app.get("/")
def health_check():
    """
    Rota de verificação de saúde da API.
    Retorna status e ambiente atual.
    """
    return {
        "status": "online",
        "app": "AgendaFlow API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    } 