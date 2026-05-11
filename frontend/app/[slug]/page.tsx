"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Scissors, Sparkles, Star, Activity, Pen, Car, Calendar, Clock, MapPin, LucideIcon } from "lucide-react";
import api from "@/lib/api";

interface TenantTheme {
  name: string;
  slug: string;
  segment: string;
  cor_primaria: string;
  cor_secundaria: string;
  titulo_profissional: string;
  tema?: string;
}

interface ConfigPublica {
  opening_time: string;
  closing_time: string;
  working_days: string;
  address: string;
}

interface StatusFuncionamento {
  aberto: boolean;
  label: string;
  detalhe: string;
}

const SEGMENTO_ICONE: Record<string, LucideIcon> = {
  barbearia:           Scissors,
  salao:               Sparkles,
  clinica_estetica:    Star,
  pilates:             Activity,
  tatuagem:            Pen,
  estetica_automotiva: Car,
  outro:               Calendar,
};

const SEGMENTO_TAGLINE: Record<string, string> = {
  barbearia:           "Cortes e estilos que definem você",
  salao:               "Beleza e cuidado em cada detalhe",
  clinica_estetica:    "Tratamentos estéticos de alto padrão",
  pilates:             "Movimento e bem-estar para o seu corpo",
  tatuagem:            "Arte na pele, expressão única",
  estetica_automotiva: "Seu veículo merece o melhor",
  outro:               "Agende seu atendimento online",
};

const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const NOMES_DIAS_EXTENSO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function formatarHorario(abertura: string, fechamento: string): string {
  const fmt = (h: string) => h.slice(0, 5).replace(":", "h");
  return `${fmt(abertura)} – ${fmt(fechamento)}`;
}

function formatarDias(workingDays: string): string {
  if (!workingDays) return "";
  const nums = workingDays.split(",").map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
  if (nums.length === 0) return "";
  if (nums.length === 7) return "Todos os dias";
  if (nums.length === 1) return NOMES_DIAS[nums[0]];
  return `${NOMES_DIAS[nums[0]]} – ${NOMES_DIAS[nums[nums.length - 1]]}`;
}

