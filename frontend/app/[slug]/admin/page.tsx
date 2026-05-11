"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, TrendingUp, CalendarCheck, XCircle,
  Users, AlertTriangle, Package,
} from "lucide-react";
import api from "@/lib/api";

interface DadosDashboard {
  periodo: string;
  faturamento_mes: number;
  faturamento_bruto: number;
  total_comissoes: number;
  taxa_ocupacao: number;
  cancelamentos: number;
  agendamentos_hoje: number;
  top_profissionais: {
    full_name: string;
    total_atendimentos: number;
    faturamento: number;
  }[];
  alertas_estoque: {
    name: string;
    stock: number;
  }[];
}

// Dados simulados para o gráfico — substituir por dados reais futuramente
const dadosGrafico = [
  { mes: "Jan", valor: 0 },
  { mes: "Fev", valor: 0 },
  { mes: "Mar", valor: 0 },
  { mes: "Abr", valor: 0 },
  { mes: "Mai", valor: 0 },
  { mes: "Jun", valor: 0 },
  { mes: "Jul", valor: 0 },
];

// Tooltip customizado do gráfico
function TooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(13,17,23,0.95)",
      border: "1px solid rgba(45,126,248,0.2)",
      borderRadius: "12px", padding: "10px 16px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      <p style={{ color: "#8B95A8", fontSize: "11px", marginBottom: "4px" }}>{label}</p>
      <p style={{ color: "#2D7EF8", fontSize: "15px", fontWeight: "700" }}>
        {Number(payload[0].value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
    </div>
  );
}

