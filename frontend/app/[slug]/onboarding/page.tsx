"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronRight, ChevronLeft } from "lucide-react";
import api from "@/lib/api";

interface Respostas {
  segment: string;
  professional_count: string;
  scheduling_mode: string;
  has_products: boolean;
  has_fixed_duration: boolean;
  remuneration_model: string;
  has_commission: boolean;
  commission_rate: number;
  has_goals: boolean;
  has_tips: boolean;
  payment_methods: string[];
  professional_title: string;
  whatsapp_notify: boolean;
  responsible_name: string;
  responsible_whatsapp: string;
  city: string;
  how_found: string;
  monthly_revenue: string;
}

const SEGMENTOS = [
  { valor: "barbearia",          label: "Barbearia",           emoji: "✂️" },
  { valor: "salao",              label: "Salão de Beleza",     emoji: "💇" },
  { valor: "clinica_estetica",   label: "Clínica Estética",    emoji: "✨" },
  { valor: "pilates",            label: "Studio de Pilates",   emoji: "🧘" },
  { valor: "tatuagem",           label: "Estúdio de Tatuagem", emoji: "🎨" },
  { valor: "estetica_automotiva",label: "Estética Automotiva", emoji: "🚗" },
  { valor: "outro",              label: "Outro",               emoji: "📅" },
];

const TITULOS_PROFISSIONAL: Record<string, string[]> = {
  barbearia:           ["Barbeiro", "Barbeira"],
  salao:               ["Cabeleireiro(a)", "Stylist"],
  clinica_estetica:    ["Especialista", "Dr.", "Dra."],
  pilates:             ["Professor(a)", "Instrutor(a)"],
  tatuagem:            ["Tatuador(a)", "Artista"],
  estetica_automotiva: ["Especialista", "Detailer"],
  outro:               ["Profissional", "Especialista", "Atendente"],
};

