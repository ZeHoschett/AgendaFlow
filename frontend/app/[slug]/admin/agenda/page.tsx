"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CalendarDays, X, DollarSign, CheckCircle,
  Clock, ChevronLeft, ChevronRight, Phone,
} from "lucide-react";
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
  products_total: number;
  total_price: number;
  professional_name: string;
}

// Cor por status — usada no borderLeft e no ícone do card
const statusColor: Record<string, string> = {
  pending:     "#f4bb11",
  confirmed:   "#2D7EF8",
  in_progress: "#7C3AED",
  completed:   "#10B981",
  cancelled:   "#EF4444",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending:     { label: "Pendente",       className: "badge badge-pending" },
    confirmed:   { label: "Confirmado",     className: "badge badge-confirmed" },
    in_progress: { label: "Em Atendimento", className: "badge badge-progress" },
    completed:   { label: "Concluído",      className: "badge badge-completed" },
    cancelled:   { label: "Cancelado",      className: "badge badge-cancelled" },
  };
  const s = map[status] || { label: status, className: "badge" };
  return <span className={s.className}>{s.label}</span>;
}

function SkeletonCards() {
  return (
    <>
      <style>{`@keyframes sk-pulse{0%,100%{opacity:.3}50%{opacity:.65}}`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              height: "72px",
              animation: "sk-pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

export default function AgendaPage() {
  const params = useParams();
  const slug = params.slug as string;

  const hoje = new Date().toISOString().split("T")[0];
  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [cardExpandido, setCardExpandido] = useState<string | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  useEffect(() => {
    carregarAgenda();
  }, [dataSelecionada]);

  async function carregarAgenda() {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const r = await api.get(
        `/appointments/admin/${slug}?data=${dataSelecionada}`,
        { timeout: 30000 }
      );
      setAgendamentos(r.data.agendamentos);
      setTotal(r.data.total);
    } catch {
      setErroCarregamento("Não foi possível carregar a agenda. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function cancelarAgendamento(id: string) {
    if (!confirm("Cancelar este agendamento?")) return;
    try {
      await api.patch(`/appointments/${slug}/${id}/cancelar-admin`, {});
      carregarAgenda();
      setCardExpandido(null);
    } catch {
      alert("Não foi possível cancelar.");
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

  function formatarDataNav(data: string) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function diaAnterior() {
    const d = new Date(dataSelecionada + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setDataSelecionada(d.toISOString().split("T")[0]);
  }

  function proximoDia() {
    const d = new Date(dataSelecionada + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setDataSelecionada(d.toISOString().split("T")[0]);
  }

  // Faturamento total do dia (apenas concluídos) — serviços + produtos
  const faturamentoDia = agendamentos
    .filter((a) => a.status === "completed")
    .reduce((acc, a) => acc + Number(a.total_price), 0);

  const concluidos = agendamentos.filter((a) => a.status === "completed").length;
  const pendentes  = agendamentos.filter((a) => a.status === "pending" || a.status === "confirmed").length;

  return (
    <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <style>{`
        .agenda-title-grad {
          background: linear-gradient(135deg, var(--text-primary) 30%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        html.theme-light .agenda-title-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .kpi-num-green-ag {
          background: linear-gradient(135deg, #34D399, #10B981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .kpi-num-blue-ag {
          background: linear-gradient(135deg, #60A5FA, #2D7EF8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .kpi-num-amber-ag {
          background: linear-gradient(135deg, #f4bb11, #f4bb11);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nav-btn-ag {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          padding: 8px 12px;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s ease;
        }
        .nav-btn-ag:hover {
          background: rgba(45,126,248,0.1);
          border-color: rgba(45,126,248,0.2);
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="agenda-title-grad" style={{
            fontSize: "26px", fontWeight: "800",
            letterSpacing: "-0.5px", marginBottom: "4px",
          }}>
            Agenda Global
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {total} agendamento{total !== 1 ? "s" : ""} · {formatarDataNav(dataSelecionada)}
          </p>
        </div>

        {/* Navegador de data */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          borderRadius: "14px", padding: "6px 8px",
        }}>
          <button className="nav-btn-ag" onClick={diaAnterior}>
            <ChevronLeft size={16} />
          </button>

          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => setDataSelecionada(e.target.value)}
            style={{
              background: "transparent", border: "none",
              color: "var(--text-primary)", fontSize: "13px",
              fontFamily: "Inter, sans-serif", outline: "none",
              fontWeight: "600", cursor: "pointer",
            }}
          />

          <button className="nav-btn-ag" onClick={proximoDia}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* KPI Cards do dia */}
      {agendamentos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

          {/* Faturado — linha própria para o valor monetário ter espaço */}
          <div className="kpi-card" style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))",
            borderColor: "rgba(16,185,129,0.18)", padding: "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "11px", flexShrink: 0,
                background: "linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.1))",
                boxShadow: "0 0 16px rgba(16,185,129,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <DollarSign size={16} color="#10B981" strokeWidth={2.5} />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "700" }}>
                Faturado hoje
              </p>
            </div>
            <p className="kpi-num-green-ag" style={{ fontSize: "22px", fontWeight: "800", letterSpacing: "-0.5px" }}>
              {moeda(faturamentoDia)}
            </p>
          </div>

          {/* Concluídos + Pendentes — lado a lado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>

            {/* Concluídos */}
            <div className="kpi-card" style={{
              background: "linear-gradient(135deg, rgba(45,126,248,0.08), rgba(45,126,248,0.02))",
              borderColor: "rgba(45,126,248,0.18)", padding: "14px 16px",
            }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "10px", marginBottom: "8px",
                background: "linear-gradient(135deg, rgba(96,165,250,0.25), rgba(45,126,248,0.1))",
                boxShadow: "0 0 16px rgba(45,126,248,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CheckCircle size={14} color="#2D7EF8" strokeWidth={2.5} />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px", fontWeight: "700" }}>
                Concluídos
              </p>
              <p className="kpi-num-blue-ag" style={{ fontSize: "28px", fontWeight: "800", letterSpacing: "-0.5px" }}>
                {concluidos}
              </p>
            </div>

            {/* Pendentes */}
            <div className="kpi-card" style={{
              background: "linear-gradient(135deg, rgba(244,187,17,0.08), rgba(244,187,17,0.02))",
              borderColor: "rgba(244,187,17,0.18)", padding: "14px 16px",
            }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "10px", marginBottom: "8px",
                background: "linear-gradient(135deg, rgba(244,187,17,0.25), rgba(244,187,17,0.1))",
                boxShadow: "0 0 16px rgba(244,187,17,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Clock size={14} color="#f4bb11" strokeWidth={2.5} />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px", fontWeight: "700" }}>
                Pendentes
              </p>
              <p className="kpi-num-amber-ag" style={{ fontSize: "28px", fontWeight: "800", letterSpacing: "-0.5px" }}>
                {pendentes}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Skeleton — somente na primeira carga (sem dados ainda) */}
      {carregando && agendamentos.length === 0 && <SkeletonCards />}

      {/* Erro com botão de retry */}
      {erroCarregamento && (
        <div style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.12)",
          borderRadius: "var(--radius-lg)", padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          <p style={{ color: "#FCA5A5", fontSize: "13px" }}>{erroCarregamento}</p>
          <button
            onClick={carregarAgenda}
            style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "var(--radius-sm)", padding: "6px 14px",
              color: "#FCA5A5", fontSize: "12px", fontWeight: "700",
              cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif",
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Estado vazio */}
      {!carregando && !erroCarregamento && agendamentos.length === 0 && (
        <div style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          borderRadius: "var(--radius-xl)", padding: "56px 20px",
          textAlign: "center",
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "18px", margin: "0 auto 14px",
            background: "linear-gradient(135deg, rgba(45,126,248,0.15), rgba(45,126,248,0.05))",
            border: "1px solid rgba(45,126,248,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CalendarDays size={24} color="#2D7EF8" strokeWidth={1.8} />
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
            Nenhum agendamento
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
            Não há agendamentos para esta data.
          </p>
        </div>
      )}

      {/* Lista — mantém dados visíveis durante reload */}
      {agendamentos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {agendamentos.map((ag) => {
            const expandido = cardExpandido === ag.id;
            const cor = statusColor[ag.status] || "#94A3B8";
            const inicial = ag.client_name?.[0]?.toUpperCase() || "?";
            return (
              <div
                key={ag.id}
                onClick={() => setCardExpandido(expandido ? null : ag.id)}
                style={{
                  background: expandido
                    ? `linear-gradient(135deg, ${cor}0D, rgba(255,255,255,0.02))`
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${expandido ? cor + "35" : "rgba(255,255,255,0.07)"}`,
                  borderLeft: `3px solid ${cor}`,
                  borderRadius: "16px", padding: "16px 18px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: expandido ? `0 4px 20px ${cor}15` : "none",
                }}
              >
                {/* Linha principal */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                    {/* Avatar do cliente */}
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
                      background: `linear-gradient(135deg, ${cor}25, ${cor}10)`,
                      border: `1px solid ${cor}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "15px", fontWeight: "800", color: cor,
                    }}>
                      {inicial}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        color: "var(--text-primary)", fontSize: "14px", fontWeight: "700",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {ag.client_name}
                      </p>
                      <p style={{
                        color: "var(--text-muted)", fontSize: "12px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {ag.service_name} · {ag.professional_name}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                    {/* Badge de horário */}
                    <span style={{
                      background: `${cor}18`,
                      border: `1px solid ${cor}30`,
                      borderRadius: "8px", padding: "3px 9px",
                      color: cor, fontSize: "13px", fontWeight: "800",
                      whiteSpace: "nowrap",
                    }}>
                      {ag.scheduled_time.slice(0, 5)}
                    </span>
                    <StatusBadge status={ag.status} />
                  </div>
                </div>

                {/* Valor — linha inferior compacta */}
                <div style={{
                  marginTop: "10px", paddingTop: "10px",
                  borderTop: `1px solid ${cor}15`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    Total do agendamento
                  </p>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#10B981", fontSize: "14px", fontWeight: "700" }}>
                      {moeda(ag.total_price)}
                    </p>
                    {Number(ag.products_total) > 0 && (
                      <p style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                        incl. {moeda(ag.products_total)} em prod.
                      </p>
                    )}
                  </div>
                </div>

                {/* Conteúdo expandido */}
                {expandido && (
                  <div
                    className="animate-fade-up"
                    style={{
                      marginTop: "14px",
                      paddingTop: "14px",
                      borderTop: `1px solid ${cor}20`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Detalhes */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 1fr",
                      gap: "8px", marginBottom: "12px",
                    }}>
                      {[
                        { label: "Cliente", valor: ag.client_name },
                        { label: "Telefone", valor: formatarTelefone(ag.client_phone) },
                        { label: "Serviço", valor: ag.service_name },
                        { label: "Profissional", valor: ag.professional_name },
                      ].map((item) => (
                        <div key={item.label} style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: "12px", padding: "10px 12px",
                        }}>
                          <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px", fontWeight: "700" }}>
                            {item.label}
                          </p>
                          <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: "600" }}>
                            {item.valor}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Resumo financeiro do agendamento */}
                    <div style={{
                      background: "rgba(16,185,129,0.06)",
                      border: "1px solid rgba(16,185,129,0.12)",
                      borderLeft: "3px solid rgba(16,185,129,0.4)",
                      borderRadius: "12px", padding: "12px 14px",
                      marginBottom: "12px",
                      display: "flex", flexDirection: "column", gap: "6px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>Serviço</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600" }}>
                          {moeda(ag.service_price)}
                        </p>
                      </div>
                      {Number(ag.products_total) > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>Produtos</p>
                          <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600" }}>
                            {moeda(ag.products_total)}
                          </p>
                        </div>
                      )}
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        borderTop: "1px solid rgba(255,255,255,0.07)",
                        paddingTop: "8px", marginTop: "2px",
                      }}>
                        <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: "700" }}>Total</p>
                        <p style={{ color: "#10B981", fontSize: "14px", fontWeight: "800" }}>
                          {moeda(ag.total_price)}
                        </p>
                      </div>
                    </div>

                    {/* Link WhatsApp */}
                    {ag.client_phone && (
                      <a
                        href={`https://wa.me/55${ag.client_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          width: "100%", padding: "10px",
                          background: "rgba(16,185,129,0.08)",
                          border: "1px solid rgba(16,185,129,0.2)",
                          borderRadius: "12px", marginBottom: "10px",
                          color: "#10B981", fontSize: "13px", fontWeight: "600",
                          textDecoration: "none", cursor: "pointer",
                        }}
                      >
                        <Phone size={14} strokeWidth={2} />
                        Contatar via WhatsApp
                      </a>
                    )}

                    {/* Botão cancelar */}
                    {ag.status !== "cancelled" && ag.status !== "completed" && (
                      <button
                        className="btn-danger"
                        onClick={() => cancelarAgendamento(ag.id)}
                        style={{ width: "100%", gap: "6px" }}
                      >
                        <X size={14} />
                        Cancelar Agendamento
                      </button>
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