export default function AdminDashboard() {
  const params = useParams();
  const slug = params.slug as string;

  const [dados, setDados] = useState<DadosDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  // Incrementar para forçar o useEffect re-executar (botão "Tentar novamente")
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    // Aguarda o slug estar disponível antes de carregar
    if (!slug) return;

    const controller = new AbortController();

    async function carregar() {
      // Verifica role antes de disparar a requisição — evita 403 por token de outra sessão
      const usuarioSalvo = localStorage.getItem("agendaflow_usuario");
      if (!usuarioSalvo) { window.location.href = "/login"; return; }
      try {
        const u = JSON.parse(usuarioSalvo);
        if (u.role !== "admin") { window.location.href = "/login"; return; }
      } catch { window.location.href = "/login"; return; }

      setCarregando(true);
      setErroCarregamento(null);
      try {
        // O interceptor do api.ts já injeta o token — não duplicar o header aqui
        const r = await api.get(`/dashboard/${slug}`, {
          signal: controller.signal,
          timeout: 30000,
        });
        if (controller.signal.aborted) return;
        setDados(r.data);

        // Atualiza o gráfico com o faturamento do mês atual
        const mesAtual = new Date().getMonth();
        dadosGrafico[mesAtual].valor = r.data.faturamento_mes;
      } catch (err: any) {
        if (controller.signal.aborted) return;
        // 403 = token sem permissão de admin → redireciona para novo login
        if (err?.response?.status === 403) {
          window.location.href = "/login";
          return;
        }
        console.error("[Dashboard] Erro ao carregar:", err);
        setErroCarregamento("Não foi possível carregar o dashboard. Tente novamente.");
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }

    carregar();

    // Cancela a requisição se o componente desmontar antes de completar
    return () => controller.abort();
  }, [slug, tentativa]);

  function moeda(v: number) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Calcula porcentagem do top profissional para barras de progresso
  function calcularPorcentagem(faturamento: number) {
    if (!dados?.top_profissionais.length) return 0;
    const max = Math.max(...dados.top_profissionais.map((p) => Number(p.faturamento)));
    if (max === 0) return 0;
    return Math.round((Number(faturamento) / max) * 100);
  }

  if (carregando) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "60vh", color: "var(--text-muted)", fontSize: "14px",
      }}>
        Carregando dashboard...
      </div>
    );
  }

  if (erroCarregamento) {
    return (
      <div style={{
        textAlign: "center", padding: "40px 20px",
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.12)",
        borderRadius: "var(--radius-xl)",
      }}>
        <p style={{ color: "#FCA5A5", fontSize: "14px", marginBottom: "16px" }}>
          Erro ao carregar. Verifique sua conexão.
        </p>
        <button onClick={() => setTentativa(t => t + 1)} className="btn-secondary">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <style>{`
        .dash-title-grad {
          background: linear-gradient(135deg, var(--text-primary) 30%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        html.theme-light .dash-title-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .kpi-num-green {
          background: linear-gradient(135deg, #34D399, #10B981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .kpi-num-blue {
          background: linear-gradient(135deg, #60A5FA, #2D7EF8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .kpi-num-purple {
          background: linear-gradient(135deg, #A78BFA, #7C3AED);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .kpi-icon-green {
          background: linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.1));
          box-shadow: 0 0 20px rgba(16,185,129,0.15);
        }
        .kpi-icon-blue {
          background: linear-gradient(135deg, rgba(96,165,250,0.25), rgba(45,126,248,0.1));
          box-shadow: 0 0 20px rgba(45,126,248,0.15);
        }
        .kpi-icon-purple {
          background: linear-gradient(135deg, rgba(167,139,250,0.25), rgba(124,58,237,0.1));
          box-shadow: 0 0 20px rgba(124,58,237,0.15);
        }
        .kpi-icon-red {
          background: linear-gradient(135deg, rgba(252,165,165,0.25), rgba(239,68,68,0.1));
          box-shadow: 0 0 20px rgba(239,68,68,0.15);
        }
        .progress-bar-green .progress-bar-fill {
          background: linear-gradient(90deg, #10B981, #34D399) !important;
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ marginBottom: "4px" }}>
        <h1 className="dash-title-grad" style={{
          fontSize: "26px", fontWeight: "800",
          marginBottom: "4px", letterSpacing: "-0.5px",
        }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Período: {dados?.periodo}
        </p>
      </div>

      {/* Cards KPI */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "12px",
      }}>

        {/* Faturamento — card largo */}
        <div className="kpi-card" style={{
          gridColumn: "1 / -1",
          background: "linear-gradient(135deg, rgba(45,126,248,0.08), rgba(16,185,129,0.04))",
          borderColor: "rgba(45,126,248,0.18)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Linha decorativa no topo */}
          <div style={{
            position: "absolute", top: 0, left: "10%", right: "10%",
            height: "2px",
            background: "linear-gradient(90deg, transparent, #2D7EF8, #10B981, transparent)",
          }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <div className="kpi-icon-green" style={{
                  width: "38px", height: "38px", borderRadius: "12px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <DollarSign size={18} color="#10B981" strokeWidth={2} />
                </div>
                <p style={{
                  fontSize: "11px", fontWeight: "700",
                  color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>
                  Faturamento Líquido
                </p>
              </div>
              <p className="kpi-num-green" style={{
                fontSize: "36px", fontWeight: "800",
                letterSpacing: "-1.5px", lineHeight: 1,
              }}>
                {moeda(dados?.faturamento_mes || 0)}
              </p>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: "4px",
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: "var(--radius-full)",
              padding: "4px 10px",
            }}>
              <TrendingUp size={12} color="#10B981" strokeWidth={2.5} />
              <span style={{ color: "#10B981", fontSize: "11px", fontWeight: "700" }}>
                Este mês
              </span>
            </div>
          </div>

          {/* Breakdown: bruto e comissões deduzidas */}
          {(dados?.faturamento_bruto || 0) > 0 && (
            <div style={{
              marginTop: "14px",
              display: "flex", flexWrap: "wrap", gap: "10px",
            }}>
              <div style={{
                background: "rgba(45,126,248,0.08)",
                border: "1px solid rgba(45,126,248,0.15)",
                borderRadius: "10px", padding: "8px 14px",
              }}>
                <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>
                  Bruto
                </p>
                <p style={{ color: "#60A5FA", fontSize: "14px", fontWeight: "700" }}>
                  {moeda(dados?.faturamento_bruto || 0)}
                </p>
              </div>
              {(dados?.total_comissoes || 0) > 0 && (
                <div style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderRadius: "10px", padding: "8px 14px",
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>
                    Comissões
                  </p>
                  <p style={{ color: "#FCA5A5", fontSize: "14px", fontWeight: "700" }}>
                    − {moeda(dados?.total_comissoes || 0)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Linha decorativa */}
          <div style={{
            marginTop: "16px", height: "1px",
            background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)",
            borderRadius: "var(--radius-full)",
          }} />
        </div>

        {/* Taxa de Ocupação */}
        <div className="kpi-card" style={{
          background: "linear-gradient(135deg, rgba(45,126,248,0.07), rgba(45,126,248,0.02))",
          borderColor: "rgba(45,126,248,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div className="kpi-icon-blue" style={{
              width: "36px", height: "36px", borderRadius: "11px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TrendingUp size={16} color="#2D7EF8" strokeWidth={2} />
            </div>
            <p style={{
              fontSize: "11px", fontWeight: "700",
              color: "var(--text-muted)", textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Ocupação
            </p>
          </div>
          <p className="kpi-num-blue" style={{
            fontSize: "32px", fontWeight: "800", letterSpacing: "-0.5px",
          }}>
            {dados?.taxa_ocupacao}%
          </p>
          <div className="progress-bar" style={{ marginTop: "10px" }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${dados?.taxa_ocupacao || 0}%` }}
            />
          </div>
        </div>

        {/* Agendamentos Hoje */}
        <div className="kpi-card" style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.07), rgba(124,58,237,0.02))",
          borderColor: "rgba(124,58,237,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div className="kpi-icon-purple" style={{
              width: "36px", height: "36px", borderRadius: "11px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CalendarCheck size={16} color="#7C3AED" strokeWidth={2} />
            </div>
            <p style={{
              fontSize: "11px", fontWeight: "700",
              color: "var(--text-muted)", textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Hoje
            </p>
          </div>
          <p className="kpi-num-purple" style={{
            fontSize: "32px", fontWeight: "800", letterSpacing: "-0.5px",
          }}>
            {dados?.agendamentos_hoje}
          </p>
          <p style={{ color: "#A78BFA", fontSize: "12px", marginTop: "6px", fontWeight: "600" }}>
            agendamentos
          </p>
        </div>

        {/* Cancelamentos */}
        <div className="kpi-card" style={{
          gridColumn: "1 / -1",
          background: dados?.cancelamentos
            ? "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))"
            : "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))",
          borderColor: dados?.cancelamentos ? "rgba(239,68,68,0.18)" : "rgba(16,185,129,0.18)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <div className={dados?.cancelamentos ? "kpi-icon-red" : "kpi-icon-green"} style={{
                  width: "36px", height: "36px", borderRadius: "11px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <XCircle size={16} color={dados?.cancelamentos ? "#EF4444" : "#10B981"} strokeWidth={2} />
                </div>
                <p style={{
                  fontSize: "11px", fontWeight: "700",
                  color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>
                  Cancelamentos
                </p>
              </div>
              <p style={{
                fontSize: "28px", fontWeight: "800",
                color: dados?.cancelamentos ? "#EF4444" : "#10B981",
                letterSpacing: "-0.5px",
              }}>
                {dados?.cancelamentos}
              </p>
            </div>
            <div style={{
              padding: "8px 14px",
              background: dados?.cancelamentos
                ? "rgba(239,68,68,0.1)"
                : "rgba(16,185,129,0.1)",
              border: `1px solid ${dados?.cancelamentos ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
              borderRadius: "12px",
              fontSize: "11px", fontWeight: "700",
              color: dados?.cancelamentos ? "#FCA5A5" : "#6EE7B7",
            }}>
              {dados?.cancelamentos ? "Este mês" : "Sem cancel."}
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Área */}
      <div className="glass-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
        {/* Linha decorativa no topo */}
        <div style={{
          position: "absolute", top: 0, left: "15%", right: "15%",
          height: "2px",
          background: "linear-gradient(90deg, transparent, #2D7EF8, transparent)",
        }} />

        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "20px",
        }}>
          <div>
            <p style={{
              color: "var(--text-primary)", fontSize: "15px",
              fontWeight: "700", marginBottom: "3px",
            }}>
              Faturamento em Tempo Real
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              Evolução mensal do faturamento
            </p>
          </div>
          <div style={{
            background: "rgba(45,126,248,0.1)",
            border: "1px solid rgba(45,126,248,0.2)",
            borderRadius: "999px", padding: "4px 12px",
            fontSize: "11px", fontWeight: "600", color: "#60A5FA",
          }}>
            Mensal
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={dadosGrafico} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2D7EF8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#2D7EF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fill: "#4B5568", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#4B5568", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `R$${v}`}
            />
            <Tooltip content={<TooltipCustom />} />
            <Area
              type="monotone"
              dataKey="valor"
              stroke="#2D7EF8"
              strokeWidth={2.5}
              fill="url(#gradientBlue)"
              dot={{ fill: "#2D7EF8", stroke: "#080C14", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: "#2D7EF8", stroke: "#080C14", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top Profissionais */}
      <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
        {/* Linha decorativa no topo */}
        <div style={{
          position: "absolute", top: 0, left: "15%", right: "15%",
          height: "2px",
          background: "linear-gradient(90deg, transparent, #10B981, transparent)",
        }} />

        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "18px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="kpi-icon-green" style={{
              width: "34px", height: "34px", borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Users size={16} color="#10B981" strokeWidth={2} />
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: "700" }}>
              Melhores Profissionais
            </p>
          </div>
          <span style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "var(--radius-full)",
            padding: "3px 10px",
            color: "#6EE7B7", fontSize: "11px", fontWeight: "600",
          }}>
            Performance
          </span>
        </div>

        {!dados?.top_profissionais.length ? (
          <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
            Nenhum atendimento concluído este mês.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {dados.top_profissionais.map((prof, i) => {
              const pct = calcularPorcentagem(prof.faturamento);
              const cores = [
                { icon: "#2D7EF8", bar: "linear-gradient(90deg, #2D7EF8, #60A5FA)" },
                { icon: "#10B981", bar: "linear-gradient(90deg, #10B981, #34D399)" },
                { icon: "#7C3AED", bar: "linear-gradient(90deg, #7C3AED, #A78BFA)" },
              ];
              const cor = cores[i % cores.length];
              return (
                <div key={i}>
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", marginBottom: "8px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {/* Avatar com rank */}
                      <div style={{ position: "relative" }}>
                        <div style={{
                          width: "38px", height: "38px", borderRadius: "12px",
                          background: `linear-gradient(135deg, ${cor.icon}30, ${cor.icon}10)`,
                          border: `1px solid ${cor.icon}30`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "15px", fontWeight: "800", color: cor.icon,
                        }}>
                          {prof.full_name[0].toUpperCase()}
                        </div>
                        {i === 0 && (
                          <div style={{
                            position: "absolute", top: -4, right: -4,
                            width: "16px", height: "16px", borderRadius: "999px",
                            background: "linear-gradient(135deg, #f4bb11, #d4a010)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "9px",
                          }}>
                            ★
                          </div>
                        )}
                      </div>
                      <div>
                        <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: "600" }}>
                          {prof.full_name}
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                          {prof.total_atendimentos} atendimentos
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: cor.icon, fontSize: "14px", fontWeight: "700" }}>
                        {pct}%
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                        {moeda(prof.faturamento)}
                      </p>
                    </div>
                  </div>
                  {/* Barra de progresso colorida */}
                  <div style={{
                    height: "5px", borderRadius: "999px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", width: `${pct}%`,
                      background: cor.bar,
                      borderRadius: "999px",
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alertas de Estoque */}
      {dados?.alertas_estoque && dados.alertas_estoque.length > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: "var(--radius-xl)",
          padding: "18px 20px",
          position: "relative", overflow: "hidden",
        }}>
          {/* Linha decorativa */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: "2px",
            background: "linear-gradient(90deg, #EF4444, rgba(239,68,68,0.2), transparent)",
          }} />

          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "14px",
          }}>
            <div className="kpi-icon-red" style={{
              width: "34px", height: "34px", borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AlertTriangle size={16} color="#EF4444" strokeWidth={2} />
            </div>
            <div>
              <p style={{ color: "#FCA5A5", fontSize: "14px", fontWeight: "700" }}>
                Estoque Baixo
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                {dados.alertas_estoque.length} produto{dados.alertas_estoque.length > 1 ? "s" : ""} abaixo do mínimo
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {dados.alertas_estoque.map((item, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.1)",
                borderLeft: "3px solid rgba(239,68,68,0.5)",
                borderRadius: "10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Package size={13} color="#EF4444" strokeWidth={2} />
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: "500" }}>
                    {item.name}
                  </p>
                </div>
                <span style={{
                  color: "#EF4444", fontSize: "12px", fontWeight: "700",
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  padding: "3px 10px", borderRadius: "var(--radius-full)",
                }}>
                  {item.stock} un.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
