# Bibliotecas para geração e validação de tokens JWT
from jose import JWTError, jwt
# Biblioteca para hash de senhas
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

# FastAPI para dependências de autenticação
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

# Importa as configurações centrais do projeto
from app.core.config import settings
from app.core.database import get_db

# Contexto de criptografia usando bcrypt com rounds fixo em 12.
# Rounds 12 = ~150ms por hash — equilíbrio ideal entre segurança e performance.
# Rounds menores (ex: 10) são rápidos demais, vulneráveis a brute-force.
# Rounds maiores (ex: 14+) travam o servidor por 1-2s e causam fila de espera no login.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_senha(senha: str) -> str:
    """
    Gera o hash seguro de uma senha.
    Truncamos em 72 bytes para respeitar o limite do bcrypt.
    """
    senha_truncada = senha[:72]
    return pwd_context.hash(senha_truncada)


def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    """
    Compara a senha digitada com o hash salvo no banco.
    """
    senha_truncada = senha_plana[:72]
    return pwd_context.verify(senha_truncada, senha_hash)


def criar_token_acesso(dados: dict, expira_em: Optional[int] = None) -> str:
    """
    Gera um token JWT com os dados do usuário.
    Inclui um JTI (JWT ID) único para suportar revogação individual via blacklist.
    """
    dados_token = dados.copy()
    minutos = expira_em or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expira = datetime.now(timezone.utc) + timedelta(minutes=minutos)
    dados_token.update({"exp": expira, "jti": str(uuid4())})

    token = jwt.encode(
        dados_token,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return token


def revogar_token(db: Session, jti: str, exp_timestamp: int) -> None:
    """
    Insere o JTI na blacklist até sua expiração original.
    Chamado no logout para invalidar imediatamente o token mesmo antes de expirar.
    """
    expira = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    db.execute(text("""
        INSERT INTO public.token_blacklist (jti, expires_at)
        VALUES (:jti, :expires_at)
        ON CONFLICT (jti) DO NOTHING
    """), {"jti": jti, "expires_at": expira})
    db.commit()


def decodificar_token(token: str) -> Optional[dict]:
    """
    Decodifica e valida um token JWT.
    Retorna os dados do token se válido, None se inválido ou expirado.
    """
    try:
        dados = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return dados
    except JWTError:
        return None


def get_usuario_atual(
    agendaflow_session: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """
    Dependência que valida o JWT lido do cookie HttpOnly.
    Verifica também se o token foi revogado via blacklist (logout explícito).
    Retorna os dados do usuário autenticado.
    Lança 401 se o cookie estiver ausente, o token inválido/expirado ou revogado.
    """
    nao_autorizado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not agendaflow_session:
        raise nao_autorizado

    dados = decodificar_token(agendaflow_session)
    if not dados:
        raise nao_autorizado

    # Rejeita tokens explicitamente revogados (ex: logout antes de expirar)
    jti = dados.get("jti")
    if jti:
        revogado = db.execute(text("""
            SELECT 1 FROM public.token_blacklist
            WHERE jti = :jti AND expires_at > now()
        """), {"jti": jti}).first()
        if revogado:
            raise nao_autorizado

    return dados


def requer_role(roles: list):
    """
    Dependência que valida se o usuário tem a role necessária.
    Uso: Depends(requer_role(["admin"]))

    Ex: só admin pode acessar rotas de dashboard
        só professional pode acessar rotas de agenda
    """
    def verificar(usuario: dict = Depends(get_usuario_atual)):
        if usuario.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para acessar esse recurso",
            )
        return usuario
    return  verificar 