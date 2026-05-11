# Importações do SQLAlchemy para queries no banco
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, time, datetime, timezone
from uuid import UUID
from typing import List, Optional


def definir_periodo(horario: time) -> str:
    """
    Define o período do dia baseado no horário.
    Manhã: 06:00 - 11:59
    Tarde: 12:00 - 17:59
    Noite: 18:00 - 23:59
    """
    hora = horario.hour
    if hora < 12:
        return "manha"
    elif hora < 18:
        return "tarde"
    else:
        return "noite"


def buscar_config_estabelecimento(db: Session, schema_name: str) -> dict:
    """
    Busca as configurações do estabelecimento.
    Retorna horário de abertura, fechamento e dias de funcionamento.
    """
    config = db.execute(text(f"""
        SELECT opening_time, closing_time, working_days, cancellation_hours
        FROM "{schema_name}".establishment_config
        LIMIT 1
    """)).mappings().first()

    # Se não tiver configuração, usa os valores padrão do sistema
    if not config:
        return {
            "opening_time": time(7, 0),
            "closing_time": time(21, 30),
            "working_days": "1,2,3,4,5,6",
            "cancellation_hours": 24,
        }

    return dict(config)


def buscar_horarios_disponiveis(
    db: Session,
    schema_name: str,
    professional_id: str,
    data: date,
) -> list:
    """
    Retorna os horários disponíveis para um profissional em uma data.

    Lógica:
    1. Busca configuração do estabelecimento (abertura/fechamento)
    2. Gera todos os slots de hora em hora
    3. Verifica quais já estão ocupados por agendamentos confirmados
    4. Para slots ocupados, busca profissionais alternativos disponíveis
    5. Retorna lista com disponibilidade e alternativas
    """

    config = buscar_config_estabelecimento(db, schema_name)

    # Verifica se a data é um dia de funcionamento.
    # isoweekday() retorna 1=segunda, 2=terça, ..., 6=sábado, 7=domingo.
    # working_days "1,2,3,4,5,6" = segunda a sábado — sábado aparece disponível.
    dia_semana = str(data.isoweekday())
    dias_funcionamento = [d.strip() for d in config["working_days"].split(",")]

    # Verifica se a data está bloqueada pelo admin
    data_bloqueada = db.execute(text(f"""
        SELECT id FROM "{schema_name}".blocked_dates
        WHERE blocked_date = :data
    """), {"data": data}).first()

    if data_bloqueada or dia_semana not in dias_funcionamento:
        return []

    # Busca todos os agendamentos do profissional nessa data
    agendamentos = db.execute(text(f"""
        SELECT scheduled_time
        FROM "{schema_name}".appointments
        WHERE professional_id = :prof_id
        AND scheduled_date = :data
        AND status NOT IN ('cancelled')
    """), {"prof_id": professional_id, "data": data}).mappings().all()

    # Converte para set de horários ocupados para busca rápida
    horarios_ocupados = {str(a["scheduled_time"])[:5] for a in agendamentos}

    # Usa o objeto time completo para respeitar minutos de abertura e fechamento.
    # Exemplo: closing_time=21:30 → slot das 21:00 aparece, slot das 22:00 não.
    abertura = config["opening_time"]    # objeto time completo
    fechamento = config["closing_time"]  # objeto time completo

    hora_atual = abertura.hour
    slots = []

    while True:
        horario = time(hora_atual, 0)

        # Para quando o próximo slot ultrapassaria o horário de fechamento.
        # Ex: fechamento=21:30 → 21:00 < 21:30, entra; 22:00 >= 21:30, para.
        if horario >= time(fechamento.hour, fechamento.minute):
            break

        horario_str = horario.strftime("%H:%M")
        disponivel = horario_str not in horarios_ocupados
        periodo = definir_periodo(horario)

        alternativas = []

        # Se o profissional escolhido estiver ocupado,
        # busca outros profissionais disponíveis nesse horário
        if not disponivel:
            alternativas = buscar_profissionais_alternativos(
                db, schema_name, professional_id, data, horario_str
            )

        slots.append({
            "time": horario_str,
            "period": periodo,
            "available": disponivel,
            "alternative_professionals": alternativas,
        })

        hora_atual += 1

        # Proteção contra loop infinito caso abertura >= 23h
        if hora_atual >= 24:
            break

    return slots


def buscar_profissionais_alternativos(
    db: Session,
    schema_name: str,
    professional_id_excluir: str,
    data: date,
    horario: str,
) -> list:
    """
    Busca profissionais disponíveis em um horário específico.
    Exclui o profissional original da busca.
    Retorna lista com id e nome dos profissionais livres.
    """
    # Busca profissionais que JÁ TÊM agendamento nesse horário
    ocupados = db.execute(text(f"""
        SELECT DISTINCT professional_id
        FROM "{schema_name}".appointments
        WHERE scheduled_date = :data
        AND scheduled_time = :horario
        AND status NOT IN ('cancelled')
    """), {"data": data, "horario": horario}).scalars().all()

    # Busca todos os profissionais ativos exceto o escolhido e os ocupados
    ocupados_ids = list(ocupados) + [professional_id_excluir]

    profissionais = db.execute(text(f"""
        SELECT id, full_name
        FROM "{schema_name}".users
        WHERE role = 'professional'
        AND is_active = true
        AND id != ALL(:ocupados)
    """), {"ocupados": ocupados_ids}).mappings().all()

    return [{"id": str(p["id"]), "name": p["full_name"]} for p in profissionais]


