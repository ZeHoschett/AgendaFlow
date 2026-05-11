# FastAPI para criar rotas e gerenciar dependências
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.limiter import limiter

# Importa a sessão do banco de dados
from app.core.database import get_db

# Importa schemas e serviços de autenticação
from app.auth.schemas import UserCreate, UserResponse, LoginRequest, LoginResponse
from app.auth import service as auth_service
from app.core.config import settings
from app.core.security import decodificar_token, revogar_token

# Importa o serviço de tenant para buscar o schema correto
from app.tenants import service as tenant_service

# Cria o roteador do módulo de autenticação
router = APIRouter(
    prefix="/auth",
    tags=["Autenticação"],
)


@router.post(
    "/registrar",
    status_code=status.HTTP_201_CREATED,
)
def registrar_usuario(
    dados: UserCreate,
    tenant_slug: str,
    db: Session = Depends(get_db),
):
    """
    Registra um novo usuário dentro de um tenant.
    O tenant_slug identifica a qual estabelecimento o usuário pertence.
    """

    # Busca o tenant pelo slug para obter o schema_name
    tenant = tenant_service.buscar_tenant_por_slug(db, tenant_slug)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estabelecimento '{tenant_slug}' não encontrado",
        )

    try:
        usuario = auth_service.criar_usuario(db, dados, tenant.schema_name)
        return usuario
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    response: Response,
    dados: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Autentica um usuário e seta o JWT em cookie HttpOnly.
    O token não é exposto no corpo da resposta — o browser o gerencia automaticamente.
    """

    # Mensagem genérica para todos os casos de falha —
    # não revela se o slug, email ou senha estão errados
    credenciais_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Retorna 401 genérico se o tenant não existir (evita enumeração de slugs)
    tenant = tenant_service.buscar_tenant_por_slug(db, dados.tenant_slug)
    if not tenant:
        raise credenciais_invalidas

    usuario = auth_service.autenticar_usuario(
        db,
        dados.email,
        dados.password,
        tenant.schema_name,
    )

    if not usuario:
        raise credenciais_invalidas

    token = auth_service.gerar_token_usuario(usuario, dados.tenant_slug)

    # Cookie HttpOnly — inacessível por JavaScript, protege contra XSS
    # Secure=True somente em produção (HTTPS obrigatório); em dev usa HTTP
    response.set_cookie(
        key="agendaflow_session",
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return LoginResponse(
        role=usuario["role"],
        full_name=usuario["full_name"],
        user_id=str(usuario["id"]),
    )


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    agendaflow_session: Optional[str] = Cookie(default=None),
):
    """
    Encerra a sessão: revoga o JTI na blacklist e apaga o cookie.
    Tokens revogados são rejeitados imediatamente mesmo antes de expirar.
    """
    if agendaflow_session:
        dados = decodificar_token(agendaflow_session)
        if dados and dados.get("jti") and dados.get("exp"):
            revogar_token(db, dados["jti"], int(dados["exp"]))
    response.delete_cookie(key="agendaflow_session", path="/")
    return {"message": "Sessão encerrada"}