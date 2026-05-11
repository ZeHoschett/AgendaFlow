import logging
import sys
from contextvars import ContextVar
from pythonjsonlogger import jsonlogger

# Variável de contexto — isolada por corrotina/request, segura no asyncio
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    """Injeta o request_id atual em todos os registros de log."""
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get("-")
        return True


def configurar_logging(nivel: int = logging.INFO) -> None:
    """
    Configura o logger raiz para emitir JSON estruturado no stdout.
    Campos fixos: timestamp, level, logger, message, request_id.
    Campos extras passados via extra={} aparecem automaticamente no JSON.
    Deve ser chamado uma única vez na inicialização da aplicação.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())

    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s",
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
            "name": "logger",
        },
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(nivel)
    root.handlers = []
    root.addHandler(handler)

    # Reduz verbosidade de libs externas
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
