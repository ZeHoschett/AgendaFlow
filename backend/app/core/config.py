# Importa a classe base para configurações do pydantic-settings
# Ela lê automaticamente as variáveis do arquivo .env

from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Classe central de configurações do AgendaFlow.
    Cada atributo aqui corresponde a uma variável no arquivo .env.
    O pydantic valida os tipos automaticamente — se DATABASE_URL não existir, a aplicação não sobe.
    """

    # URL de conexão com o banco PostgreSQL
    DATABASE_URL: str

    # Chave secreta para assinar tokens JWT
    SECRET_KEY: str

    # Algoritmo de criptografia do JWT
    ALGORITHM: str = "HS256"

    # Tempo de expiração do token em minutos
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Ambiente atual: development ou production
    ENVIRONMENT: str = "development"

    # Origens permitidas pelo CORS — separadas por vírgula no .env
    # Exemplo produção: https://meudominio.com.br,https://app.meudominio.com.br
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    # Chave de API para rotas de provisionamento (uso interno do SaaS admin)
    # Enviar no header: X-Provisioning-Key: <valor>
    PROVISIONING_SECRET: str

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    class Config:
        # Informa ao pydantic onde está o arquivo de variáveis de ambiente
        env_file = ".env"


# Instância única de configurações usada em todo o projeto
# Outros módulos importam esse objeto: from app.core.config import settings
settings = Settings()