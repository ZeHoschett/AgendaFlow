"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock, TrendingUp, Phone } from "lucide-react";
import api from "@/lib/api";

interface Agendamento {
  id: string;
  client_name: string;
  client_phone: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  service_name: string;
  service_price: number;
  servicos_adicionais_total: number;
  produto_total: number;
  total_item: number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:     "badge badge-pending",
    confirmed:   "badge badge-confirmed",
    in_progress: "badge badge-progress",
    completed:   "badge badge-completed",
    cancelled:   "badge badge-cancelled",
  };
  const labels: Record<string, string> = {
    pending:     "Pendente",
    confirmed:   "Confirmado",
    in_progress: "Em Atendimento",
    completed:   "Concluído",
    cancelled:   "Cancelado",
  };
  return <span className={map[status] || "badge"}>{labels[status] || status}</span>;
}

export default function ProfissionalAgendaPage() {
  const params = useParams();
  const slug = params.slug as string;

  const hoje = new Date().toISOString().split("T")[0];
  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState("");
  const [cardExpandido, setCardExpandido] = useState<string | null>(null);
  // Controla qual agendamento está sendo confirmado (evita duplo clique)
  const [confirmando, setConfirmando] = useState<string | null>(null);

  useEffect(() => {
    const u = localStorage.getItem("agendaflow_usuario");
    if (u) setProfessionalId(JSON.parse(u).id || "");
  }, []);

  useEffect(() => {
    if (professionalId) carregarAgenda();
  }, [professionalId, dataSelecionada]);

  async function carregarAgenda() {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const r = await api.get(
        `/appointments/agenda/${slug}/${professionalId}/${dataSelecionada}`,
        { timeout: 30000 }
      );
      setAgendamentos(r.data.agendamentos || []);
    } catch {
      // Preserva dados anteriores — só exibe erro, não limpa a lista
      setErroCarregamento("Não foi possível carregar a agenda. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarAtendimento(id: string) {
    setConfirmando(id);
    try {
      await api.patch(
        `/appointments/${slug}/${id}/confirmar`,
        {},
        { timeout: 30000 }
      );
      // Recarrega a agenda para refletir o novo status
      await carregarAgenda();
    } catch {
      setErroCarregamento("Não foi possível confirmar o atendimento. Tente novamente.");
    } finally {
      setConfirmando(null);
    }
  }

  function moeda(v: number) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Formata número de telefone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  function formatarTelefone(phone: string): string {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone || "";
  }

  function formatarData(data: string) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function diaDaSemana(data: string) {
    const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return dias[new Date(data + "T12:00:00").getDay()];
  }

  function navData(direcao: number) {
    const d = new Date(dataSelecionada + "T12:00:00");
    d.setDate(d.getDate() + direcao);
    setDataSelecionada(d.toISOString().split("T")[0]);
  }

  // Faturamento do dia inclui serviços + produtos dos atendimentos concluídos
  const faturamentoDia = agendamentos
    .filter((a) => a.status === "completed")
    .reduce((acc, a) => acc + Number(a.total_item || a.service_price), 0);

  const concluidos = agendamentos.filter((a) => a.status === "completed").length;
  const pendentes  = agendamentos.filter((a) => ["pending", "confirmed"].includes(a.status)).length;

  const statusColor: Record<string, string> = {
    completed: "#10B981", confirmed: "#2D7EF8",
    pending: "#f4bb11", in_progress: "#7C3AED", cancelled: "#EF4444",
  };

  return (
    <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: .3; }
          50% { opacity: .65; }
        }
        @keyframes shimmer-confirm {
          0%   { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(300%)  skewX(-12deg); }
        }
        @keyframes glow-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
          50% { box-shadow: 0 0 18px 3px rgba(16,185,129,0.18); }
        }
        @keyframes glow-blue {
          0%, 100% { box-shadow: 0 0 0 0 rgba(45,126,248,0); }
          50% { box-shadow: 0 0 18px 3px rgba(45,126,248,0.18); }
        }
        @keyframes glow-amber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,187,17,0); }
          50% { box-shadow: 0 0 18px 3px rgba(244,187,17,0.18); }
        }

        .titulo-agenda-grad {
          background: linear-gradient(135deg, #E8F0FF 20%, #2D7EF8 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        html.theme-light .titulo-agenda-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .kpi-num-green {
          background: linear-gradient(135deg, #34D399, #10B981);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .kpi-num-blue {
          background: linear-gradient(135deg, #60A5FA, #2D7EF8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .kpi-num-amber {
          background: linear-gradient(135deg, #f4bb11, #f4bb11);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .btn-confirmar {
          position: relative; overflow: hidden;
          transition: all 0.2s ease;
        }
        .btn-confirmar::after {
          content: "";
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transform: translateX(-150%) skewX(-12deg);
          animation: shimmer-confirm 3s ease-in-out infinite 1.2s;
        }

        .ag-card { transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease; cursor: pointer; }
        .ag-card:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }

        .icon-glow-green { animation: glow-green 4s ease-in-out infinite; }
        .icon-glow-blue  { animation: glow-blue  4s ease-in-out infinite 0.6s; }
        .icon-glow-amber { animation: glow-amber 4s ease-in-out infinite 1.2s; }
      `}</style>

      {/* Cabeçalho */}
      <div>
        <p style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: "600",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
          Minha Agenda
        </p>
        <h1 className="titulo-agenda-grad" style={{
          fontSize: "28px", fontWeight: "900",
          letterSpacing: "-0.5px", lineHeight: 1.15,
        }}>
          {dataSelecionada === hoje ? "Hoje" : diaDaSemana(dataSelecionada)}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
          {formatarData(dataSelecionada)} · {agendamentos.length} atendimento{agendamentos.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {/* Faturado */}
        <div className="kpi-card" style={{
          borderRadius: "20px", textAlign: "center", padding: "16px 10px",
          background: "linear-gradient(145deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.03) 100%)",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "15%", right: "15%", height: "2px",
            background: "linear-gradient(90deg, transparent, #10B981, transparent)", zIndex: 1,
          }} />
          <div className="icon-glow-green" style={{
            width: "36px", height: "36px", borderRadius: "11px",
            background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.1))",
            border: "1px solid rgba(16,185,129,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 10px",
          }}>
            <TrendingUp size={16} color="#34D399" strokeWidth={2} />
          </div>
          <p className="kpi-num-green" style={{ fontSize: "15px", fontWeight: "900", marginBottom: "3px", lineHeight: 1 }}>
            {moeda(faturamentoDia)}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Faturado
          </p>
        </div>

        {/* Concluídos */}
        <div className="kpi-card" style={{
          borderRadius: "20px", textAlign: "center", padding: "16px 10px",
          background: "linear-gradient(145deg, rgba(45,126,248,0.08) 0%, rgba(255,255,255,0.03) 100%)",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "15%", right: "15%", height: "2px",
            background: "linear-gradient(90deg, transparent, #2D7EF8, transparent)", zIndex: 1,
          }} />
          <div className="icon-glow-blue" style={{
            width: "36px", height: "36px", borderRadius: "11px",
            background: "linear-gradient(135deg, rgba(45,126,248,0.25), rgba(45,126,248,0.1))",
            border: "1px solid rgba(45,126,248,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 10px",
          }}>
            <CheckCircle2 size={16} color="#60A5FA" strokeWidth={2} />
          </div>
          <p className="kpi-num-blue" style={{ fontSize: "28px", fontWeight: "900", marginBottom: "3px", lineHeight: 1 }}>
            {concluidos}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Concluídos
          </p>
        </div>

        {/* Pendentes */}
        <div className="kpi-card" style={{
          borderRadius: "20px", textAlign: "center", padding: "16px 10px",
          background: "linear-gradient(145deg, rgba(244,187,17,0.08) 0%, rgba(255,255,255,0.03) 100%)",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "15%", right: "15%", height: "2px",
            background: "linear-gradient(90deg, transparent, #f4bb11, transparent)", zIndex: 1,
          }} />
          <div className="icon-glow-amber" style={{
            width: "36px", height: "36px", borderRadius: "11px",
            background: "linear-gradient(135deg, rgba(244,187,17,0.25), rgba(244,187,17,0.1))",
            border: "1px solid rgba(244,187,17,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 10px",
          }}>
            <Clock size={16} color="#f4bb11" strokeWidth={2} />
          </div>
          <p className="kpi-num-amber" style={{ fontSize: "28px", fontWeight: "900", marginBottom: "3px", lineHeight: 1 }}>
            {pendentes}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Pendentes
          </p>
        </div>
      </div>

      {/* Navegador de data */}
      <div className="glass-card" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: "18px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)",
        }} />
        <button
          onClick={() => navData(-1)}
          style={{
            background: "var(--glass-bg-hover)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px", padding: "8px 18px",
            color: "var(--text-secondary)", fontSize: "20px",
            cursor: "pointer", transition: "all 0.2s ease",
            lineHeight: 1,
          }}
        >
          ‹
        </button>

        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text-primary)", fontSize: "16px", fontWeight: "800" }}>
            {formatarData(dataSelecionada)}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
            {diaDaSemana(dataSelecionada)}
          </p>
          {dataSelecionada === hoje && (
            <span style={{
              display: "inline-block", marginTop: "4px",
              background: "rgba(45,126,248,0.12)",
              border: "1px solid rgba(45,126,248,0.28)",
              borderRadius: "999px", padding: "2px 10px",
              fontSize: "10px", fontWeight: "700", color: "#2D7EF8",
            }}>
              Hoje
            </span>
          )}
        </div>

        <button
          onClick={() => navData(1)}
          style={{
            background: "var(--glass-bg-hover)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px", padding: "8px 18px",
            color: "var(--text-secondary)", fontSize: "20px",
            cursor: "pointer", transition: "all 0.2s ease",
            lineHeight: 1,
          }}
        >
          ›
        </button>
      </div>

      {/* Skeleton na primeira carga */}
      {carregando && agendamentos.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass" style={{
              height: "80px", borderRadius: "18px",
              animation: "sk-pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
      )}

      {/* Erro com botão retry */}
      {erroCarregamento && (
        <div style={{
          textAlign: "center", padding: "36px 20px",
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.12)",
          borderRadius: "18px",
        }}>
          <p style={{ color: "#EF4444", fontSize: "14px", marginBottom: "16px" }}>
            {erroCarregamento}
          </p>
          <button onClick={carregarAgenda} className="btn-secondary">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Estado vazio */}
      {!carregando && !erroCarregamento && agendamentos.length === 0 && (
        <div className="glass-card" style={{
          padding: "52px 20px", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)",
          }} />
          <div style={{
            width: "64px", height: "64px", borderRadius: "18px",
            background: "linear-gradient(135deg, rgba(45,126,248,0.2), rgba(45,126,248,0.08))",
            border: "1px solid rgba(45,126,248,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <CalendarDays size={28} color="#60A5FA" strokeWidth={1.5} />
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: "16px", fontWeight: "700", marginBottom: "6px" }}>
            Nenhum atendimento
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Dia livre — aproveite para descansar!
          </p>
        </div>
      )}

      {/* Lista de agendamentos */}
      {agendamentos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {agendamentos.map((ag) => {
            const expandido = cardExpandido === ag.id;
            const cor = statusColor[ag.status] || "#4B5568";
            const inicial = ag.client_name?.[0]?.toUpperCase() || "?";
            return (
              <div
                key={ag.id}
                className="ag-card"
                onClick={() => setCardExpandido(expandido ? null : ag.id)}
                style={{
                  background: expandido
                    ? `linear-gradient(135deg, ${cor}10, rgba(255,255,255,0.02))`
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${expandido ? cor + "40" : "rgba(255,255,255,0.07)"}`,
                  borderLeft: `3px solid ${cor}`,
                  borderRadius: "18px",
                  padding: "16px 18px",
                  boxShadow: expandido ? `0 8px 28px ${cor}18` : "none",
                }}
              >
                {/* Linha principal */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                    {/* Avatar com inicial do cliente */}
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "13px", flexShrink: 0,
                      background: `linear-gradient(135deg, ${cor}30, ${cor}15)`,
                      border: `1px solid ${cor}40`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "17px", fontWeight: "900", color: cor,
                    }}>
                      {inicial}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        color: "var(--text-primary)", fontSize: "14px", fontWeight: "700",
                        marginBottom: "2px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {ag.client_name}
                      </p>
                      <p style={{
                        color: "var(--text-muted)", fontSize: "12px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {ag.service_name}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px", flexShrink: 0 }}>
                    {/* Hora em destaque */}
                    <span style={{
                      background: `${cor}18`,
                      border: `1px solid ${cor}35`,
                      borderRadius: "8px", padding: "3px 10px",
                      color: cor, fontSize: "13px", fontWeight: "800",
                    }}>
                      {ag.scheduled_time.slice(0, 5)}
                    </span>
                    <StatusBadge status={ag.status} />
                  </div>
                </div>

                {/* Valor + botão confirmar */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginTop: "12px", paddingTop: "10px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <p style={{ color: "#10B981", fontSize: "14px", fontWeight: "800" }}>
                    {moeda(ag.total_item || ag.service_price)}
                  </p>
                  {ag.status === "pending" && (
                    <button
                      className="btn-confirmar"
                      onClick={(e) => { e.stopPropagation(); confirmarAtendimento(ag.id); }}
                      disabled={confirmando === ag.id}
                      style={{
                        background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))",
                        border: "1px solid rgba(16,185,129,0.4)",
                        borderRadius: "10px", padding: "6px 16px",
                        color: "#10B981", fontSize: "12px", fontWeight: "700",
                        cursor: confirmando === ag.id ? "not-allowed" : "pointer",
                        fontFamily: "Inter, sans-serif",
                        opacity: confirmando === ag.id ? 0.5 : 1,
                      }}
                    >
                      {confirmando === ag.id ? "Confirmando..." : "✓ Confirmar"}
                    </button>
                  )}
                </div>

                {/* Expandido */}
                {expandido && (
                  <div
                    className="animate-fade-up"
                    style={{ marginTop: "14px" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "Cliente",  valor: ag.client_name,                                  icon: "👤" },
                        { label: "Telefone", valor: formatarTelefone(ag.client_phone),               icon: "📱" },
                        { label: "Serviço",  valor: ag.service_name,                                 icon: "✂️" },
                        { label: "Total",    valor: moeda(ag.total_item || ag.service_price),         icon: "💰" },
                        ...(ag.produto_total > 0
                          ? [{ label: "Produtos", valor: moeda(ag.produto_total), icon: "🛍️" }]
                          : []),
                        ...(ag.servicos_adicionais_total > 0
                          ? [{ label: "Serv. extras", valor: moeda(ag.servicos_adicionais_total), icon: "➕" }]
                          : []),
                      ].map((item) => (
                        <div key={item.label} style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: "12px", padding: "10px 12px",
                        }}>
                          <p style={{
                            color: "var(--text-muted)", fontSize: "10px",
                            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px",
                          }}>
                            {item.icon} {item.label}
                          </p>
                          <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: "700" }}>
                            {item.valor}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Link WhatsApp */}
                    {ag.client_phone && (
                      <a
                        href={`https://wa.me/55${ag.client_phone.replace(/\D/g, "")}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                          marginTop: "10px", padding: "10px",
                          background: "rgba(16,185,129,0.08)",
                          border: "1px solid rgba(16,185,129,0.2)",
                          borderRadius: "12px", color: "#34D399",
                          fontSize: "13px", fontWeight: "600",
                          textDecoration: "none",
                        }}
                      >
                        <Phone size={14} /> Contato via WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