def criar_agendamento(
    db: Session,
    schema_name: str,
    dados: dict,
) -> dict:
    """
    Cria um novo agendamento no sistema.

    Fluxo:
    1. Valida se o horário ainda está disponível
    2. Cria o agendamento com status 'pending'
    3. Adiciona produtos do upsell se houver
    4. Retorna o agendamento criado
    """

    # Valida disponibilidade do horário antes de criar
    horario_str = dados["scheduled_time"].strftime("%H:%M")
    conflito = db.execute(text(f"""
        SELECT id FROM "{schema_name}".appointments
        WHERE professional_id = :prof_id
        AND scheduled_date = :data
        AND scheduled_time = :horario
        AND status NOT IN ('cancelled')
    """), {
        "prof_id": str(dados["professional_id"]),
        "data": dados["scheduled_date"],
        "horario": dados["scheduled_time"],
    }).first()

    if conflito:
        raise ValueError("Horário não está mais disponível")

    # Cria o agendamento
    agendamento = db.execute(text(f"""
        INSERT INTO "{schema_name}".appointments
            (client_name, client_phone, client_id, professional_id,
             service_id, scheduled_date, scheduled_time, notes)
        VALUES
            (:client_name, :client_phone, :client_id, :professional_id,
             :service_id, :scheduled_date, :scheduled_time, :notes)
        RETURNING id, client_name, client_phone, professional_id,
                  service_id, scheduled_date, scheduled_time, status,
                  notes, created_at
    """), {
        "client_name": dados["client_name"],
        "client_phone": dados["client_phone"],
        "client_id": str(dados.get("client_id")) if dados.get("client_id") else None,
        "professional_id": str(dados["professional_id"]),
        "service_id": str(dados["service_id"]),
        "scheduled_date": dados["scheduled_date"],
        "scheduled_time": dados["scheduled_time"],
        "notes": dados.get("notes"),
    }).mappings().first()

    agendamento_id = agendamento["id"]

    # Adiciona produtos do upsell ao agendamento
    for product_id in dados.get("product_ids", []):
        db.execute(text(f"""
            INSERT INTO "{schema_name}".appointment_products
                (appointment_id, product_id)
            VALUES (:appointment_id, :product_id)
        """), {
            "appointment_id": str(agendamento_id),
            "product_id": str(product_id),
        })

    # Registra serviços adicionais (além do service_id principal) na tabela appointment_services
    for service_id_adicional in dados.get("service_ids", []):
        db.execute(text(f"""
            INSERT INTO "{schema_name}".appointment_services
                (appointment_id, service_id)
            VALUES (:appointment_id, :service_id)
            ON CONFLICT DO NOTHING
        """), {
            "appointment_id": str(agendamento_id),
            "service_id": str(service_id_adicional),
        })

    db.commit()

    return dict(agendamento)


def buscar_agenda_profissional(
    db: Session,
    schema_name: str,
    professional_id: str,
    data: date,
) -> list:
    """
    Retorna todos os agendamentos de um profissional em uma data.
    Usado no portal do profissional para visualizar a agenda do dia.
    """
    agendamentos = db.execute(text(f"""
        SELECT
            a.id,
            a.client_name,
            a.client_phone,
            TO_CHAR(a.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
            a.scheduled_time,
            a.status,
            a.notes,
            s.name as service_name,
            s.price as service_price,
            COALESCE((
                SELECT SUM(s2.price)
                FROM "{schema_name}".appointment_services aserv
                JOIN "{schema_name}".services s2 ON s2.id = aserv.service_id
                WHERE aserv.appointment_id = a.id
            ), 0) as servicos_adicionais_total,
            COALESCE((
                SELECT SUM(p.price)
                FROM "{schema_name}".appointment_products ap
                JOIN "{schema_name}".products p ON p.id = ap.product_id
                WHERE ap.appointment_id = a.id
            ), 0) as produto_total
        FROM "{schema_name}".appointments a
        JOIN "{schema_name}".services s ON s.id = a.service_id
        WHERE a.professional_id = :prof_id
        AND a.scheduled_date = :data
        AND a.status NOT IN ('cancelled')
        ORDER BY a.scheduled_time ASC
    """), {"prof_id": professional_id, "data": data}).mappings().all()

    resultado = []
    for a in agendamentos:
        item = dict(a)
        item["scheduled_time"] = str(item["scheduled_time"])[:5]
        item["service_price"] = float(item["service_price"])
        item["servicos_adicionais_total"] = float(item["servicos_adicionais_total"])
        item["produto_total"] = float(item["produto_total"])
        item["total_item"] = item["service_price"] + item["servicos_adicionais_total"] + item["produto_total"]
        resultado.append(item)

    return resultado 