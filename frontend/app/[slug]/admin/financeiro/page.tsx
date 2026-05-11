 "use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, CalendarCheck, XCircle, BarChart2, Scissors, Package, Users } from "lucide-react";
import api from "@/lib/api";

interface Resumo {
  total_agendamentos: number;
  concluidos: number;
  cancelados: number;
  faturamento_servicos: number;
  faturamento_produtos: number;
  faturamento_total: number;
  ticket_medio: number;
}

interface ItemServico {
  servico: string;
  quantidade: number;
  faturamento: number;
}

interface ItemProduto {
  produto: string;
  quantidade_vendida: number;
  faturamento: number;
}

interface ItemProfissional {
  profissional: string;
  commission_rate: number;
  total_atendimentos: number;
  faturamento_gerado: number;
  comissao_a_pagar: number;
}

interface ItemDiario {
  data: string;
  atendimentos: number;
  faturamento: number;
}

interface DadosRelatorio {
  periodo: { inicio: string; fim: string };
  resumo: Resumo;
  por_servico: ItemServico[];
  por_produto: ItemProduto[];
  por_profissional: ItemProfissional[];
  diario: ItemDiario[];
}

function TooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(13,17,23,0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px", padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <p style={{ color: "var(--text-muted)", fontSize: "11px", marginBottom: "4px" }}>{label}</p>
      <p style={{ color: "#10B981", fontSize: "14px", fontWeight: "700" }}>
        {Number(payload[0].value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
    </div>
  );
}

export default function FinanceiroPage() {
  const params = useParams();
  const slug = params.slug as string;

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0];

  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);
  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { carregarRelatorio(); }, []);

  async function carregarRelatorio() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await api.get(
        `/reports/${slug}/financial?data_inicio=${dataInicio}&data_fim=${dataFim}`,
        { timeout: 30000 }
      );
      setDados(r.data);
      setBuscou(true);
    } catch (error: unknown) {
      const e = error as { response?: { status?: number; data?: { detail?: string } }; friendlyMessage?: string; message?: string };
      console.error("[Financeiro] erro:", e?.response?.status, e?.response?.data, e?.message);

      const mensagem =
        e?.friendlyMessage ||
        e?.response?.data?.detail ||
        (e?.response?.status === 401 ? "Sessão expirada. Faça login novamente." : null) ||
        (e?.response?.status === 403 ? "Acesso não autorizado." : null) ||
        "Não foi possível gerar o relatório. Tente novamente.";

      setErro(mensagem);
    } finally {
      setCarregando(false);
    }
  }

  function moeda(v: number) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarData(data: string) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function formatarDiaGrafico(data: string) {
    const [, , dia] = data.split("-");
    return `${dia}`;
  }

  function calcPct(faturamento: number) {
    if (!dados?.por_profissional.length) return 0;
    const max = Math.max(...dados.por_profissional.map((p) => Number(p.faturamento_gerado)));
    if (max === 0) return 0;
    return Math.round((Number(faturamento) / max) * 100);
  }

  const coresProfissionais = ["#2D7EF8", "#10B981", "#7C3AED", "#f4bb11", "#EF4444"];

  return (
    <>
      <style>{`
        .fin-title-grad {
          background: linear-gradient(135deg, #E8F0FF 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        html.theme-light .fin-title-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .fin-date-input {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 14px;
          font-family: Inter, sans-serif;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .fin-date-input:focus {
          border-color: rgba(45,126,248,0.5);
        }
        .fin-servico-row:not(:last-child) {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          padding-bottom: 12px;
          margin-bottom: 0;
        }
        .fin-servico-row {
          padding-top: 4px;
        }
      `}</style>

      <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Cabeçalho */}
        <div>
          <h1 className="fin-title-grad" style={{
            fontSize: "24px", fontWeight: "800",
            letterSpacing: "-0.5px", marginBottom: "4px",
          }}>
            Financeiro
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Relatório detalhado por período
          </p>
        </div>

        {/* Seletor de período */}
        <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
          {/* Linha decorativa topo */}
          <div style={{
            position: "absolute", top: 0, left: "20%", right: "20%",
            height: "2px",
            background: "linear-gradient(90deg, #2D7EF8, #10B981)",
            zIndex: 1,
          }} />

          <p style={{
            color: "var(--text-secondary)", fontSize: "13px",
            fontWeight: "700", marginBottom: "16px",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Período de análise
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "16px", width: "100%" }}>
            <div style={{ width: "100%" }}>
              <label style={{
                display: "block", color: "var(--text-muted)",
                fontSize: "11px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.08em",
                marginBottom: "8px",
              }}>De</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="fin-date-input"
              />
            </div>
            <div style={{ width: "100%" }}>
              <label style={{
                display: "block", color: "var(--text-muted)",
                fontSize: "11px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.08em",
                marginBottom: "8px",
              }}>Até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="fin-date-input"
              />
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "16px" }}>
            <button
              onClick={carregarRelatorio}
              disabled={carregando}
              className="btn-primary"
              style={{ width: "100%", opacity: carregando ? 0.7 : 1, gap: "8px", padding: "15px", borderRadius: "16px", fontSize: "15px", fontWeight: "700" }}
            >
              <TrendingUp size={16} />
              {carregando ? "Carregando..." : "Gerar Relatório"}
            </button>
          </div>
        </div>

        {/* Erro ao gerar relatório */}
        {erro && (
          <div style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.12)",
            borderLeft: "3px solid rgba(239,68,68,0.6)",
            borderRadius: "var(--radius-lg)", padding: "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          }}>
            <p style={{ color: "#FCA5A5", fontSize: "13px" }}>{erro}</p>
            <button
              onClick={carregarRelatorio}
              style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px", padding: "6px 14px",
                color: "#FCA5A5", fontSize: "12px", fontWeight: "700",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif",
                flexShrink: 0,
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Resultado */}
        {buscou && dados && (
          <>
            {/* Label do período */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
              <p style={{ color: "var(--text-muted)", fontSize: "12px", whiteSpace: "nowrap" }}>
                {formatarData(dados.periodo.inicio)} → {formatarData(dados.periodo.fim)}
              </p>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
            </div>

            {/* Card principal — Faturamento Total */}
            <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
              {/* Linha decorativa topo bicolor */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: "2px",
                background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)",
                zIndex: 1,
              }} />

              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "12px",
                  background: "rgba(45,126,248,0.12)",
                  border: "1px solid rgba(45,126,248,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 16px rgba(45,126,248,0.15)",
                }}>
                  <DollarSign size={20} color="#2D7EF8" />
                </div>
                <div>
                  <p style={{
                    fontSize: "11px", fontWeight: "700", color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px",
                  }}>
                    Faturamento Total
                  </p>
                  <p style={{
                    fontSize: "30px", fontWeight: "800",
                    color: "var(--text-primary)", letterSpacing: "-1px", lineHeight: 1,
                  }}>
                    {moeda(dados.resumo.faturamento_total)}
                  </p>
                </div>
              </div>

              {/* Mini-cards de breakdown */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <div style={{
                  flex: 1, minWidth: "100px",
                  background: "rgba(45,126,248,0.08)", borderRadius: "12px",
                  padding: "10px 14px",
                  border: "1px solid rgba(45,126,248,0.12)",
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Serviços</p>
                  <p style={{ color: "#2D7EF8", fontSize: "14px", fontWeight: "700" }}>
                    {moeda(dados.resumo.faturamento_servicos)}
                  </p>
                </div>
                <div style={{
                  flex: 1, minWidth: "100px",
                  background: "rgba(16,185,129,0.08)", borderRadius: "12px",
                  padding: "10px 14px",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Produtos</p>
                  <p style={{ color: "#10B981", fontSize: "14px", fontWeight: "700" }}>
                    {moeda(dados.resumo.faturamento_produtos)}
                  </p>
                </div>
                <div style={{
                  flex: 1, minWidth: "100px",
                  background: "rgba(244,187,17,0.08)", borderRadius: "12px",
                  padding: "10px 14px",
                  border: "1px solid rgba(244,187,17,0.12)",
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Ticket Médio</p>
                  <p style={{ color: "#f4bb11", fontSize: "14px", fontWeight: "700" }}>
                    {moeda(dados.resumo.ticket_medio)}
                  </p>
                </div>
              </div>
            </div>

            {/* Atendimentos — 3 KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {[
                {
                  label: "Total", valor: dados.resumo.total_agendamentos,
                  cor: "#2D7EF8", bg: "rgba(45,126,248,0.1)", border: "rgba(45,126,248,0.15)",
                  icon: <CalendarCheck size={16} color="#2D7EF8" />,
                },
                {
                  label: "Concluídos", valor: dados.resumo.concluidos,
                  cor: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.15)",
                  icon: <CalendarCheck size={16} color="#10B981" />,
                },
                {
                  label: "Cancelados", valor: dados.resumo.cancelados,
                  cor: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.15)",
                  icon: <XCircle size={16} color="#EF4444" />,
                },
              ].map((item) => (
                <div key={item.label} className="kpi-card" style={{ textAlign: "center", padding: "16px 8px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "10px",
                    background: item.bg, border: `1px solid ${item.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 8px",
                  }}>
                    {item.icon}
                  </div>
                  <p style={{ color: item.cor, fontSize: "22px", fontWeight: "800", lineHeight: 1 }}>{item.valor}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "4px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* Gráfico diário */}
            {dados.diario.length > 0 && (
              <div className="glass-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "10px",
                      background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <BarChart2 size={16} color="#10B981" />
                    </div>
                    <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                      Faturamento Diário
                    </p>
                  </div>
                  <span style={{
                    background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: "999px", padding: "3px 10px",
                    color: "#6EE7B7", fontSize: "11px", fontWeight: "600",
                  }}>
                    Mensal
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart
                    data={dados.diario.map((d) => ({
                      dia: formatarDiaGrafico(d.data),
                      valor: Number(d.faturamento),
                    }))}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradientFinanceiro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: "#4B5568", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#4B5568", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip content={<TooltipCustom />} />
                    <Area
                      type="monotone" dataKey="valor"
                      stroke="#10B981" strokeWidth={2.5}
                      fill="url(#gradientFinanceiro)"
                      dot={{ fill: "#10B981", stroke: "#080C14", strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5, fill: "#10B981", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Por serviço */}
            {dados.por_servico.length > 0 && (
              <div className="glass-card">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <div style={{
                    width: "34px", height: "34px", borderRadius: "10px",
                    background: "rgba(45,126,248,0.12)", border: "1px solid rgba(45,126,248,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Scissors size={16} color="#2D7EF8" />
                  </div>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>Por Serviço</p>
                    <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>{dados.por_servico.length} serviço{dados.por_servico.length !== 1 ? "s" : ""} no período</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {dados.por_servico.map((s, i) => (
                    <div
                      key={i}
                      className="fin-servico-row"
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        gap: "12px", paddingLeft: "12px",
                        borderLeft: "3px solid rgba(45,126,248,0.4)",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          color: "var(--text-primary)", fontSize: "13px", fontWeight: "600",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{s.servico}</p>
                        <p style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                          {s.quantidade} realizado{s.quantidade !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <p style={{ color: "#2D7EF8", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
                        {moeda(s.faturamento)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Por produto */}
            {dados.por_produto.length > 0 && (
              <div className="glass-card">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <div style={{
                    width: "34px", height: "34px", borderRadius: "10px",
                    background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Package size={16} color="#10B981" />
                  </div>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>Por Produto</p>
                    <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>{dados.por_produto.length} produto{dados.por_produto.length !== 1 ? "s" : ""} no período</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {dados.por_produto.map((p, i) => (
                    <div
                      key={i}
                      className="fin-servico-row"
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        gap: "12px", paddingLeft: "12px",
                        borderLeft: "3px solid rgba(16,185,129,0.4)",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          color: "var(--text-primary)", fontSize: "13px", fontWeight: "600",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{p.produto}</p>
                        <p style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                          {p.quantidade_vendida} vendido{p.quantidade_vendida !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <p style={{ color: "#10B981", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
                        {moeda(p.faturamento)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Por profissional */}
            {dados.por_profissional.length > 0 && (
              <div className="glass-card">
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: "20px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "10px",
                      background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Users size={16} color="#7C3AED" />
                    </div>
                    <div>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                        Por Profissional
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                        Serviços + Produtos
                      </p>
                    </div>
                  </div>
                  <span style={{
                    background: "rgba(45,126,248,0.1)",
                    border: "1px solid rgba(45,126,248,0.2)",
                    borderRadius: "999px", padding: "3px 10px",
                    color: "#93C5FD", fontSize: "11px", fontWeight: "600",
                  }}>
                    Performance
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {dados.por_profissional.map((p, i) => {
                    const pct = calcPct(p.faturamento_gerado);
                    const corProf = coresProfissionais[i % coresProfissionais.length];
                    return (
                      <div key={i}>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: "8px",
                          gap: "12px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: "36px", height: "36px", borderRadius: "50%",
                              background: `linear-gradient(135deg, ${corProf}33, ${corProf}15)`,
                              border: `1px solid ${corProf}40`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "13px", fontWeight: "700", color: corProf,
                              flexShrink: 0,
                              boxShadow: `0 0 12px ${corProf}25`,
                            }}>
                              {p.profissional[0].toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{
                                color: "var(--text-primary)", fontSize: "13px", fontWeight: "600",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {p.profissional}
                              </p>
                              <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                                {p.total_atendimentos} atendimento{p.total_atendimentos !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <p style={{ color: "#10B981", fontSize: "13px", fontWeight: "700" }}>
                              {moeda(p.faturamento_gerado)}
                            </p>
                            <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>{pct}%</p>
                          </div>
                        </div>

                        {/* Barra de progresso colorida por profissional */}
                        <div style={{
                          height: "6px", borderRadius: "999px",
                          background: "rgba(255,255,255,0.06)", overflow: "hidden",
                        }}>
                          <div style={{
                            height: "100%", borderRadius: "999px",
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${corProf}, ${corProf}80)`,
                            transition: "width 0.6s ease",
                          }} />
                        </div>

                        {p.commission_rate > 0 && (
                          <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "rgba(244,187,17,0.06)",
                            border: "1px solid rgba(244,187,17,0.12)",
                            borderRadius: "10px", padding: "8px 12px",
                            marginTop: "10px",
                          }}>
                            <p style={{ color: "#f4bb11", fontSize: "11px", fontWeight: "600" }}>
                              Comissão ({p.commission_rate}%)
                            </p>
                            <p style={{ color: "#f4bb11", fontSize: "12px", fontWeight: "700" }}>
                              {moeda(p.comissao_a_pagar)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Estado vazio */}
            {dados.resumo.total_agendamentos === 0 && (
              <div style={{
                background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-xl)", padding: "48px 20px", textAlign: "center",
              }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "16px",
                  background: "rgba(45,126,248,0.1)", border: "1px solid rgba(45,126,248,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <BarChart2 size={24} color="#2D7EF8" />
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  Nenhum agendamento encontrado neste período.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
