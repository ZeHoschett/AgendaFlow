"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TrendingUp, Users, Star, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "@/lib/api";

interface DadosDashboard {
  profissional: string;
  periodo: string;
  total_atendimentos: number;
  faturamento_servicos: number;
  faturamento_produtos: number;
  faturamento_total: number;
  commission_rate: number;
  comissao_a_receber: number | null;
  historico: {
    id: string;
    client_name: string;
    scheduled_date: string;
    scheduled_time: string;
    status: string;
    service_name: string;
    service_price: number;
    servicos_adicionais_total: number;
    produto_total: number;
    total_item: number;
  }[];
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

function TooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass" style={{ borderRadius: "12px", padding: "10px 14px", boxShadow: "var(--shadow-md)" }}>
      <p style={{ color: "var(--text-muted)", fontSize: "11px", marginBottom: "4px" }}>{label}</p>
      <p style={{ color: "#10B981", fontSize: "14px", fontWeight: "700" }}>
        {Number(payload[0].value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
    </div>
  );
}

export default function ProfissionalDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [dados, setDados] = useState<DadosDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState("");

  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  useEffect(() => {
    const u = localStorage.getItem("agendaflow_usuario");
    if (u) setProfessionalId(JSON.parse(u).id || "");
  }, []);

  useEffect(() => {
    if (professionalId) carregarDashboard();
  }, [professionalId, mes, ano]);

  async function carregarDashboard() {
    // Verifica role antes de disparar — evita request com ID do admin em sessão compartilhada
    const usuarioSalvo = localStorage.getItem("agendaflow_usuario");
    if (!usuarioSalvo) { window.location.href = "/login"; return; }
    try {
      const u = JSON.parse(usuarioSalvo);
      if (u.role !== "professional") { window.location.href = "/login"; return; }
    } catch { window.location.href = "/login"; return; }

    setCarregando(true);
    setErroCarregamento(null);
    try {
      // O interceptor do api.ts já injeta o token — não duplicar o header aqui
      const r = await api.get(
        `/professionals/${slug}/${professionalId}/dashboard?mes=${mes}&ano=${ano}`,
        { timeout: 30000 }
      );
      setDados(r.data);
    } catch (err: any) {
      // 404 = sessão desatualizada (profissional recriado ou UUID trocado) → novo login
      if (err?.response?.status === 404 || err?.response?.status === 403) {
        window.location.href = "/login";
        return;
      }
      setDados(null);
      setErroCarregamento("Não foi possível carregar o desempenho. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  function moeda(v: number) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarData(data: string) {
    const [, , dia] = data.split("-");
    return `${dia}`;
  }

  function navMes(direcao: number) {
    let novoMes = mes + direcao;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes); setAno(novoAno);
  }

  const nomeMes = new Date(ano, mes - 1, 1)
    .toLocaleString("pt-BR", { month: "long" });

  // Monta dados para o mini gráfico usando total_item (serviços + produtos)
  const dadosGrafico = dados?.historico
    .filter((h) => h.status === "completed")
    .reduce((acc: Record<string, number>, h) => {
      const dia = formatarData(h.scheduled_date);
      acc[dia] = (acc[dia] || 0) + Number(h.total_item);
      return acc;
    }, {});

  const graficoArray = Object.entries(dadosGrafico || {})
    .map(([dia, valor]) => ({ dia, valor }))
    .sort((a, b) => Number(a.dia) - Number(b.dia));

  // Taxa de performance — concluídos / total
  const taxaPerformance = dados?.historico.length
    ? Math.round((dados.historico.filter((h) => h.status === "completed").length / dados.historico.length) * 100)
    : 0;

  return (
    <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <style>{`
        @keyframes sk-pulse-dash {
          0%, 100% { opacity: .3; }
          50% { opacity: .65; }
        }
        @keyframes kpi-glow-blue {
          0%, 100% { box-shadow: 0 0 0 0 rgba(45,126,248,0); }
          50% { box-shadow: 0 0 20px 4px rgba(45,126,248,0.18); }
        }
        @keyframes kpi-glow-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
          50% { box-shadow: 0 0 20px 4px rgba(16,185,129,0.18); }
        }

        .titulo-dash-grad {
          background: linear-gradient(135deg, #E8F0FF 20%, #10B981 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        html.theme-light .titulo-dash-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #10B981 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .kpi-num-blue {
          background: linear-gradient(135deg, #60A5FA, #2D7EF8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .kpi-num-green {
          background: linear-gradient(135deg, #34D399, #10B981);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .mes-capitalizado::first-letter { text-transform: uppercase; }

        .bar-perf {
          height: 6px; border-radius: 999px;
          background: var(--glass-border); overflow: hidden; margin-top: 10px;
        }
        .bar-perf-fill {
          height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, #10B981, #2D7EF8);
          box-shadow: 0 0 8px rgba(16,185,129,0.4);
          transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
        }

        .kpi-icon-blue { animation: kpi-glow-blue 4s ease-in-out infinite; }
        .kpi-icon-green { animation: kpi-glow-green 4s ease-in-out infinite 0.8s; }
      `}</style>

      {/* Cabeçalho com saudação personalizada */}
      <div>
        <p style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: "600",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
          Meu Desempenho
        </p>
        <h1 className="titulo-dash-grad" style={{
          fontSize: "28px", fontWeight: "900",
          letterSpacing: "-0.5px", lineHeight: 1.15,
        }}>
          Olá, {dados?.profissional?.split(" ")[0] || "Profissional"}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
          Acompanhe seus resultados deste mês
        </p>
      </div>

      {/* Navegador de mês */}
      <div className="glass-card" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: "18px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, #10B981, #2D7EF8, transparent)",
        }} />
        <button
          onClick={() => navMes(-1)}
          style={{
            background: "var(--glass-bg-hover)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px", padding: "8px 18px",
            color: "var(--text-secondary)", fontSize: "20px",
            cursor: "pointer", transition: "all 0.2s ease", lineHeight: 1,
          }}
        >
          ‹
        </button>
        <div style={{ textAlign: "center" }}>
          <p className="mes-capitalizado" style={{ color: "var(--text-primary)", fontSize: "17px", fontWeight: "900" }}>
            {nomeMes}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>{ano}</p>
        </div>
        <button
          onClick={() => navMes(1)}
          style={{
            background: "var(--glass-bg-hover)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px", padding: "8px 18px",
            color: "var(--text-secondary)", fontSize: "20px",
            cursor: "pointer", transition: "all 0.2s ease", lineHeight: 1,
          }}
        >
          ›
        </button>
      </div>