function fmtHora(h: number, m: number): string {
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function calcularStatus(config: ConfigPublica): StatusFuncionamento {
  try {
    const agora = new Date();
    const diaAtual = agora.getDay();
    const diasUteis = config.working_days.split(",").map(Number).filter((n) => !isNaN(n));

    const [hAbre, mAbre] = config.opening_time.split(":").map(Number);
    const [hFecha, mFecha] = config.closing_time.split(":").map(Number);

    const minAtual = agora.getHours() * 60 + agora.getMinutes();
    const minAbre  = hAbre  * 60 + mAbre;
    const minFecha = hFecha * 60 + mFecha;

    const hojeTrabalhando = diasUteis.includes(diaAtual);

    // Aberto agora
    if (hojeTrabalhando && minAtual >= minAbre && minAtual < minFecha) {
      return {
        aberto: true,
        label: "Aberto agora",
        detalhe: `Fecha às ${fmtHora(hFecha, mFecha)}`,
      };
    }

    // Abre mais tarde hoje
    if (hojeTrabalhando && minAtual < minAbre) {
      return {
        aberto: false,
        label: "Fechado",
        detalhe: `Abre hoje às ${fmtHora(hAbre, mAbre)}`,
      };
    }

    // Próximo dia útil
    for (let i = 1; i <= 7; i++) {
      const proximo = (diaAtual + i) % 7;
      if (diasUteis.includes(proximo)) {
        const quando = i === 1 ? "amanhã" : NOMES_DIAS_EXTENSO[proximo];
        return {
          aberto: false,
          label: "Fechado",
          detalhe: `Abre ${quando} às ${fmtHora(hAbre, mAbre)}`,
        };
      }
    }

    return { aberto: false, label: "Fechado", detalhe: "" };
  } catch {
    return { aberto: false, label: "", detalhe: "" };
  }
}

export default function ClientePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [tema, setTema]         = useState<TenantTheme | null>(null);
  const [config, setConfig]     = useState<ConfigPublica | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]         = useState("");
  // tick força recálculo do status aberto/fechado a cada minuto sem recarregar
  const [tick, setTick]         = useState(0);

  useEffect(() => {
    document.documentElement.className = "theme-dark";

    api.get(`/tenants/${slug}/theme`)
      .then((r) => setTema(r.data))
      .catch(() => setErro("Estabelecimento não encontrado."))
      .finally(() => setCarregando(false));

    // Busca config e repete a cada 30 s — reflete alterações do admin automaticamente
    const buscarConfig = () => {
      api.get(`/config/${slug}/public`)
        .then((r) => setConfig(r.data))
        .catch(() => {});
    };
    buscarConfig();
    const pollingConfig = setInterval(buscarConfig, 30_000);

    // Tick por minuto para recalcular aberto/fechado no horário exato
    const tickClock = setInterval(() => setTick((t) => t + 1), 60_000);

    return () => {
      clearInterval(pollingConfig);
      clearInterval(tickClock);
    };
  }, [slug]);

  if (carregando) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#080C14", fontFamily: "Inter, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%",
            border: "2px solid rgba(45,126,248,0.25)",
            borderTopColor: "#2D7EF8",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "#4B5568", fontSize: "13px" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (erro || !tema) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#080C14", color: "#FCA5A5",
        fontSize: "14px", fontFamily: "Inter, sans-serif",
      }}>
        {erro || "Estabelecimento não encontrado."}
      </div>
    );
  }

  const corP = tema.cor_primaria;
  const corS = tema.cor_secundaria;
  const IconeSegmento = SEGMENTO_ICONE[tema.segment] || Calendar;
  const tagline = SEGMENTO_TAGLINE[tema.segment] || SEGMENTO_TAGLINE.outro;

  const horario = config?.opening_time && config?.closing_time
    ? formatarHorario(config.opening_time, config.closing_time)
    : null;
  const dias   = config?.working_days ? formatarDias(config.working_days) : null;
  // tick é lido aqui para forçar re-render e recalcular status no minuto certo
  const status: StatusFuncionamento | null =
    config?.working_days && config?.opening_time && config?.closing_time && tick >= 0
      ? calcularStatus(config)
      : null;

  const temInfo = status?.label || dias || horario || config?.address;

  return (
    <div style={{
      minHeight: "100vh", background: "#080C14",
      fontFamily: "Inter, sans-serif",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 20px",
    }}>

      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: scale(1) translate(0,0); opacity: 0.5; }
          50% { transform: scale(1.2) translate(3%, 2%); opacity: 0.8; }
        }
        @keyframes orb2 {
          0%, 100% { transform: scale(1) translate(0,0); opacity: 0.3; }
          50% { transform: scale(1.15) translate(-2%, -3%); opacity: 0.6; }
        }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(0.92); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.15; }
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          50% { box-shadow: 0 0 0 5px rgba(16,185,129,0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(300%)  skewX(-12deg); }
        }
        .nome-gradient {
          background: linear-gradient(135deg, #E8F0FF 10%, ${corP} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .btn-agendar-main {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative; overflow: hidden;
        }
        .btn-agendar-main::after {
          content: "";
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          transform: translateX(-150%) skewX(-12deg);
          animation: shimmer 3s ease-in-out infinite 0.8s;
        }
        .btn-agendar-main:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 64px ${corP}66 !important;
        }
        .btn-agendar-main:active { transform: translateY(0px); }
        .dot-aberto { animation: pulse-dot 2s ease-in-out infinite; }
      `}</style>

      {/* Orb 1 — topo esquerdo */}
      <div style={{
        position: "fixed", top: "-20%", left: "-15%",
        width: "560px", height: "560px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corP}30 0%, transparent 70%)`,
        animation: "orb1 11s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Orb 2 — base direito */}
      <div style={{
        position: "fixed", bottom: "-20%", right: "-15%",
        width: "640px", height: "640px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corS}24 0%, transparent 70%)`,
        animation: "orb2 14s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Orb 3 — central difuso */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "800px", height: "800px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corP}09 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />

      {/* Grade de pontos sutil */}
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        pointerEvents: "none",
      }} />

      {/* Card principal */}
      <div style={{
        width: "100%", maxWidth: "400px",
        background: "rgba(13,17,23,0.82)",
        backdropFilter: "blur(48px)",
        WebkitBackdropFilter: "blur(48px)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "32px",
        padding: "44px 32px 36px",
        boxShadow: `0 48px 120px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07)`,
        position: "relative", zIndex: 1,
        animation: "fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) forwards",
        textAlign: "center",
      }}>

        {/* Linha de brilho superior bicolor */}
        <div style={{
          position: "absolute", top: 0, left: "12%", right: "12%", height: "1px",
          background: `linear-gradient(90deg, transparent, ${corP}90, ${corS}70, transparent)`,
          borderRadius: "999px",
        }} />

        {/* Ícone com anel pulsante */}
        <div style={{ position: "relative", width: "96px", height: "96px", margin: "0 auto 28px" }}>
          <div style={{
            position: "absolute", inset: "-10px",
            borderRadius: "30px",
            background: `linear-gradient(135deg, ${corP}35, ${corS}25)`,
            animation: "pulse-ring 3.5s ease-in-out infinite",
          }} />
          <div style={{
            width: "96px", height: "96px", borderRadius: "24px",
            background: `linear-gradient(145deg, ${corP}, ${corS})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            boxShadow: `0 16px 48px ${corP}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
          }}>
            <IconeSegmento size={42} color="white" strokeWidth={1.8} />
          </div>
        </div>

        {/* Nome com gradient text */}
        <h1 className="nome-gradient" style={{
          fontSize: "30px", fontWeight: "900",
          marginBottom: "8px",
          lineHeight: "1.15", letterSpacing: "-0.5px",
        }}>
          {tema.name}
        </h1>

        {/* Tagline do segmento */}
        <p style={{
          color: "#4B5568", fontSize: "14px",
          marginBottom: "24px", lineHeight: "1.55",
          fontWeight: "500",
        }}>
          {tagline}
        </p>

        {/* Trust pills */}
        <div style={{
          display: "flex", gap: "7px", justifyContent: "center",
          flexWrap: "wrap", marginBottom: "28px",
        }}>
          {[
            { emoji: "📅", label: "Online" },
            { emoji: "⚡", label: "Rápido" },
            { emoji: "✓",  label: "Cancelamento gratuito" },
          ].map((pill) => (
            <span key={pill.label} style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "999px", padding: "5px 13px",
              fontSize: "11px", fontWeight: "600",
              color: "#4B5568", letterSpacing: "0.01em",
            }}>
              <span style={{ fontSize: "10px" }}>{pill.emoji}</span> {pill.label}
            </span>
          ))}
        </div>

        {/* Botão CTA */}
        <button
          className="btn-agendar-main"
          onClick={() => router.push(`/${slug}/agendar`)}
          style={{
            width: "100%", padding: "18px",
            background: `linear-gradient(135deg, ${corP}, ${corS})`,
            border: "none", borderRadius: "18px",
            color: "white", fontSize: "17px", fontWeight: "800",
            cursor: "pointer", fontFamily: "Inter, sans-serif",
            letterSpacing: "-0.3px",
            boxShadow: `0 12px 40px ${corP}55`,
          }}
        >
          Agendar Agora →
        </button>

        {/* Painel de informações — status + horário + endereço */}
        {temInfo && (
          <div style={{
            marginTop: "16px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px",
            overflow: "hidden",
          }}>

            {/* Status aberto/fechado */}
            {status?.label && (
              <div style={{
                padding: "11px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: (dias || horario || config?.address)
                  ? "1px solid rgba(255,255,255,0.05)"
                  : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    className={status.aberto ? "dot-aberto" : undefined}
                    style={{
                      width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                      background: status.aberto ? "#10B981" : "#EF4444",
                      boxShadow: status.aberto
                        ? "0 0 6px rgba(16,185,129,0.7)"
                        : "0 0 6px rgba(239,68,68,0.5)",
                    }}
                  />
                  <span style={{
                    fontSize: "13px", fontWeight: "700",
                    color: status.aberto ? "#10B981" : "#EF4444",
                  }}>
                    {status.label}
                  </span>
                </div>
                {status.detalhe && (
                  <span style={{ fontSize: "12px", color: "#374151", fontWeight: "500" }}>
                    {status.detalhe}
                  </span>
                )}
              </div>
            )}

            {/* Horário e dias da semana */}
            {dias && horario && (
              <div style={{
                padding: "10px 16px",
                display: "flex", alignItems: "center", gap: "8px",
                borderBottom: config?.address ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <Clock size={12} color="#374151" strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: "#374151", fontWeight: "500" }}>
                  {dias} &nbsp;·&nbsp; {horario}
                </span>
              </div>
            )}

            {/* Endereço */}
            {config?.address && (
              <div style={{
                padding: "10px 16px",
                display: "flex", alignItems: "flex-start", gap: "8px",
              }}>
                <MapPin size={12} color="#374151" strokeWidth={2} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span style={{ fontSize: "12px", color: "#374151", fontWeight: "500", lineHeight: "1.45", textAlign: "left" }}>
                  {config.address}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Branding */}
        <div style={{
          marginTop: "20px", paddingTop: "16px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          <p style={{
            color: "#1F2937", fontSize: "10px",
            letterSpacing: "0.1em", fontWeight: "700",
            textTransform: "uppercase",
          }}>
            Powered by KronumTech
          </p>
        </div>
      </div>
    </div>
  );
}