export default function OnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [passo, setPasso] = useState(1);
  const totalPassos = 5;
  const [salvando, setSalvando] = useState(false);

  const [respostas, setRespostas] = useState<Respostas>({
    segment: "",
    professional_count: "",
    scheduling_mode: "",
    has_products: false,
    has_fixed_duration: true,
    remuneration_model: "",
    has_commission: false,
    commission_rate: 0,
    has_goals: false,
    has_tips: false,
    payment_methods: [],
    professional_title: "",
    whatsapp_notify: false,
    responsible_name: "",
    responsible_whatsapp: "",
    city: "",
    how_found: "",
    monthly_revenue: "",
  });

  function atualizar(campo: keyof Respostas, valor: any) {
    setRespostas((prev) => ({ ...prev, [campo]: valor }));
  }

  function mascararTelefone(valor: string): string {
    const d = valor.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2)  return `(${d}`;
    if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  }

  function togglePayment(metodo: string) {
    setRespostas((prev) => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(metodo)
        ? prev.payment_methods.filter((m) => m !== metodo)
        : [...prev.payment_methods, metodo],
    }));
  }

  function passoValido(): boolean {
    switch (passo) {
      case 1: return !!respostas.segment && !!respostas.professional_count && !!respostas.scheduling_mode;
      case 2: return true;
      case 3: return !!respostas.remuneration_model && respostas.payment_methods.length > 0;
      case 4: return !!respostas.professional_title;
      case 5: return !!respostas.responsible_name && !!respostas.responsible_whatsapp && !!respostas.city && !!respostas.how_found && !!respostas.monthly_revenue;
      default: return false;
    }
  }

  async function finalizar() {
    setSalvando(true);
    try {
      await api.post(`/anamnese/${slug}`, {
        ...respostas,
        payment_methods: respostas.payment_methods.join(","),
        responsible_whatsapp: respostas.responsible_whatsapp.replace(/\D/g, ""),
      });
      router.push(`/${slug}/admin`);
    } catch {
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const titulosProfissional = TITULOS_PROFISSIONAL[respostas.segment] || ["Profissional"];

  const PASSOS_LABELS = ["Negócio", "Serviços", "Financeiro", "Cliente", "Você"];

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-base)",
      fontFamily: "Inter, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "40px 20px 80px",
    }}>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .passo { animation: fadeUp 0.4s ease forwards; }

        /* Botões de opção — seleção exclusiva com descrição */
        .opcao-btn {
          transition: all 0.2s ease;
          cursor: pointer;
          border-radius: 14px !important;
        }
        .opcao-btn:hover {
          border-color: rgba(45,126,248,0.4) !important;
          background: rgba(45,126,248,0.06) !important;
        }
        .opcao-ativo {
          border-color: rgba(45,126,248,0.6) !important;
          border-left: 3px solid #2D7EF8 !important;
          background: rgba(45,126,248,0.1) !important;
          box-shadow: 0 0 16px rgba(45,126,248,0.12);
        }

        /* Botões de toggle — Sim/Não, contagens */
        .toggle-btn {
          transition: all 0.2s ease;
          cursor: pointer;
          border-radius: 14px !important;
        }
        .toggle-btn:hover {
          border-color: rgba(45,126,248,0.4) !important;
          background: rgba(45,126,248,0.06) !important;
        }
        .toggle-ativo {
          border-color: rgba(45,126,248,0.5) !important;
          background: rgba(45,126,248,0.15) !important;
          color: #93C5FD !important;
          font-weight: 700 !important;
          box-shadow: 0 0 12px rgba(45,126,248,0.12);
        }

        /* Label de pergunta */
        .anam-q-label {
          display: block;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .anam-q-sub {
          color: var(--text-muted);
          font-size: 11px;
          margin-bottom: 10px;
          display: block;
        }

        /* Input padrão da anamnese */
        .anam-input {
          width: 100%;
          padding: 13px 14px;
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
        .anam-input:focus {
          border-color: rgba(45,126,248,0.5);
        }

        /* Título com gradiente dentro do card */
        .anam-card-title {
          background: linear-gradient(135deg, #E8F0FF 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.3px;
          margin-bottom: 4px;
        }
        html.theme-light .anam-card-title {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Separador entre seções do mesmo card */
        .anam-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 20px 0;
        }

        /* Botão de navegação principal */
        .anam-btn-next {
          flex: 2;
          padding: 15px;
          border-radius: 16px;
          border: none;
          font-size: 15px;
          font-weight: 700;
          font-family: Inter, sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        .anam-btn-next.ativo {
          background: linear-gradient(135deg, #2D7EF8, #10B981);
          color: white;
          box-shadow: 0 8px 24px rgba(45,126,248,0.3);
        }
        .anam-btn-next.inativo {
          background: rgba(255,255,255,0.05);
          color: var(--text-muted);
          cursor: not-allowed;
        }
        .anam-btn-back {
          flex: 1;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary);
          font-size: 15px;
          font-weight: 600;
          font-family: Inter, sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: background 0.2s;
        }
        .anam-btn-back:hover {
          background: rgba(255,255,255,0.07);
        }
      `}</style>

      {/* ── Header com progresso ─────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: "520px", marginBottom: "28px" }}>

        {/* Logo + contador */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h1 className="text-gradient" style={{ fontSize: "22px", fontWeight: "900", letterSpacing: "-0.3px" }}>
            AgendaFlow
          </h1>
          <span style={{
            background: "rgba(45,126,248,0.1)", border: "1px solid rgba(45,126,248,0.2)",
            borderRadius: "999px", padding: "4px 12px",
            color: "#93C5FD", fontSize: "12px", fontWeight: "700",
          }}>
            {passo} / {totalPassos}
          </span>
        </div>

        {/* Barra de progresso */}
        <div style={{
          height: "4px", borderRadius: "999px",
          background: "rgba(255,255,255,0.06)", overflow: "hidden",
          marginBottom: "14px",
        }}>
          <div style={{
            height: "100%",
            width: `${(passo / totalPassos) * 100}%`,
            background: "linear-gradient(90deg, #2D7EF8, #10B981)",
            borderRadius: "999px",
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Steps visuais */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {PASSOS_LABELS.map((label, i) => {
            const concluido = i + 1 < passo;
            const atual     = i + 1 === passo;
            return (
              <div key={label} style={{ textAlign: "center", flex: 1 }}>
                <div style={{
                  width: "30px", height: "30px", borderRadius: "50%",
                  background: concluido
                    ? "linear-gradient(135deg, #2D7EF8, #10B981)"
                    : atual
                      ? "rgba(45,126,248,0.2)"
                      : "rgba(255,255,255,0.05)",
                  border: `2px solid ${atual || concluido ? "#2D7EF8" : "rgba(255,255,255,0.08)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 5px",
                  transition: "all 0.3s ease",
                  boxShadow: atual ? "0 0 14px rgba(45,126,248,0.3)" : "none",
                }}>
                  {concluido
                    ? <Check size={13} color="white" strokeWidth={3} />
                    : <span style={{
                        color: atual ? "#2D7EF8" : "var(--text-muted)",
                        fontSize: "11px", fontWeight: "700",
                      }}>
                        {i + 1}
                      </span>
                  }
                </div>
                <p style={{
                  color: atual ? "#93C5FD" : concluido ? "#10B981" : "var(--text-muted)",
                  fontSize: "10px", fontWeight: atual ? "700" : "400",
                }}>
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Conteúdo do passo ───────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: "520px" }}>

        {/* ━━━━ PASSO 1 — Identidade do negócio ━━━━ */}
        {passo === 1 && (
          <div className="passo" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
              {/* Linha bicolor */}
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%",
                height: "2px", background: "linear-gradient(90deg, #2D7EF8, #10B981)", zIndex: 1,
              }} />

              <h2 className="anam-card-title">Sobre o seu negócio</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                Essas informações personalizam toda a plataforma para o seu estabelecimento.
              </p>

              {/* Segmento */}
              <div>
                <label className="anam-q-label">Qual o segmento do seu negócio?</label>
                <span className="anam-q-sub">Define o tema visual e as nomenclaturas do sistema.</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {SEGMENTOS.map((seg) => (
                    <button
                      key={seg.valor}
                      className={`opcao-btn ${respostas.segment === seg.valor ? "opcao-ativo" : ""}`}
                      onClick={() => {
                        atualizar("segment", seg.valor);
                        atualizar("professional_title", TITULOS_PROFISSIONAL[seg.valor]?.[0] || "Profissional");
                      }}
                      style={{
                        padding: "12px 14px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        display: "flex", alignItems: "center", gap: "10px",
                        fontFamily: "Inter, sans-serif", textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "20px", flexShrink: 0 }}>{seg.emoji}</span>
                      <span style={{
                        color: respostas.segment === seg.valor ? "#93C5FD" : "var(--text-secondary)",
                        fontSize: "13px", fontWeight: respostas.segment === seg.valor ? "700" : "500",
                      }}>
                        {seg.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="anam-divider" />

              {/* Quantidade de profissionais */}
              <div>
                <label className="anam-q-label">Quantos profissionais trabalham com você?</label>
                <span className="anam-q-sub">Ajusta a gestão de equipe no painel.</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  {["1", "2-5", "6-10", "10+"].map((qtd) => (
                    <button
                      key={qtd}
                      className={`toggle-btn ${respostas.professional_count === qtd ? "toggle-ativo" : ""}`}
                      onClick={() => atualizar("professional_count", qtd)}
                      style={{
                        padding: "13px 8px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                        fontSize: "14px", fontWeight: "600",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {qtd}
                    </button>
                  ))}
                </div>
              </div>

              <div className="anam-divider" />

              {/* Modo de atendimento */}
              <div>
                <label className="anam-q-label">Como funciona o atendimento?</label>
                <span className="anam-q-sub">Define o motor de agendamento do sistema.</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { valor: "agendamento",    label: "Com hora marcada",      desc: "Clientes agendam online" },
                    { valor: "ordem_chegada",  label: "Ordem de chegada",       desc: "Sem agendamento prévio" },
                    { valor: "ambos",          label: "Ambos",                  desc: "Agendamento e ordem de chegada" },
                  ].map((modo) => (
                    <button
                      key={modo.valor}
                      className={`opcao-btn ${respostas.scheduling_mode === modo.valor ? "opcao-ativo" : ""}`}
                      onClick={() => atualizar("scheduling_mode", modo.valor)}
                      style={{
                        padding: "14px 16px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontFamily: "Inter, sans-serif", textAlign: "left",
                      }}
                    >
                      <div>
                        <p style={{
                          color: respostas.scheduling_mode === modo.valor ? "#93C5FD" : "var(--text-primary)",
                          fontSize: "14px", fontWeight: "600",
                        }}>
                          {modo.label}
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>{modo.desc}</p>
                      </div>
                      {respostas.scheduling_mode === modo.valor && (
                        <div style={{
                          width: "22px", height: "22px", borderRadius: "50%",
                          background: "#2D7EF8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <Check size={12} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━━━ PASSO 2 — Serviços e produtos ━━━━ */}
        {passo === 2 && (
          <div className="passo" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%",
                height: "2px", background: "linear-gradient(90deg, #10B981, #2D7EF8)", zIndex: 1,
              }} />

              <h2 className="anam-card-title">Serviços e produtos</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                Configura quais módulos estarão ativos no seu painel.
              </p>

              {/* Vende produtos */}
              <div>
                <label className="anam-q-label">Você vende produtos físicos no estabelecimento?</label>
                <span className="anam-q-sub">Ativa o módulo de estoque e upsell de produtos.</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { valor: true,  label: "Sim" },
                    { valor: false, label: "Não" },
                  ].map((op) => (
                    <button
                      key={String(op.valor)}
                      className={`toggle-btn ${respostas.has_products === op.valor ? "toggle-ativo" : ""}`}
                      onClick={() => atualizar("has_products", op.valor)}
                      style={{
                        padding: "14px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                        fontSize: "14px", fontWeight: "600",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="anam-divider" />

              {/* Duração dos serviços */}
              <div>
                <label className="anam-q-label">Seus serviços têm duração fixa?</label>
                <span className="anam-q-sub">Influencia no cálculo de disponibilidade de horários.</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { valor: true,  label: "Duração fixa" },
                    { valor: false, label: "Duração variável" },
                  ].map((op) => (
                    <button
                      key={String(op.valor)}
                      className={`toggle-btn ${respostas.has_fixed_duration === op.valor ? "toggle-ativo" : ""}`}
                      onClick={() => atualizar("has_fixed_duration", op.valor)}
                      style={{
                        padding: "14px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                        fontSize: "14px", fontWeight: "600",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━━━ PASSO 3 — Modelo financeiro ━━━━ */}
        {passo === 3 && (
          <div className="passo" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%",
                height: "2px", background: "linear-gradient(90deg, #f4bb11, #10B981)", zIndex: 1,
              }} />

              <h2 className="anam-card-title">Modelo financeiro</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                Configura como funciona a remuneração da equipe e as formas de pagamento.
              </p>

              {/* Modelo de remuneração */}
              <div>
                <label className="anam-q-label">Como seus profissionais são remunerados?</label>
                <span className="anam-q-sub">Configura o dashboard financeiro de cada profissional.</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { valor: "fixo",          label: "Salário fixo",           desc: "Sem variável" },
                    { valor: "comissao",       label: "Só comissão",            desc: "% sobre produção" },
                    { valor: "fixo_comissao",  label: "Fixo + comissão",        desc: "Salário base + % por serviço" },
                    { valor: "fixo_meta",      label: "Fixo + meta + bônus",    desc: "Salário + metas mensais" },
                  ].map((modelo) => (
                    <button
                      key={modelo.valor}
                      className={`opcao-btn ${respostas.remuneration_model === modelo.valor ? "opcao-ativo" : ""}`}
                      onClick={() => {
                        atualizar("remuneration_model", modelo.valor);
                        atualizar("has_commission", ["comissao", "fixo_comissao", "fixo_meta"].includes(modelo.valor));
                        atualizar("has_goals", modelo.valor === "fixo_meta");
                      }}
                      style={{
                        padding: "14px 16px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontFamily: "Inter, sans-serif", textAlign: "left",
                      }}
                    >
                      <div>
                        <p style={{
                          color: respostas.remuneration_model === modelo.valor ? "#93C5FD" : "var(--text-primary)",
                          fontSize: "14px", fontWeight: "600",
                        }}>
                          {modelo.label}
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>{modelo.desc}</p>
                      </div>
                      {respostas.remuneration_model === modelo.valor && (
                        <div style={{
                          width: "22px", height: "22px", borderRadius: "50%",
                          background: "#2D7EF8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <Check size={12} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comissão padrão */}
              {respostas.has_commission && (
                <>
                  <div className="anam-divider" />
                  <div>
                    <label className="anam-q-label">Percentual padrão de comissão (%)</label>
                    <span className="anam-q-sub">Pode ser ajustado individualmente por profissional.</span>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={respostas.commission_rate}
                      onChange={(e) => atualizar("commission_rate", parseFloat(e.target.value) || 0)}
                      className="anam-input"
                      placeholder="Ex: 10"
                    />
                  </div>
                </>
              )}

              <div className="anam-divider" />

              {/* Gorjeta */}
              <div>
                <label className="anam-q-label">Trabalha com gorjeta / bônus?</label>
                <span className="anam-q-sub">Ativa o campo de gorjeta no fechamento do atendimento.</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { valor: true,  label: "Sim" },
                    { valor: false, label: "Não" },
                  ].map((op) => (
                    <button
                      key={String(op.valor)}
                      className={`toggle-btn ${respostas.has_tips === op.valor ? "toggle-ativo" : ""}`}
                      onClick={() => atualizar("has_tips", op.valor)}
                      style={{
                        padding: "14px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                        fontSize: "14px", fontWeight: "600",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="anam-divider" />

              {/* Formas de pagamento */}
              <div>
                <label className="anam-q-label">Formas de pagamento aceitas</label>
                <span className="anam-q-sub">Todas as opções aparecerão no momento do agendamento.</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { valor: "pix",            label: "Pix",                         desc: "Chave cadastrada pelo estabelecimento" },
                    { valor: "cartao",         label: "Cartão de crédito / débito",   desc: "Maquininha no estabelecimento" },
                    { valor: "estabelecimento",label: "Pagar no estabelecimento",     desc: "Dinheiro ou outros meios" },
                  ].map((pag) => {
                    const selecionado = respostas.payment_methods.includes(pag.valor);
                    return (
                      <button
                        key={pag.valor}
                        className={`opcao-btn ${selecionado ? "opcao-ativo" : ""}`}
                        onClick={() => togglePayment(pag.valor)}
                        style={{
                          padding: "14px 16px",
                          background: "var(--glass-bg)",
                          border: "1px solid var(--glass-border)",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          fontFamily: "Inter, sans-serif", textAlign: "left",
                        }}
                      >
                        <div>
                          <p style={{
                            color: selecionado ? "#93C5FD" : "var(--text-primary)",
                            fontSize: "14px", fontWeight: "600",
                          }}>
                            {pag.label}
                          </p>
                          <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>{pag.desc}</p>
                        </div>
                        <div style={{
                          width: "22px", height: "22px", borderRadius: "50%",
                          background: selecionado ? "#2D7EF8" : "transparent",
                          border: `2px solid ${selecionado ? "#2D7EF8" : "rgba(255,255,255,0.15)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.2s ease", flexShrink: 0,
                        }}>
                          {selecionado && <Check size={12} color="white" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━━━ PASSO 4 — Experiência do cliente ━━━━ */}
        {passo === 4 && (
          <div className="passo" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%",
                height: "2px", background: "linear-gradient(90deg, #7C3AED, #2D7EF8)", zIndex: 1,
              }} />

              <h2 className="anam-card-title">Experiência do cliente</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                Personaliza como seus clientes interagem com o sistema.
              </p>

              {/* Título do profissional */}
              <div>
                <label className="anam-q-label">Como chamar seus profissionais no sistema?</label>
                <span className="anam-q-sub">Aparece no portal do cliente e nas nomenclaturas do painel.</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {titulosProfissional.map((titulo) => (
                    <button
                      key={titulo}
                      className={`toggle-btn ${respostas.professional_title === titulo ? "toggle-ativo" : ""}`}
                      onClick={() => atualizar("professional_title", titulo)}
                      style={{
                        padding: "14px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                        fontSize: "14px", fontWeight: "600",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {titulo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="anam-divider" />

              {/* Notificação WhatsApp */}
              <div>
                <label className="anam-q-label">Quer receber notificação de novo agendamento no WhatsApp?</label>
                <span className="anam-q-sub">Ativa a integração de notificações via WhatsApp.</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { valor: true,  label: "Sim" },
                    { valor: false, label: "Não por enquanto" },
                  ].map((op) => (
                    <button
                      key={String(op.valor)}
                      className={`toggle-btn ${respostas.whatsapp_notify === op.valor ? "toggle-ativo" : ""}`}
                      onClick={() => atualizar("whatsapp_notify", op.valor)}
                      style={{
                        padding: "14px",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                        fontSize: "14px", fontWeight: "600",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━━━ PASSO 5 — Dados do responsável ━━━━ */}
        {passo === 5 && (
          <div className="passo" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%",
                height: "2px", background: "linear-gradient(90deg, #10B981, #2D7EF8)", zIndex: 1,
              }} />

              <h2 className="anam-card-title">Seus dados</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                Informações do responsável pelo estabelecimento. Usadas para contato e suporte.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { label: "Nome completo", campo: "responsible_name"     as keyof Respostas, type: "text", placeholder: "João Silva" },
                  { label: "WhatsApp",      campo: "responsible_whatsapp" as keyof Respostas, type: "tel",  placeholder: "(11) 99999-9999" },
                  { label: "Cidade",        campo: "city"                 as keyof Respostas, type: "text", placeholder: "São Paulo" },
                ].map((campo) => (
                  <div key={campo.label}>
                    <label className="anam-q-label">{campo.label}</label>
                    <input
                      type={campo.type}
                      placeholder={campo.placeholder}
                      value={respostas[campo.campo] as string}
                      onChange={(e) => {
                        const val = campo.campo === "responsible_whatsapp"
                          ? mascararTelefone(e.target.value)
                          : e.target.value;
                        atualizar(campo.campo, val);
                      }}
                      className="anam-input"
                      required
                    />
                  </div>
                ))}

                <div className="anam-divider" style={{ margin: "4px 0" }} />

                {/* Como conheceu */}
                <div>
                  <label className="anam-q-label">Como conheceu o AgendaFlow?</label>
                  <span className="anam-q-sub">Nos ajuda a entender como chegar até mais clientes.</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {[
                      { valor: "indicacao", label: "Indicação" },
                      { valor: "instagram", label: "Instagram" },
                      { valor: "google",    label: "Google" },
                      { valor: "outro",     label: "Outro" },
                    ].map((op) => (
                      <button
                        key={op.valor}
                        className={`toggle-btn ${respostas.how_found === op.valor ? "toggle-ativo" : ""}`}
                        onClick={() => atualizar("how_found", op.valor)}
                        style={{
                          padding: "12px",
                          background: "var(--glass-bg)",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-secondary)",
                          fontSize: "13px", fontWeight: "600",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="anam-divider" style={{ margin: "4px 0" }} />

                {/* Faturamento */}
                <div>
                  <label className="anam-q-label">Faturamento mensal aproximado</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      { valor: "ate5k",    label: "Até R$ 5.000" },
                      { valor: "5k-15k",   label: "R$ 5.000 a R$ 15.000" },
                      { valor: "15k-50k",  label: "R$ 15.000 a R$ 50.000" },
                      { valor: "acima50k", label: "Acima de R$ 50.000" },
                    ].map((faixa) => (
                      <button
                        key={faixa.valor}
                        className={`toggle-btn ${respostas.monthly_revenue === faixa.valor ? "toggle-ativo" : ""}`}
                        onClick={() => atualizar("monthly_revenue", faixa.valor)}
                        style={{
                          padding: "13px 16px",
                          background: "var(--glass-bg)",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-secondary)",
                          fontSize: "13px", fontWeight: "500",
                          fontFamily: "Inter, sans-serif", textAlign: "left",
                        }}
                      >
                        {faixa.label}
                      </button>
                    ))}
                  </div>

                  {/* Mensagens de privacidade e métrica */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                    <p style={{
                      color: "var(--text-muted)", fontSize: "11px",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}>
                      🔒 Esses dados não serão divulgados.
                    </p>
                    <p style={{
                      color: "var(--text-muted)", fontSize: "11px",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}>
                      📊 Usaremos esse valor como referência para mostrar sua evolução de faturamento com o AgendaFlow.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Navegação ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          {passo > 1 && (
            <button
              onClick={() => setPasso(passo - 1)}
              className="anam-btn-back"
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
          )}

          {passo < totalPassos ? (
            <button
              onClick={() => { if (passoValido()) setPasso(passo + 1); }}
              disabled={!passoValido()}
              className={`anam-btn-next ${passoValido() ? "ativo" : "inativo"}`}
            >
              Continuar
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={finalizar}
              disabled={!passoValido() || salvando}
              className={`anam-btn-next ${passoValido() ? "ativo" : "inativo"}`}
              style={{ opacity: salvando ? 0.7 : 1 }}
            >
              {salvando ? "Finalizando..." : "Concluir Configuração"}
              {!salvando && <Check size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