      {/* Skeleton */}
      {carregando && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass" style={{
              height: i === 0 ? "120px" : "76px",
              borderRadius: "20px",
              animation: "sk-pulse-dash 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
      )}

      {/* Erro */}
      {!carregando && erroCarregamento && (
        <div style={{
          textAlign: "center", padding: "36px 20px",
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.12)",
          borderRadius: "18px",
        }}>
          <p style={{ color: "#EF4444", fontSize: "14px", marginBottom: "16px" }}>
            {erroCarregamento}
          </p>
          <button onClick={carregarDashboard} className="btn-secondary">
            Tentar novamente
          </button>
        </div>
      )}

      {!carregando && !erroCarregamento && dados && (
        <>
          {/* Cards de métricas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>

            {/* Faturamento — ocupa linha inteira */}
            <div className="glass-card" style={{
              gridColumn: "1 / -1", borderRadius: "20px", position: "relative", overflow: "hidden",
              background: "linear-gradient(145deg, rgba(16,185,129,0.07), rgba(45,126,248,0.05), rgba(255,255,255,0.02))",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: "linear-gradient(90deg, #10B981, #2D7EF8, transparent)", zIndex: 1,
              }} />

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
                <div>
                  <p style={{
                    fontSize: "11px", fontWeight: "700", color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px",
                  }}>
                    Faturamento do Mês
                  </p>
                  <p style={{
                    fontSize: "36px", fontWeight: "900",
                    color: "#34D399", letterSpacing: "-1.5px", lineHeight: 1,
                  }}>
                    {moeda(dados.faturamento_total)}
                  </p>
                </div>
                <div style={{
                  width: "50px", height: "50px", borderRadius: "15px",
                  background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.1))",
                  border: "1px solid rgba(16,185,129,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 20px rgba(16,185,129,0.15)",
                }}>
                  <DollarSign size={22} color="#34D399" strokeWidth={1.8} />
                </div>
              </div>

              {/* Breakdown serviços / produtos */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div style={{
                  flex: 1, minWidth: "100px",
                  background: "rgba(45,126,248,0.08)",
                  border: "1px solid rgba(45,126,248,0.18)",
                  borderRadius: "12px", padding: "10px 14px",
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                    Serviços
                  </p>
                  <p style={{ color: "#60A5FA", fontSize: "15px", fontWeight: "800" }}>
                    {moeda(dados.faturamento_servicos)}
                  </p>
                </div>
                {dados.faturamento_produtos > 0 && (
                  <div style={{
                    flex: 1, minWidth: "100px",
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.18)",
                    borderRadius: "12px", padding: "10px 14px",
                  }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                      Produtos
                    </p>
                    <p style={{ color: "#34D399", fontSize: "15px", fontWeight: "800" }}>
                      {moeda(dados.faturamento_produtos)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Atendimentos */}
            <div className="kpi-card" style={{
              borderRadius: "20px",
              background: "linear-gradient(145deg, rgba(45,126,248,0.08) 0%, rgba(255,255,255,0.03) 100%)",
            }}>
              <div style={{
                position: "absolute", top: 0, left: "15%", right: "35%", height: "2px",
                background: "linear-gradient(90deg, #2D7EF8, transparent)", zIndex: 1,
              }} />
              <div
                className="kpi-icon-blue"
                style={{
                  width: "42px", height: "42px", borderRadius: "13px",
                  background: "linear-gradient(135deg, rgba(45,126,248,0.25), rgba(45,126,248,0.1))",
                  border: "1px solid rgba(45,126,248,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "14px",
                }}
              >
                <Users size={19} color="#60A5FA" strokeWidth={1.8} />
              </div>
              <p style={{
                fontSize: "10px", fontWeight: "700", color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px",
              }}>
                Atendimentos
              </p>
              <p className="kpi-num-blue" style={{ fontSize: "36px", fontWeight: "900", lineHeight: 1 }}>
                {dados.total_atendimentos}
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "5px" }}>este mês</p>
            </div>

            {/* Performance */}
            <div className="kpi-card" style={{
              borderRadius: "20px",
              background: "linear-gradient(145deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.03) 100%)",
            }}>
              <div style={{
                position: "absolute", top: 0, left: "15%", right: "35%", height: "2px",
                background: "linear-gradient(90deg, #10B981, transparent)", zIndex: 1,
              }} />
              <div
                className="kpi-icon-green"
                style={{
                  width: "42px", height: "42px", borderRadius: "13px",
                  background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.1))",
                  border: "1px solid rgba(16,185,129,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "14px",
                }}
              >
                <Star size={19} color="#34D399" strokeWidth={1.8} />
              </div>
              <p style={{
                fontSize: "10px", fontWeight: "700", color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px",
              }}>
                Performance
              </p>
              <p className="kpi-num-green" style={{ fontSize: "36px", fontWeight: "900", lineHeight: 1 }}>
                {taxaPerformance}%
              </p>
              <div className="bar-perf">
                <div className="bar-perf-fill" style={{ width: `${taxaPerformance}%` }} />
              </div>
            </div>
          </div>

          {/* Comissão */}
          {dados.commission_rate > 0 && dados.comissao_a_receber !== null && (
            <div className="glass-card" style={{
              borderRadius: "20px",
              background: "linear-gradient(135deg, rgba(244,187,17,0.08), rgba(244,187,17,0.03))",
              borderColor: "rgba(244,187,17,0.2)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: "linear-gradient(90deg, #f4bb11, #f4bb11, transparent)", zIndex: 1,
              }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "13px", flexShrink: 0,
                    background: "linear-gradient(135deg, rgba(244,187,17,0.25), rgba(244,187,17,0.1))",
                    border: "1px solid rgba(244,187,17,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <TrendingUp size={20} color="#f4bb11" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p style={{ color: "var(--color-warning-dim)", fontSize: "13px", fontWeight: "700", marginBottom: "3px" }}>
                      Comissão a receber
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                      {dados.commission_rate}% sobre concluídos
                    </p>
                  </div>
                </div>
                <p style={{
                  color: "#f4bb11", fontSize: "22px", fontWeight: "900",
                  letterSpacing: "-0.5px", flexShrink: 0,
                }}>
                  {moeda(dados.comissao_a_receber)}
                </p>
              </div>
            </div>
          )}

          {/* Gráfico */}
          {graficoArray.length > 1 && (
            <div className="glass-card" style={{ borderRadius: "20px", position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: "linear-gradient(90deg, #10B981, #2D7EF8, transparent)", zIndex: 1,
              }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "34px", height: "34px", borderRadius: "10px",
                    background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.1))",
                    border: "1px solid rgba(16,185,129,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <TrendingUp size={16} color="#34D399" strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                      Evolução de Faturamento
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                      Receita diária — atendimentos concluídos
                    </p>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={graficoArray} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="75%" stopColor="#10B981" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tick={{ fill: "#4B5568", fontSize: 11, fontWeight: 600 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#4B5568", fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <Tooltip content={<TooltipCustom />} cursor={{ stroke: "rgba(16,185,129,0.2)", strokeWidth: 1 }} />
                  <Area
                    type="monotone" dataKey="valor"
                    stroke="#10B981" strokeWidth={2.5}
                    fill="url(#gradientProf)"
                    dot={{ fill: "#10B981", strokeWidth: 2, stroke: "#080C14", r: 4 }}
                    activeDot={{ r: 6, fill: "#10B981", stroke: "#080C14", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Histórico */}
          <div className="glass-card" style={{ borderRadius: "20px", position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "2px",
              background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)", zIndex: 1,
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "10px",
                background: "linear-gradient(135deg, rgba(45,126,248,0.25), rgba(45,126,248,0.1))",
                border: "1px solid rgba(45,126,248,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Users size={16} color="#60A5FA" strokeWidth={2} />
              </div>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                  Histórico do Mês
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  {dados.historico.length} atendimento{dados.historico.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {dados.historico.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  Nenhum atendimento este mês.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {dados.historico.map((h) => {
                  const statusColor: Record<string, string> = {
                    completed: "#10B981", confirmed: "#2D7EF8",
                    pending: "#f4bb11", in_progress: "#7C3AED", cancelled: "#EF4444",
                  };
                  const cor = statusColor[h.status] || "#4B5568";
                  const inicial = h.client_name?.[0]?.toUpperCase() || "?";
                  return (
                  <div
                    key={h.id}
                    style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "12px 14px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: "14px",
                      borderLeft: `3px solid ${cor}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {/* Avatar inicial do cliente */}
                      <div style={{
                        width: "38px", height: "38px", borderRadius: "11px", flexShrink: 0,
                        background: `linear-gradient(135deg, ${cor}30, ${cor}15)`,
                        border: `1px solid ${cor}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "15px", fontWeight: "800", color: cor,
                      }}>
                        {inicial}
                      </div>

                      <div>
                        <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: "700", marginBottom: "2px" }}>
                          {h.client_name}
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                          {h.service_name}
                        </p>
                        <p style={{ color: "#4B5568", fontSize: "10px", marginTop: "2px" }}>
                          {h.scheduled_date.split("-")[2]}/{String(h.scheduled_date.split("-")[1])} · {h.scheduled_time.slice(0, 5)}
                        </p>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <StatusBadge status={h.status} />
                      <p style={{ color: "#10B981", fontSize: "13px", fontWeight: "800", marginTop: "5px" }}>
                        {moeda(h.total_item)}
                      </p>
                      {/* Indica se há produtos ou serviços adicionais neste item */}
                      {(h.produto_total > 0 || h.servicos_adicionais_total > 0) && (
                        <p style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "2px" }}>
                          {moeda(h.service_price)} + extras
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
