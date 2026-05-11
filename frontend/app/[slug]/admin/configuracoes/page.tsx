"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Save, Plus, Clock, Calendar, Ban, Shield, Check } from "lucide-react";
import api from "@/lib/api";

interface DataBloqueada {
  id: string;
  blocked_date: string;
  reason: string;
}

const DIAS_SEMANA = [
  { valor: "1", label: "Seg" },
  { valor: "2", label: "Ter" },
  { valor: "3", label: "Qua" },
  { valor: "4", label: "Qui" },
  { valor: "5", label: "Sex" },
  { valor: "6", label: "Sáb" },
  { valor: "7", label: "Dom" },
];

export default function ConfiguracoesPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [abertura, setAbertura] = useState("08:00");
  const [fechamento, setFechamento] = useState("20:00");
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>(["1","2","3","4","5"]);
  const [horasCancelamento, setHorasCancelamento] = useState("24");
  const [endereco, setEndereco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [datasBloqueadas, setDatasBloqueadas] = useState<DataBloqueada[]>([]);
  const [novaData, setNovaData] = useState("");
  const [motivo, setMotivo] = useState("");
  const [bloqueando, setBloqueando] = useState(false);
  const [erroBloquear, setErroBloquear] = useState<string | null>(null);

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      await Promise.all([carregarConfiguracoes(), carregarDatasBloqueadas()]);
    } catch {
      setErroCarregamento("Não foi possível carregar as configurações. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarConfiguracoes() {
    const r = await api.get(`/config/${slug}`, { timeout: 30000 });
    setAbertura(String(r.data.opening_time).slice(0, 5));
    setFechamento(String(r.data.closing_time).slice(0, 5));
    setDiasSelecionados(r.data.working_days.split(","));
    setHorasCancelamento(String(r.data.cancellation_hours));
    setEndereco(r.data.address || "");
  }

  async function carregarDatasBloqueadas() {
    try {
      const r = await api.get(`/config/${slug}/blocked-dates`, { timeout: 30000 });
      setDatasBloqueadas(r.data);
    } catch {
      // Datas bloqueadas são secundárias — falha silenciosa mantém lista vazia
      setDatasBloqueadas([]);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setSalvo(false); setErroSalvar(null);
    try {
      const payload = {
        opening_time: abertura,
        closing_time: fechamento,
        working_days: diasSelecionados.sort().join(","),
        cancellation_hours: parseInt(horasCancelamento),
        address: endereco,
      };
      await api.post(`/config/${slug}`, payload, { timeout: 30000 });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (err: unknown) {
      const e = err as { friendlyMessage?: string; response?: { data?: { detail?: string } } };
      const msg = e.friendlyMessage || e.response?.data?.detail || "Erro ao salvar configurações.";
      console.error("[configuracoes] erro ao salvar:", err);
      setErroSalvar(msg);
    } finally { setSalvando(false); }
  }

  async function bloquear(e: React.FormEvent) {
    e.preventDefault();
    setErroBloquear(null);
    if (!novaData.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErroBloquear("Data inválida. Use o seletor de data.");
      return;
    }
    setBloqueando(true);
    try {
      await api.post(`/config/${slug}/blocked-dates`,
        { blocked_date: novaData, reason: motivo || null },
        { timeout: 30000 }
      );
      setNovaData(""); setMotivo("");
      carregarDatasBloqueadas();
    } catch (err: unknown) {
      const e = err as { friendlyMessage?: string; response?: { data?: { detail?: string } } };
      const msg = e.friendlyMessage || e.response?.data?.detail || "Erro ao bloquear data.";
      console.error("[configuracoes] erro ao bloquear:", err);
      setErroBloquear(msg);
    } finally { setBloqueando(false); }
  }

  function toggleDia(dia: string) {
    setDiasSelecionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  }

  function formatarData(data: string) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  if (carregando) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <div style={{ height: "28px", width: "180px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", marginBottom: "8px" }} />
          <div style={{ height: "16px", width: "260px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            height: "120px", background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)",
            animation: "sk-pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }} />
        ))}
        <style>{`@keyframes sk-pulse{0%,100%{opacity:.3}50%{opacity:.65}}`}</style>
      </div>
    );
  }

  if (erroCarregamento) {
    return (
      <div style={{
        textAlign: "center", padding: "40px 20px",
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.12)",
        borderLeft: "3px solid rgba(239,68,68,0.6)",
        borderRadius: "var(--radius-xl)",
      }}>
        <p style={{ color: "#FCA5A5", fontSize: "14px", marginBottom: "16px" }}>
          Erro ao carregar. Verifique sua conexão.
        </p>
        <button onClick={carregarTudo} className="btn-secondary">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .conf-title-grad {
          background: linear-gradient(135deg, #E8F0FF 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        html.theme-light .conf-title-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .conf-input {
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
        .conf-input:focus {
          border-color: rgba(45,126,248,0.5);
        }
        .conf-dia-btn {
          padding: 10px 0;
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.03);
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: Inter, sans-serif;
          transition: all 0.18s;
          flex: 1;
          text-align: center;
        }
        .conf-dia-btn.ativo {
          border-color: rgba(45,126,248,0.4);
          background: rgba(45,126,248,0.15);
          color: #93C5FD;
          font-weight: 700;
          box-shadow: 0 0 12px rgba(45,126,248,0.15);
        }
        .conf-submit-blue {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: none;
          background: linear-gradient(135deg, #2D7EF8, #1A5FCC);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          font-family: Inter, sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s;
        }
        .conf-submit-blue:disabled { opacity: 0.7; }
        .conf-submit-red {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: none;
          background: linear-gradient(135deg, #EF4444, #B91C1C);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          font-family: Inter, sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s;
        }
        .conf-submit-red:disabled { opacity: 0.7; }
      `}</style>

      <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Cabeçalho */}
        <div>
          <h1 className="conf-title-grad" style={{
            fontSize: "24px", fontWeight: "800",
            letterSpacing: "-0.5px", marginBottom: "4px",
          }}>
            Configurações
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Horários, funcionamento e datas bloqueadas
          </p>
        </div>

        <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Horários */}
          <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, left: "20%", right: "20%",
              height: "2px", background: "linear-gradient(90deg, #2D7EF8, #10B981)",
              zIndex: 1,
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{
                width: "42px", height: "42px", borderRadius: "12px",
                background: "rgba(45,126,248,0.12)", border: "1px solid rgba(45,126,248,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxShadow: "0 0 16px rgba(45,126,248,0.15)",
              }}>
                <Clock size={20} color="#2D7EF8" />
              </div>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                  Horário de Funcionamento
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  Define os slots disponíveis para agendamento
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { label: "Abertura", value: abertura, set: setAbertura },
                { label: "Fechamento", value: fechamento, set: setFechamento },
              ].map((campo) => (
                <div key={campo.label}>
                  <label style={{
                    display: "block", color: "var(--text-muted)",
                    fontSize: "11px", fontWeight: "700",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    marginBottom: "8px",
                  }}>{campo.label}</label>
                  <input
                    type="time"
                    value={campo.value}
                    onChange={(e) => campo.set(e.target.value)}
                    className="conf-input"
                  />
                </div>
              ))}

              <div>
                <label style={{
                  display: "block", color: "var(--text-muted)",
                  fontSize: "11px", fontWeight: "700",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: "8px",
                }}>Endereço do estabelecimento</label>
                <input
                  type="text"
                  placeholder="Ex: Rua das Flores, 123, São Paulo - SP"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="conf-input"
                />
              </div>
            </div>
          </div>

          {/* Dias de funcionamento */}
          <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, left: "20%", right: "20%",
              height: "2px", background: "linear-gradient(90deg, #10B981, #2D7EF8)",
              zIndex: 1,
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{
                width: "42px", height: "42px", borderRadius: "12px",
                background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxShadow: "0 0 16px rgba(16,185,129,0.15)",
              }}>
                <Calendar size={20} color="#10B981" />
              </div>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                  Dias de Funcionamento
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  {diasSelecionados.length} dia{diasSelecionados.length !== 1 ? "s" : ""} selecionado{diasSelecionados.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {DIAS_SEMANA.map((dia) => {
                const ativo = diasSelecionados.includes(dia.valor);
                return (
                  <button
                    key={dia.valor}
                    type="button"
                    onClick={() => toggleDia(dia.valor)}
                    className={`conf-dia-btn${ativo ? " ativo" : ""}`}
                  >
                    {dia.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cancelamento */}
          <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, left: "20%", right: "20%",
              height: "2px", background: "linear-gradient(90deg, #f4bb11, #EF4444)",
              zIndex: 1,
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{
                width: "42px", height: "42px", borderRadius: "12px",
                background: "rgba(244,187,17,0.12)", border: "1px solid rgba(244,187,17,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxShadow: "0 0 16px rgba(244,187,17,0.12)",
              }}>
                <Shield size={20} color="#f4bb11" />
              </div>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                  Política de Cancelamento
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  Antecedência mínima para o cliente cancelar
                </p>
              </div>
            </div>

            <label style={{
              display: "block", color: "var(--text-muted)",
              fontSize: "11px", fontWeight: "700",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: "8px",
            }}>Horas mínimas</label>
            <input
              type="number"
              min="1" max="72"
              value={horasCancelamento}
              onChange={(e) => setHorasCancelamento(e.target.value)}
              className="conf-input"
            />
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "10px" }}>
              O cliente poderá cancelar com até{" "}
              <span style={{
                color: "#f4bb11", fontWeight: "700",
                background: "rgba(244,187,17,0.1)",
                padding: "1px 8px", borderRadius: "6px",
                border: "1px solid rgba(244,187,17,0.2)",
              }}>{horasCancelamento}h</span>{" "}
              de antecedência.
            </p>
          </div>

          {/* Erro ao salvar */}
          {erroSalvar && (
            <div style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.12)",
              borderLeft: "3px solid rgba(239,68,68,0.6)",
              borderRadius: "12px", padding: "12px 16px",
              color: "#FCA5A5", fontSize: "13px", fontWeight: "600",
            }}>
              {erroSalvar}
            </div>
          )}

          {/* Feedback salvo */}
          {salvo && (
            <div style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderLeft: "3px solid rgba(16,185,129,0.6)",
              borderRadius: "12px", padding: "12px 16px",
              color: "#6EE7B7", fontSize: "13px", fontWeight: "600",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <Check size={16} color="#6EE7B7" />
              Configurações salvas com sucesso
            </div>
          )}

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "4px" }}>
            <button
              type="submit"
              className="conf-submit-blue"
              disabled={salvando}
            >
              <Save size={16} />
              {salvando ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </form>

        {/* Datas bloqueadas */}
        <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", top: 0, left: "20%", right: "20%",
            height: "2px", background: "linear-gradient(90deg, #EF4444, #f4bb11)",
            zIndex: 1,
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{
              width: "42px", height: "42px", borderRadius: "12px",
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, boxShadow: "0 0 16px rgba(239,68,68,0.12)",
            }}>
              <Ban size={20} color="#EF4444" />
            </div>
            <div>
              <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                Datas Bloqueadas
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                Feriados, férias ou manutenção
              </p>
            </div>
          </div>

          {/* Formulário nova data */}
          <form onSubmit={bloquear} style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{
                  display: "block", color: "var(--text-muted)",
                  fontSize: "11px", fontWeight: "700",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: "8px",
                }}>Data</label>
                <input
                  type="date"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  required
                  className="conf-input"
                />
              </div>
              <div>
                <label style={{
                  display: "block", color: "var(--text-muted)",
                  fontSize: "11px", fontWeight: "700",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: "8px",
                }}>Motivo</label>
                <input
                  type="text"
                  placeholder="Ex: Feriado"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="conf-input"
                />
              </div>
            </div>

            {erroBloquear && (
              <div style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.12)",
                borderLeft: "3px solid rgba(239,68,68,0.6)",
                borderRadius: "12px", padding: "10px 14px",
                color: "#FCA5A5", fontSize: "13px", fontWeight: "600",
              }}>
                {erroBloquear}
              </div>
            )}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "4px" }}>
              <button
                type="submit"
                disabled={bloqueando}
                className="conf-submit-red"
              >
                <Plus size={16} />
                {bloqueando ? "Bloqueando..." : "Bloquear Data"}
              </button>
            </div>
          </form>

          {/* Separador */}
          {datasBloqueadas.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
              <p style={{
                color: "var(--text-muted)", fontSize: "11px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px",
              }}>
                {datasBloqueadas.length} data{datasBloqueadas.length !== 1 ? "s" : ""} bloqueada{datasBloqueadas.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          {/* Lista */}
          {datasBloqueadas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 10px",
              }}>
                <Ban size={20} color="#EF444460" />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                Nenhuma data bloqueada.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {datasBloqueadas.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    gap: "12px",
                    background: "rgba(239,68,68,0.05)",
                    border: "1px solid rgba(239,68,68,0.1)",
                    borderLeft: "3px solid rgba(239,68,68,0.5)",
                    borderRadius: "12px", padding: "12px 14px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: "700" }}>
                      {formatarData(d.blocked_date)}
                    </p>
                    {d.reason && (
                      <p style={{
                        color: "var(--text-muted)", fontSize: "11px", marginTop: "2px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{d.reason}</p>
                    )}
                  </div>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "8px",
                    background: "rgba(239,68,68,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Ban size={14} color="#EF4444" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
