# Importações do SQLAlchemy para queries no banco
from sqlalchemy.orm import Session
from sqlalchemy import text

# Schemas de autenticação
from app.auth.schemas import UserCreate

# Funções de segurança — hash de senha e geração de token
from app.core.security import hash_senha, verificar_senha, criar_token_acesso


def criar_usuario(db: Session, dados: UserCreate, schema_name: str) -> dict:
    """
    Cria um novo usuário dentro do schema do tenant usando SQL puro.

    Por que SQL puro aqui e não ORM?
    O SQLAlchemy ORM não respeita dinamicamente o schema por tenant.
    Usando SQL puro com o schema explícito no nome da tabela,
    garantimos que a query vai para o schema certo do tenant.
    """

    # Verifica se já existe usuário com esse email no schema do tenant
    resultado = db.execute(text(f"""
        SELECT id FROM "{schema_name}".users
        WHERE email = :email
    """), {"email": dados.email}).first()

    if resultado:
        raise ValueError(f"Email '{dados.email}' já está cadastrado")

    # Cria o hash seguro da senha antes de salvar
    senha_hash = hash_senha(dados.password)

    # Insere o usuário no schema correto do tenant
    # RETURNING retorna os dados do registro criado sem precisar de outro SELECT
    novo_usuario = db.execute(text(f"""
        INSERT INTO "{schema_name}".users
            (email, password_hash, role, full_name, phone)
        VALUES
            (:email, :password_hash, :role, :full_name, :phone)
        RETURNING id, email, role, full_name, phone, is_active, created_at
    """), {
        "email": dados.email,
        "password_hash": senha_hash,
        "role": dados.role,
        "full_name": dados.full_name,
        "phone": dados.phone,
    }).mappings().first()

    db.commit()

    return dict(novo_usuario)


def autenticar_usuario(
    db: Session,
    email: str,
    password: str,
    schema_name: str,
) -> dict | None:
    """
    Verifica se o email e senha estão corretos para o tenant.
    Retorna os dados do usuário se válido, None se credenciais erradas.

    Por segurança, retornamos None tanto para email inexistente
    quanto para senha errada — não revelamos qual dos dois falhou.
    """

    # Busca o usuário pelo email no schema correto do tenant
    usuario = db.execute(text(f"""
        SELECT id, email, password_hash, role, full_name, phone, is_active, created_at
        FROM "{schema_name}".users
        WHERE email = :email AND is_active = true
    """), {"email": email}).mappings().first()

    if not usuario:
        return None

    # Verifica se a senha está correta comparando com o hash
    if not verificar_senha(password, usuario["password_hash"]):
        return None

    return dict(usuario)


def gerar_token_usuario(usuario: dict, tenant_slug: str) -> str:
    """
    Gera o token JWT para o usuário autenticado.
    O token carrega as informações essenciais para identificar
    o usuário e seu tenant em qualquer request subsequente.
    """
    dados_token = {
        "sub": str(usuario["id"]),
        "email": usuario["email"],
        "role": usuario["role"],
        "tenant": tenant_slug,
    }

    return criar_token_acesso(dados_token) 