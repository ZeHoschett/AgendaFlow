from slowapi import Limiter
from slowapi.util import get_remote_address

# Instância única do limiter — identifica requisições pelo IP do cliente
limiter = Limiter(key_func=get_remote_address)
