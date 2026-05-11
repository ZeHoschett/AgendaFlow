# APScheduler para executar jobs em background automaticamente
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text
from datetime import datetime, timezone

# Importa a sessão do banco de dados
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)

# ID inteiro fixo para pg_advisory_lock — identifica exclusivamente este job no cluster
_LOCK_ID = 987654321


def atualizar_status_agendamentos():
    """
    Job executado automaticamente a cada 5 minutos.

    Com múltiplos workers uvicorn, apenas um processo executa por vez:
    pg_try_advisory_lock retorna false nos demais e o job é pulado neles.

    Lógica de atualização automática de status:
    - pending → confirmed: agendamentos pendentes no dia atual
    - confirmed → in_progress: horário agendado + 1 minuto já passou
    - in_progress → completed: horário agendado + 1 hora já passou
    """
    db = SessionLocal()
    adquiriu_lock = False

    try:
        # Tenta adquirir o advisory lock — não bloqueia, retorna false imediatamente
        # se outro worker já está executando este job
        adquiriu_lock = db.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)"),
            {"lock_id": _LOCK_ID},
        ).scalar()

        if not adquiriu_lock:
            logger.info("scheduler_skip", extra={"reason": "outro worker segura o lock"})
            return

        agora = datetime.now(timezone.utc)
        data_atual = agora.date()
        hora_atual = agora.strftime("%H:%M:%S")

        # Busca todos os schemas de tenants ativos
        tenants = db.execute(text("""
            SELECT schema_name FROM public.tenants
            WHERE is_active = true
        """)).mappings().all()

        for tenant in tenants:
            schema = tenant["schema_name"]

            # pending → confirmed
            db.execute(text(f"""
                UPDATE "{schema}".appointments
                SET status = 'confirmed'
                WHERE status = 'pending'
                AND scheduled_date = :data
            """), {"data": data_atual})

            # confirmed → in_progress (horário + 1 min já passou)
            db.execute(text(f"""
                UPDATE "{schema}".appointments
                SET status = 'in_progress'
                WHERE status = 'confirmed'
                AND scheduled_date = :data
                AND scheduled_time <= CAST(:hora AS TIME) - INTERVAL '1 minute'
            """), {"data": data_atual, "hora": hora_atual})

            # in_progress → completed + débito de estoque
            # CTE captura os IDs concluídos e debita 1 unidade por produto vinculado
            db.execute(text(f"""
                WITH concluidos AS (
                    UPDATE "{schema}".appointments
                    SET status = 'completed'
                    WHERE status = 'in_progress'
                    AND scheduled_date = :data
                    AND scheduled_time <= CAST(:hora AS TIME) - INTERVAL '1 hour'
                    RETURNING id
                )
                UPDATE "{schema}".products
                SET stock = stock - 1
                WHERE id IN (
                    SELECT product_id
                    FROM "{schema}".appointment_products
                    WHERE appointment_id IN (SELECT id FROM concluidos)
                )
                AND stock > 0
            """), {"data": data_atual, "hora": hora_atual})

        db.commit()

    except Exception:
        logger.error("scheduler_error", exc_info=True)
        db.rollback()
    finally:
        if adquiriu_lock:
            try:
                db.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"),
                    {"lock_id": _LOCK_ID},
                )
                db.commit()
            except Exception:
                pass
        db.close()


def iniciar_scheduler():
    """
    Inicia o scheduler em background quando a aplicação sobe.
    O job roda a cada 5 minutos para manter os status atualizados.
    Com múltiplos workers, pg_advisory_lock garante execução única.
    """
    scheduler = BackgroundScheduler()

    scheduler.add_job(
        atualizar_status_agendamentos,
        trigger="interval",
        minutes=5,
        id="atualizar_status",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("scheduler_started", extra={"job": "atualizar_status", "interval_min": 5})
    return scheduler