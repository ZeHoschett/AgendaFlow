"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Plus, Shuffle, Clock, Shield, ShoppingBag, Zap, CreditCard, Banknote, ArrowLeft, MapPin, MessageCircle } from "lucide-react";
import api from "@/lib/api";

interface Servico { id: string; name: string; price: number; description: string; category?: string; }
interface Profissional { id: string; full_name: string; phone: string; }
interface Slot { time: string; period: string; available: boolean; alternative_professionals: { id: string; name: string }[]; }
interface Produto { id: string; name: string; price: number; description: string; category?: string; }
interface TenantTheme { name: string; cor_primaria: string; cor_secundaria: string; titulo_profissional: string; tema?: string; }
interface ConfigPublica { opening_time: string; closing_time: string; working_days: string; address: string; responsible_whatsapp: string; }

type Etapa = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default function AgendarPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [tema, setTema] = useState<TenantTheme | null>(null);
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [configPublica, setConfigPublica] = useState<ConfigPublica | null>(null);

  const [servicosSelecionados, setServicosSelecionados] = useState<Servico[]>([]);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<Profissional | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState("");
  const [horarioSelecionado, setHorarioSelecionado] = useState("");
  const [produtosSelecionados, setProdutosSelecionados] = useState<Produto[]>([]);
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [slots, setSlots] = useState<{ manha: Slot[]; tarde: Slot[]; noite: Slot[] }>({ manha: [], tarde: [], noite: [] });
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [todosProdutos, setTodosProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(false);

  const servicoPrincipal = servicosSelecionados[0] ?? null;

  useEffect(() => {
    document.documentElement.className = "theme-dark";
    api.get(`/tenants/${slug}/theme`).then((r) => setTema(r.data)).catch(() => {});
    api.get(`/config/${slug}/public`).then((r) => setConfigPublica(r.data)).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (etapa === 1) {
      setCarregando(true);
      api.get(`/services/${slug}`).then((r) => setServicos(r.data)).finally(() => setCarregando(false));
    }
  }, [etapa]);

  useEffect(() => {
    if (etapa === 2) {
      setCarregando(true);
      api.get(`/professionals/${slug}`).then((r) => setProfissionais(r.data)).finally(() => setCarregando(false));
    }
  }, [etapa]);

  useEffect(() => {
    if (etapa === 4 && dataSelecionada && profissionalSelecionado) {
      setCarregando(true);
      api.get(`/appointments/slots/${slug}/${profissionalSelecionado.id}/${dataSelecionada}`)
        .then((r) => setSlots(r.data)).finally(() => setCarregando(false));
    }
  }, [etapa, dataSelecionada]);

  useEffect(() => {
    if (etapa === 5 && servicoPrincipal) {
      Promise.all([
        api.get(`/products/${slug}`),
        api.get(`/services/${slug}/${servicoPrincipal.id}/products`),
      ]).then(([todosR, vinculadosR]) => {
        setTodosProdutos(todosR.data);
        setProdutos(vinculadosR.data);
      }).catch(() => { setTodosProdutos([]); setProdutos([]); });
    }
  }, [etapa]);

  const corP = tema?.cor_primaria || "#2D7EF8";
  const corS = tema?.cor_secundaria || "#10B981";

  function moeda(v: number) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function slotPassado(slotTime: string): boolean {
    if (dataSelecionada !== hoje) return false;
    const agora = new Date();
    const [horaSlot, minSlot] = slotTime.split(":").map(Number);
    return (horaSlot * 60 + minSlot) <= (agora.getHours() * 60 + agora.getMinutes());
  }

  function toggleServico(s: Servico) {
    setServicosSelecionados((prev) =>
      prev.find((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]
    );
  }

  function toggleProduto(produto: Produto) {
    setProdutosSelecionados((prev) =>
      prev.find((p) => p.id === produto.id) ? prev.filter((p) => p.id !== produto.id) : [...prev, produto]
    );
  }

  function agruparPorCategoria<T extends { category?: string }>(lista: T[]): [string, T[]][] {
    const mapa = new Map<string, T[]>();
    for (const item of lista) {
      const cat = item.category || "Geral";
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(item);
    }
    return Array.from(mapa.entries());
  }

  async function confirmarAgendamento() {
    if (!servicoPrincipal) return;
    setCarregando(true);
    try {
      await api.post(`/appointments/${slug}`, {
        client_name: nomeCliente,
        client_phone: telefoneCliente.replace(/\D/g, ""),
        professional_id: profissionalSelecionado!.id,
        service_id: servicoPrincipal.id,
        service_ids: servicosSelecionados.slice(1).map((s) => s.id),
        scheduled_date: dataSelecionada,
        scheduled_time: horarioSelecionado + ":00",
        product_ids: produtosSelecionados.map((p) => p.id),
      });
      setEtapa(7);
    } catch {
      alert("Erro ao confirmar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  const hoje = new Date().toISOString().split("T")[0];
  const titulos = [
    "", "Serviços",
    tema?.titulo_profissional || "Profissional",
    "Data", "Horário",
    "Produtos", "Confirmação", "",
  ];

  const totalDisponiveis = [...slots.manha, ...slots.tarde, ...slots.noite]
    .filter((s) => s.available && !slotPassado(s.time)).length;
  const totalServicos = servicosSelecionados.reduce((acc, s) => acc + s.price, 0);
  const totalGeral = totalServicos + produtosSelecionados.reduce((acc, p) => acc + p.price, 0);

  // Progresso da barra (etapas 1–6; etapa 7 = completo)
  const progresso = etapa >= 7 ? 100 : Math.round(((etapa - 1) / 6) * 100);

  return (
    <div style={{
      minHeight: "100vh", background: "#080C14",
      fontFamily: "Inter, sans-serif",
      position: "relative",
    }}>

      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: scale(1) translate(0,0); opacity: 0.4; }
          50% { transform: scale(1.2) translate(3%,2%); opacity: 0.7; }
        }
        @keyframes orb2 {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.15); opacity: 0.5; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(300%)  skewX(-12deg); }
        }
        @keyframes pulse-success {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.45); }
          60% { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        .etapa { animation: fadeUp 0.35s ease forwards; }

        /* Botão CTA com shimmer */
        .btn-cta {
          position: relative; overflow: hidden;
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .btn-cta::after {
          content: "";
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: translateX(-150%) skewX(-12deg);
          animation: shimmer 3s ease-in-out infinite 1s;
        }
        .btn-cta:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 16px 48px ${corP}55 !important;
        }
        .btn-cta:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Cards clicáveis */
        .opcao-card { transition: all 0.22s ease; cursor: pointer; }
        .opcao-card:hover {
          border-color: ${corP}70 !important;
          background: ${corP}0D !important;
          transform: translateY(-2px);
          box-shadow: 0 12px 32px ${corP}18 !important;
        }

        /* Slots de horário */
        .slot-btn { transition: all 0.15s ease; cursor: pointer; }
        .slot-btn:hover:not(:disabled) {
          border-color: ${corP}88 !important;
          background: ${corP}14 !important;
        }
        .slot-ativo {
          background: ${corP}22 !important;
          border-color: ${corP} !important;
          box-shadow: 0 0 16px ${corP}33;
        }

        /* Produto */
        .produto-card { transition: all 0.22s ease; }
        .produto-card:hover { border-color: ${corP}55 !important; transform: translateY(-1px); }
        .produto-ativo {
          border-color: ${corP} !important;
          background: ${corP}10 !important;
          box-shadow: 0 8px 28px ${corP}20;
        }

        /* Input focus */
        .input-agendar {
          width: 100%; padding: 13px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; color: #F0F4FF;
          font-size: 15px; font-family: Inter, sans-serif;
          outline: none; transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .input-agendar:focus {
          border-color: ${corP}80;
          box-shadow: 0 0 0 3px ${corP}18;
        }

        /* Ícone de sucesso pulsante */
        .success-ring { animation: pulse-success 2s ease-in-out infinite; }
        .success-check { animation: scale-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      {/* ── Fundo premium ── */}
      <div style={{
        position: "fixed", top: "-25%", left: "-15%",
        width: "600px", height: "600px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corP}22 0%, transparent 70%)`,
        animation: "orb1 12s ease-in-out infinite", pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-25%", right: "-15%",
        width: "700px", height: "700px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corS}18 0%, transparent 70%)`,
        animation: "orb2 15s ease-in-out infinite", pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
        width: "900px", height: "900px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corP}07 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "28px 28px", pointerEvents: "none",
      }} />

      {/* ── Header sticky — fora do container para cobrir 100% da largura ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(8,12,20,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px 20px 14px" }}>
          {/* Barra de progresso */}
          <div style={{
            height: "3px", borderRadius: "999px",
            background: "rgba(255,255,255,0.06)",
            marginBottom: "14px", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${progresso}%`,
              background: `linear-gradient(90deg, ${corP}, ${corS})`,
              borderRadius: "999px",
              transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
              boxShadow: `0 0 8px ${corP}66`,
            }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {etapa > 1 && etapa < 7 && (
              <button
                onClick={() => setEtapa((etapa - 1) as Etapa)}
                style={{
                  width: "36px", height: "36px", flexShrink: 0,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <ArrowLeft size={16} color="#8B95A8" />
              </button>
            )}
            <div style={{ flex: 1 }}>
              <p style={{ color: "#F0F4FF", fontSize: "17px", fontWeight: "800", letterSpacing: "-0.3px" }}>
                {etapa < 7 ? titulos[etapa] : "Confirmado!"}
              </p>
              <p style={{ color: "#374151", fontSize: "11px", fontWeight: "600", marginTop: "1px" }}>
                {etapa < 7 ? `Passo ${etapa} de 6` : tema?.name}
              </p>
            </div>
            {etapa < 7 && (
              <span style={{
                background: `${corP}18`,
                border: `1px solid ${corP}30`,
                borderRadius: "999px", padding: "4px 10px",
                fontSize: "11px", fontWeight: "700", color: corP,
              }}>
                {progresso}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Container ── */}
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "8px 20px 120px", position: "relative", zIndex: 1 }}>

        {/* ══════════════════════════════════════════
            ETAPA 1 — Serviços
        ══════════════════════════════════════════ */}
        {etapa === 1 && (
          <div className="etapa" style={{ display: "flex", flexDirection: "column" }}>
            {carregando ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#374151", fontSize: "14px" }}>
                Carregando serviços...
              </div>
            ) : (
              agruparPorCategoria(servicos).map(([cat, lista]) => (
                <div key={cat}>
                  {/* Cabeçalho de categoria */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "20px 0 10px",
                  }}>
                    <div style={{
                      width: "3px", height: "14px", borderRadius: "999px",
                      background: `linear-gradient(180deg, ${corP}, ${corS})`,
                      flexShrink: 0,
                    }} />
                    <p style={{
                      color: "#4B5568", fontSize: "11px", fontWeight: "700",
                      textTransform: "uppercase", letterSpacing: "0.12em",
                    }}>
                      {cat}
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {lista.map((s) => {
                      const sel = !!servicosSelecionados.find((x) => x.id === s.id);
                      return (
                        <div
                          key={s.id}
                          className="opcao-card"
                          onClick={() => toggleServico(s)}
                          style={{
                            background: sel ? `${corP}0E` : "rgba(255,255,255,0.03)",
                            border: `1px solid ${sel ? corP : "rgba(255,255,255,0.07)"}`,
                            borderRadius: "18px", padding: "16px 18px",
                            display: "flex", alignItems: "center", gap: "14px",
                            boxShadow: sel ? `0 4px 20px ${corP}20` : "none",
                          }}
                        >
                          {/* Checkmark */}
                          <div style={{
                            width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0,
                            background: sel ? `linear-gradient(135deg, ${corP}, ${corS})` : "transparent",
                            border: `2px solid ${sel ? "transparent" : "rgba(255,255,255,0.15)"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease",
                            boxShadow: sel ? `0 4px 12px ${corP}44` : "none",
                          }}>
                            {sel && <Check size={13} color="white" strokeWidth={3} />}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: "#F0F4FF", fontSize: "15px", fontWeight: "700", marginBottom: "3px" }}>
                              {s.name}
                            </p>
                            {s.description && (
                              <p style={{ color: "#4B5568", fontSize: "12px", marginBottom: "8px", lineHeight: "1.4" }}>
                                {s.description}
                              </p>
                            )}
                            <span style={{
                              display: "inline-block",
                              color: "#10B981", fontSize: "13px", fontWeight: "700",
                              background: "rgba(16,185,129,0.12)",
                              border: "1px solid rgba(16,185,129,0.25)",
                              borderRadius: "999px", padding: "3px 12px",
                            }}>
                              {moeda(s.price)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            ETAPA 2 — Profissionais
        ══════════════════════════════════════════ */}
        {etapa === 2 && (
          <div className="etapa" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {carregando ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#374151", fontSize: "14px" }}>
                Carregando...
              </div>
            ) : (
              <>
                {/* Sem preferência */}
                {profissionais.length > 0 && (
                  <div
                    className="opcao-card"
                    onClick={() => { setProfissionalSelecionado(profissionais[0]); setEtapa(3); }}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "18px", padding: "18px 20px",
                      display: "flex", alignItems: "center", gap: "16px",
                    }}
                  >
                    <div style={{
                      width: "56px", height: "56px", borderRadius: "16px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Shuffle size={22} color="#4B5568" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#F0F4FF", fontSize: "15px", fontWeight: "700", marginBottom: "3px" }}>
                        Sem preferência
                      </p>
                      <p style={{ color: "#374151", fontSize: "12px" }}>Primeiro disponível</p>
                    </div>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "50%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <ArrowLeft size={13} color="#4B5568" style={{ transform: "rotate(180deg)" }} />
                    </div>
                  </div>
                )}

                {/* Lista de profissionais */}
                {profissionais.map((p, i) => {
                  const gradientes = [
                    "linear-gradient(145deg, #2D7EF8, #1A5FCC)",
                    "linear-gradient(145deg, #10B981, #059669)",
                    "linear-gradient(145deg, #7C3AED, #5B21B6)",
                    "linear-gradient(145deg, #f4bb11, #d4a010)",
                  ];
                  const grad = gradientes[i % gradientes.length];
                  const glowColors = ["rgba(45,126,248,0.4)", "rgba(16,185,129,0.4)", "rgba(124,58,237,0.4)", "rgba(244,187,17,0.4)"];
                  return (
                    <div
                      key={p.id}
                      className="opcao-card"
                      onClick={() => { setProfissionalSelecionado(p); setEtapa(3); }}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "18px", padding: "18px 20px",
                        display: "flex", alignItems: "center", gap: "16px",
                      }}
                    >
                      <div style={{
                        width: "56px", height: "56px", borderRadius: "16px",
                        background: grad,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "20px", fontWeight: "900", color: "white", flexShrink: 0,
                        boxShadow: `0 8px 24px ${glowColors[i % glowColors.length]}, inset 0 1px 0 rgba(255,255,255,0.2)`,
                      }}>
                        {p.full_name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "#F0F4FF", fontSize: "15px", fontWeight: "700", marginBottom: "3px" }}>
                          {p.full_name}
                        </p>
                        <p style={{ color: "#374151", fontSize: "12px" }}>
                          {tema?.titulo_profissional || "Profissional"}
                        </p>
                      </div>
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "50%",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <ArrowLeft size={13} color="#4B5568" style={{ transform: "rotate(180deg)" }} />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            ETAPA 3 — Data
        ══════════════════════════════════════════ */}
        {etapa === 3 && (
          <div className="etapa" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Card do input de data */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "20px", padding: "20px",
            }}>
              <p style={{
                color: "#4B5568", fontSize: "11px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px",
              }}>
                Selecione uma data
              </p>
              <input
                type="date"
                min={hoje}
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="input-agendar"
              />
            </div>

            <button
              className="btn-cta"
              onClick={() => { if (dataSelecionada) setEtapa(4); }}
              disabled={!dataSelecionada}
              style={{
                width: "100%", padding: "16px",
                background: dataSelecionada ? `linear-gradient(135deg, ${corP}, ${corS})` : "rgba(255,255,255,0.04)",
                border: "none", borderRadius: "16px",
                color: dataSelecionada ? "white" : "#374151",
                fontSize: "15px", fontWeight: "700",
                fontFamily: "Inter, sans-serif",
                boxShadow: dataSelecionada ? `0 10px 32px ${corP}40` : "none",
              }}
            >
              Continuar →
            </button>

            {/* Cards informativos */}
            {(() => {
              const NOMES_DIA: Record<string, string> = { "0": "Dom", "1": "Seg", "2": "Ter", "3": "Qua", "4": "Qui", "5": "Sex", "6": "Sáb" };
              const dias = configPublica?.working_days
                ? configPublica.working_days.split(",").map((d) => NOMES_DIA[d.trim()] || d).join(", ")
                : "Seg a Sex";
              const abertura  = configPublica?.opening_time?.slice(0, 5).replace(":", "h") || "08h";
              const fechamento = configPublica?.closing_time?.slice(0, 5).replace(":", "h") || "20h";
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <div style={{
                    background: "rgba(45,126,248,0.06)",
                    border: "1px solid rgba(45,126,248,0.12)",
                    borderRadius: "14px", padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: "12px",
                  }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "10px",
                      background: "rgba(45,126,248,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Clock size={16} color="#2D7EF8" />
                    </div>
                    <p style={{ color: "#8B95A8", fontSize: "13px", lineHeight: "1.45" }}>
                      Atendemos <strong style={{ color: "#F0F4FF" }}>{dias}</strong> das <strong style={{ color: "#F0F4FF" }}>{abertura}</strong> às <strong style={{ color: "#F0F4FF" }}>{fechamento}</strong>
                    </p>
                  </div>

                  <div style={{
                    background: "rgba(16,185,129,0.06)",
                    border: "1px solid rgba(16,185,129,0.12)",
                    borderRadius: "14px", padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: "12px",
                  }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "10px",
                      background: "rgba(16,185,129,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Shield size={16} color="#10B981" />
                    </div>
                    <div>
                      <p style={{ color: "#F0F4FF", fontSize: "13px", fontWeight: "700", marginBottom: "2px" }}>
                        Cancelamento gratuito
                      </p>
                      <p style={{ color: "#4B5568", fontSize: "12px" }}>
                        Avise com pelo menos 24h de antecedência
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════
            ETAPA 4 — Horários
        ══════════════════════════════════════════ */}
        {etapa === 4 && (
          <div className="etapa" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {carregando ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#374151", fontSize: "14px" }}>
                Carregando horários...
              </div>
            ) : (
              <>
                {/* Resumo do dia */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "14px", padding: "12px 16px",
                }}>
                  <p style={{ color: "#8B95A8", fontSize: "13px" }}>
                    <strong style={{ color: "#F0F4FF" }}>{totalDisponiveis}</strong> vaga{totalDisponiveis !== 1 ? "s" : ""} disponíve{totalDisponiveis !== 1 ? "is" : "l"}
                  </p>
                  {totalDisponiveis > 0 && totalDisponiveis <= 3 && (
                    <span style={{
                      background: "rgba(239,68,68,0.12)",
                      border: "1px solid rgba(239,68,68,0.22)",
                      borderRadius: "999px", padding: "3px 10px",
                      color: "#FCA5A5", fontSize: "11px", fontWeight: "700",
                    }}>
                      Últimas vagas
                    </span>
                  )}
                </div>

                {(["manha", "tarde", "noite"] as const).map((periodo) => {
                  const lista = slots[periodo];
                  if (!lista.length) return null;
                  const labels: Record<string, { emoji: string; nome: string }> = {
                    manha: { emoji: "☀️", nome: "Manhã" },
                    tarde: { emoji: "🌤️", nome: "Tarde" },
                    noite: { emoji: "🌙", nome: "Noite" },
                  };
                  const disponivelsPeriodo = lista.filter((s) => s.available && !slotPassado(s.time)).length;
                  if (lista.every((s) => !s.available || slotPassado(s.time))) return null;
                  return (
                    <div key={periodo}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px",
                      }}>
                        <span style={{ fontSize: "16px" }}>{labels[periodo].emoji}</span>
                        <p style={{
                          color: "#F0F4FF", fontSize: "13px", fontWeight: "800",
                          textTransform: "uppercase", letterSpacing: "0.1em",
                        }}>
                          {labels[periodo].nome}
                        </p>
                        {disponivelsPeriodo > 0 && disponivelsPeriodo <= 3 && (
                          <span style={{
                            background: "rgba(239,68,68,0.12)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: "999px", padding: "2px 8px",
                            color: "#FCA5A5", fontSize: "10px", fontWeight: "700",
                          }}>
                            Últimas vagas
                          </span>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                        {lista.map((slot) => {
                          const bloqueado = !slot.available || slotPassado(slot.time);
                          const ativo = horarioSelecionado === slot.time;
                          return (
                            <button
                              key={slot.time}
                              className={`slot-btn ${ativo ? "slot-ativo" : ""}`}
                              disabled={bloqueado}
                              onClick={() => { if (!bloqueado) setHorarioSelecionado(slot.time); }}
                              style={{
                                padding: "14px 8px",
                                background: ativo ? `${corP}22` : "rgba(255,255,255,0.03)",
                                border: `1px solid ${ativo ? corP : "rgba(255,255,255,0.07)"}`,
                                borderRadius: "14px",
                                color: bloqueado ? "#1F2937" : "#F0F4FF",
                                fontSize: "15px", fontWeight: "700",
                                fontFamily: "Inter, sans-serif",
                                opacity: bloqueado ? 0.35 : 1,
                                cursor: bloqueado ? "not-allowed" : "pointer",
                              }}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <button
                  className="btn-cta"
                  onClick={() => { if (horarioSelecionado) setEtapa(5); }}
                  disabled={!horarioSelecionado}
                  style={{
                    width: "100%", padding: "16px",
                    background: horarioSelecionado ? `linear-gradient(135deg, ${corP}, ${corS})` : "rgba(255,255,255,0.04)",
                    border: "none", borderRadius: "16px",
                    color: horarioSelecionado ? "white" : "#374151",
                    fontSize: "15px", fontWeight: "700",
                    fontFamily: "Inter, sans-serif",
                    boxShadow: horarioSelecionado ? `0 10px 32px ${corP}40` : "none",
                  }}
                >
                  Continuar →
                </button>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            ETAPA 5 — Upsell / Produtos
        ══════════════════════════════════════════ */}
        {etapa === 5 && (() => {
          const vinculadosIds = new Set(produtos.map((p) => p.id));
          const outrosProdutos = todosProdutos.filter((p) => !vinculadosIds.has(p.id));
          const temQualquerProduto = produtos.length > 0 || outrosProdutos.length > 0;
          const gruposOutros = agruparPorCategoria(outrosProdutos);

          function CardProduto({ p, recomendado }: { p: Produto; recomendado: boolean }) {
            const sel = !!produtosSelecionados.find((ps) => ps.id === p.id);
            return (
              <div
                className={`produto-card ${sel ? "produto-ativo" : ""}`}
                style={{
                  background: sel ? `${corP}0C` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${sel ? corP : "rgba(255,255,255,0.07)"}`,
                  borderRadius: "18px", padding: "16px",
                  display: "flex", flexDirection: "column", gap: "10px",
                }}
              >
                {recomendado && (
                  <span style={{
                    background: "rgba(244,187,17,0.1)",
                    border: "1px solid rgba(244,187,17,0.2)",
                    color: "var(--color-warning-dim)", fontSize: "10px", fontWeight: "700",
                    padding: "3px 10px", borderRadius: "999px",
                    alignSelf: "flex-start",
                  }}>
                    ⭐ Recomendado para esse serviço
                  </span>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: "56px", height: "56px", borderRadius: "14px",
                    background: `linear-gradient(135deg, ${corP}20, ${corS}18)`,
                    border: `1px solid ${corP}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <ShoppingBag size={24} color={corP} strokeWidth={1.5} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#F0F4FF", fontSize: "15px", fontWeight: "700", marginBottom: "3px" }}>
                      {p.name}
                    </p>
                    {p.description && (
                      <p style={{ color: "#374151", fontSize: "12px", marginBottom: "6px", lineHeight: "1.4" }}>
                        {p.description}
                      </p>
                    )}
                    <span style={{
                      color: "#10B981", background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.22)",
                      borderRadius: "999px", padding: "3px 12px",
                      display: "inline-block", fontSize: "13px", fontWeight: "700",
                    }}>
                      {moeda(p.price)}
                    </span>
                  </div>

                  <button
                    onClick={() => toggleProduto(p)}
                    style={{
                      padding: "8px 14px",
                      background: sel ? "rgba(16,185,129,0.12)" : `linear-gradient(135deg, ${corP}, ${corS})`,
                      border: sel ? "1px solid rgba(16,185,129,0.25)" : "none",
                      borderRadius: "10px",
                      color: sel ? "#10B981" : "white",
                      fontSize: "12px", fontWeight: "700",
                      cursor: "pointer", flexShrink: 0,
                      fontFamily: "Inter, sans-serif",
                      transition: "all 0.2s ease",
                      display: "flex", alignItems: "center", gap: "4px",
                    }}
                  >
                    {sel ? <><Check size={12} strokeWidth={3} /> Adicionado</> : <><Plus size={12} strokeWidth={3} /> Adicionar</>}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="etapa" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {!temQualquerProduto ? (
                <div style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "20px", padding: "36px 20px", textAlign: "center",
                }}>
                  <p style={{ color: "#374151", fontSize: "14px", marginBottom: "20px" }}>
                    Nenhum produto disponível no momento.
                  </p>
                  <button
                    className="btn-cta"
                    onClick={() => setEtapa(6)}
                    style={{
                      width: "100%", padding: "15px",
                      background: `linear-gradient(135deg, ${corP}, ${corS})`,
                      border: "none", borderRadius: "14px",
                      color: "white", fontSize: "15px", fontWeight: "700",
                      cursor: "pointer", fontFamily: "Inter, sans-serif",
                      boxShadow: `0 10px 32px ${corP}40`,
                    }}
                  >Continuar</button>
                </div>
              ) : (
                <>
                  {produtos.length > 0 && (
                    <>
                      <p style={{
                        color: "#8B95A8", fontSize: "13px", fontWeight: "600",
                        textAlign: "center", lineHeight: "1.5", marginBottom: "4px",
                      }}>
                        Clientes que agendaram também levaram 👇
                      </p>
                      {produtos.map((p) => <CardProduto key={p.id} p={p} recomendado={true} />)}
                    </>
                  )}

                  {outrosProdutos.length > 0 && (
                    <>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        margin: produtos.length > 0 ? "8px 0 4px" : "0 0 4px",
                      }}>
                        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
                        <p style={{ color: "#374151", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" }}>
                          Outros produtos do estabelecimento
                        </p>
                        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
                      </div>
                      {gruposOutros.map(([cat, lista]) => (
                        <div key={cat}>
                          {gruposOutros.length > 1 && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: "8px", padding: "8px 0 6px",
                            }}>
                              <div style={{ width: "3px", height: "12px", borderRadius: "999px", background: `linear-gradient(180deg, ${corP}, ${corS})` }} />
                              <p style={{ color: "#4B5568", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                {cat}
                              </p>
                            </div>
                          )}
                          {lista.map((p) => <CardProduto key={p.id} p={p} recomendado={false} />)}
                        </div>
                      ))}
                    </>
                  )}

                  <button
                    className="btn-cta"
                    onClick={() => setEtapa(6)}
                    style={{
                      width: "100%", padding: "16px",
                      background: `linear-gradient(135deg, ${corP}, ${corS})`,
                      border: "none", borderRadius: "16px",
                      color: "white", fontSize: "15px", fontWeight: "700",
                      cursor: "pointer", fontFamily: "Inter, sans-serif",
                      marginTop: "4px",
                      boxShadow: `0 10px 32px ${corP}40`,
                    }}
                  >
                    {produtosSelecionados.length > 0
                      ? `Continuar com ${produtosSelecionados.length} produto${produtosSelecionados.length > 1 ? "s" : ""}`
                      : "Continuar sem produtos"}
                  </button>
                </>
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════
            ETAPA 6 — Dados + Resumo
        ══════════════════════════════════════════ */}
        {etapa === 6 && (
          <div className="etapa" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* Resumo */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "20px", padding: "20px",
            }}>
              <p style={{
                color: "#4B5568", fontSize: "11px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px",
              }}>
                Resumo do agendamento
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {servicosSelecionados.map((s) => (
                  <div key={s.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{
                        background: "rgba(45,126,248,0.12)", color: "#93C5FD",
                        fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px",
                      }}>Serviço</span>
                      <p style={{ color: "#8B95A8", fontSize: "13px", fontWeight: "600" }}>{s.name}</p>
                    </div>
                    <p style={{ color: "#F0F4FF", fontSize: "13px", fontWeight: "600" }}>{moeda(s.price)}</p>
                  </div>
                ))}
                {produtosSelecionados.map((prod) => (
                  <div key={prod.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{
                        background: "rgba(16,185,129,0.12)", color: "#6EE7B7",
                        fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px",
                      }}>Produto</span>
                      <p style={{ color: "#8B95A8", fontSize: "13px", fontWeight: "600" }}>{prod.name}</p>
                    </div>
                    <p style={{ color: "#F0F4FF", fontSize: "13px", fontWeight: "600" }}>{moeda(prod.price)}</p>
                  </div>
                ))}
                {[
                  { label: tema?.titulo_profissional || "Profissional", valor: profissionalSelecionado?.full_name },
                  { label: "Data",    valor: dataSelecionada.split("-").reverse().join("/") },
                  { label: "Horário", valor: horarioSelecionado },
                ].map((item) => (
                  <div key={item.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <p style={{ color: "#4B5568", fontSize: "13px", fontWeight: "600" }}>{item.label}</p>
                    <p style={{ color: "#F0F4FF", fontSize: "13px", fontWeight: "600" }}>{item.valor}</p>
                  </div>
                ))}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  paddingTop: "14px", marginTop: "2px",
                }}>
                  <p style={{ color: "#F0F4FF", fontSize: "14px", fontWeight: "700" }}>Total</p>
                  <p style={{ color: "#10B981", fontSize: "18px", fontWeight: "900" }}>{moeda(totalGeral)}</p>
                </div>
              </div>
            </div>

            {/* Dados do cliente */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "20px", padding: "20px",
            }}>
              <p style={{
                color: "#4B5568", fontSize: "11px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px",
              }}>
                Seus dados
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{
                    display: "block", fontSize: "11px", fontWeight: "700",
                    color: "#4B5568", textTransform: "uppercase",
                    letterSpacing: "0.08em", marginBottom: "8px",
                  }}>
                    Nome completo
                  </label>
                  <input
                    className="input-agendar"
                    type="text"
                    placeholder="João Silva"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{
                    display: "block", fontSize: "11px", fontWeight: "700",
                    color: "#4B5568", textTransform: "uppercase",
                    letterSpacing: "0.08em", marginBottom: "8px",
                  }}>
                    WhatsApp
                  </label>
                  <input
                    className="input-agendar"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={telefoneCliente}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let formatted = digits;
                      if (digits.length > 6) formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                      else if (digits.length > 2) formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                      else if (digits.length > 0) formatted = `(${digits}`;
                      setTelefoneCliente(formatted);
                    }}
                    required
                  />
                  <p style={{ color: "#374151", fontSize: "11px", marginTop: "6px" }}>
                    Usado para confirmação via WhatsApp
                  </p>
                </div>
              </div>
            </div>

            <button
              className="btn-cta"
              onClick={confirmarAgendamento}
              disabled={!nomeCliente || !telefoneCliente || carregando || servicosSelecionados.length === 0}
              style={{
                width: "100%", padding: "18px",
                background: nomeCliente && telefoneCliente
                  ? `linear-gradient(135deg, ${corP}, ${corS})`
                  : "rgba(255,255,255,0.04)",
                border: "none", borderRadius: "16px",
                color: nomeCliente && telefoneCliente ? "white" : "#374151",
                fontSize: "16px", fontWeight: "800",
                fontFamily: "Inter, sans-serif",
                boxShadow: nomeCliente && telefoneCliente ? `0 12px 40px ${corP}44` : "none",
                opacity: carregando ? 0.7 : 1,
              }}
            >
              {carregando ? "Confirmando..." : "Confirmar Agendamento →"}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            ETAPA 7 — Confirmação / Sucesso
        ══════════════════════════════════════════ */}
        {etapa === 7 && (
          <div className="etapa" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Hero de sucesso */}
            <div style={{
              textAlign: "center", padding: "36px 20px 24px",
              background: "rgba(16,185,129,0.04)",
              border: "1px solid rgba(16,185,129,0.12)",
              borderRadius: "24px",
            }}>
              <div
                className="success-ring"
                style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))",
                  border: "2px solid rgba(16,185,129,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <div className="success-check">
                  <Check size={36} color="#10B981" strokeWidth={2.5} />
                </div>
              </div>
              <p style={{ color: "#10B981", fontSize: "22px", fontWeight: "900", marginBottom: "6px", letterSpacing: "-0.3px" }}>
                Agendado com sucesso!
              </p>
              <p style={{ color: "#4B5568", fontSize: "13px", lineHeight: "1.5" }}>
                Seu atendimento está confirmado em <strong style={{ color: "#8B95A8" }}>{tema?.name}</strong>
              </p>
            </div>

            {/* Detalhes do agendamento */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "20px", padding: "20px",
            }}>
              <p style={{
                color: "#4B5568", fontSize: "11px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px",
              }}>
                Detalhes
              </p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {[
                  { label: "Cliente",  valor: nomeCliente },
                  { label: tema?.titulo_profissional || "Profissional", valor: profissionalSelecionado?.full_name },
                  { label: "Data",     valor: dataSelecionada.split("-").reverse().join("/") },
                  { label: "Horário",  valor: horarioSelecionado },
                ].map((item) => (
                  <div key={item.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <p style={{ color: "#4B5568", fontSize: "13px", fontWeight: "600" }}>{item.label}</p>
                    <p style={{ color: "#F0F4FF", fontSize: "13px", fontWeight: "700" }}>{item.valor}</p>
                  </div>
                ))}
                {servicosSelecionados.map((s) => (
                  <div key={s.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <span style={{
                        background: "rgba(45,126,248,0.12)", color: "#93C5FD",
                        fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "999px",
                      }}>Serviço</span>
                      <p style={{ color: "#8B95A8", fontSize: "13px", fontWeight: "600" }}>{s.name}</p>
                    </div>
                    <p style={{ color: "#F0F4FF", fontSize: "13px", fontWeight: "600" }}>{moeda(s.price)}</p>
                  </div>
                ))}
                {produtosSelecionados.map((prod) => (
                  <div key={prod.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <span style={{
                        background: "rgba(16,185,129,0.12)", color: "#6EE7B7",
                        fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "999px",
                      }}>Produto</span>
                      <p style={{ color: "#8B95A8", fontSize: "13px", fontWeight: "600" }}>{prod.name}</p>
                    </div>
                    <p style={{ color: "#F0F4FF", fontSize: "13px", fontWeight: "600" }}>{moeda(prod.price)}</p>
                  </div>
                ))}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  paddingTop: "14px",
                }}>
                  <p style={{ color: "#F0F4FF", fontSize: "14px", fontWeight: "700" }}>Total</p>
                  <p style={{ color: "#10B981", fontSize: "18px", fontWeight: "900" }}>{moeda(totalGeral)}</p>
                </div>
              </div>
            </div>

            {/* Ações rápidas */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {configPublica?.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(configPublica.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    width: "100%", padding: "14px",
                    background: "rgba(45,126,248,0.08)",
                    border: "1px solid rgba(45,126,248,0.18)",
                    borderRadius: "14px", color: "#93C5FD",
                    fontSize: "14px", fontWeight: "700",
                    fontFamily: "Inter, sans-serif",
                    textDecoration: "none", boxSizing: "border-box",
                    transition: "all 0.2s",
                  }}
                >
                  <MapPin size={15} /> Ver no Maps
                </a>
              )}
              {profissionalSelecionado?.phone && (
                <a
                  href={`https://wa.me/55${profissionalSelecionado.phone.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    width: "100%", padding: "14px",
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.18)",
                    borderRadius: "14px", color: "#6EE7B7",
                    fontSize: "14px", fontWeight: "700",
                    fontFamily: "Inter, sans-serif",
                    textDecoration: "none", boxSizing: "border-box",
                  }}
                >
                  <MessageCircle size={15} /> Falar com {tema?.titulo_profissional || "Profissional"}
                </a>
              )}
              {configPublica?.responsible_whatsapp && (
                <a
                  href={`https://wa.me/55${configPublica.responsible_whatsapp.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    width: "100%", padding: "14px",
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.18)",
                    borderRadius: "14px", color: "#6EE7B7",
                    fontSize: "14px", fontWeight: "700",
                    fontFamily: "Inter, sans-serif",
                    textDecoration: "none", boxSizing: "border-box",
                  }}
                >
                  <MessageCircle size={15} /> Falar com o Estabelecimento
                </a>
              )}
            </div>

            {/* Formas de pagamento */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "18px", padding: "18px 20px",
            }}>
              <p style={{
                color: "#4B5568", fontSize: "11px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px",
              }}>
                Formas de pagamento aceitas
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <span style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
                  color: "#6EE7B7", fontSize: "12px", fontWeight: "600",
                  padding: "8px 14px", borderRadius: "999px",
                }}>
                  <Zap size={13} strokeWidth={2.5} /> Pix
                </span>
                <span style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "rgba(45,126,248,0.1)", border: "1px solid rgba(45,126,248,0.2)",
                  color: "#93C5FD", fontSize: "12px", fontWeight: "600",
                  padding: "8px 14px", borderRadius: "999px",
                }}>
                  <CreditCard size={13} strokeWidth={2.5} /> Cartão
                </span>
                <span style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "rgba(244,187,17,0.1)", border: "1px solid rgba(244,187,17,0.2)",
                  color: "var(--color-warning-dim)", fontSize: "12px", fontWeight: "600",
                  padding: "8px 14px", borderRadius: "999px",
                }}>
                  <Banknote size={13} strokeWidth={2.5} /> No Local
                </span>
              </div>
            </div>

            <button
              className="btn-cta"
              onClick={() => router.push(`/${slug}`)}
              style={{
                width: "100%", padding: "16px",
                background: `linear-gradient(135deg, ${corP}, ${corS})`,
                border: "none", borderRadius: "16px",
                color: "white", fontSize: "15px", fontWeight: "700",
                cursor: "pointer", fontFamily: "Inter, sans-serif",
                boxShadow: `0 10px 32px ${corP}40`,
              }}
            >
              Voltar ao início
            </button>
          </div>
        )}
      </div>

      {/* ── Barra fixa — só na etapa 1 com serviço selecionado ── */}
      {etapa === 1 && servicosSelecionados.length > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
          background: "rgba(8,12,20,0.95)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "16px 20px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <p style={{ color: "#F0F4FF", fontSize: "13px", fontWeight: "700" }}>
              {servicosSelecionados.length} serviço{servicosSelecionados.length > 1 ? "s" : ""}
            </p>
            <p style={{ color: "#10B981", fontSize: "12px", fontWeight: "700" }}>
              {moeda(totalServicos)}
            </p>
          </div>
          <button
            className="btn-cta"
            onClick={() => setEtapa(2)}
            style={{
              padding: "13px 28px",
              background: `linear-gradient(135deg, ${corP}, ${corS})`,
              border: "none", borderRadius: "14px",
              color: "white", fontSize: "14px", fontWeight: "700",
              cursor: "pointer", fontFamily: "Inter, sans-serif",
              boxShadow: `0 6px 20px ${corP}44`,
            }}
          >
            Continuar →
          </button>
        </div>
      )}
    </div>
  );
}
