"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Scissors, ArrowRight, ArrowLeft, Building2, Mail, Lock } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import api from "@/lib/api";

interface TenantTheme {
  name: string;
  slug: string;
  cor_primaria: string;
  cor_secundaria: string;
  titulo_profissional: string;
}

type Passo = "slug" | "escolha" | "credenciais";
type TipoAcesso = "admin" | "professional" | null;

// Extrai mensagem de erro legível
function extrairMensagemErro(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e.friendlyMessage === "string") return e.friendlyMessage;
    const detail = (e.response as Record<string, unknown> | undefined)?.data;
    if (detail && typeof (detail as Record<string, unknown>).detail === "string") {
      return (detail as Record<string, string>).detail;
    }
  }
  return fallback;
}

const PASSO_NUMERO: Record<Passo, number> = { slug: 1, escolha: 2, credenciais: 3 };
const PASSO_LABEL: Record<Passo, string> = {
  slug: "Estabelecimento",
  escolha: "Perfil",
  credenciais: "Acesso",
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  useEffect(() => {
    document.documentElement.className = "theme-dark";
  }, []);

  const [passo, setPasso] = useState<Passo>("slug");
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso>(null);

  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tema, setTema] = useState<TenantTheme | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const submetendoRef = useRef(false);

  async function handleBuscarEstabelecimento(e: React.FormEvent) {
    e.preventDefault();
    if (submetendoRef.current) return;
    submetendoRef.current = true;
    setErro(""); setCarregando(true);
    try {
      const r = await api.get(`/tenants/${slug}/theme`);
      setTema(r.data);
      setPasso("escolha");
    } catch (error) {
      setErro(extrairMensagemErro(error, "Estabelecimento não encontrado. Verifique o nome."));
    } finally {
      setCarregando(false);
      submetendoRef.current = false;
    }
  }

  function handleEscolherAcesso(tipo: TipoAcesso) {
    setTipoAcesso(tipo);
    setErro("");
    setPasso("credenciais");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (submetendoRef.current) return;
    submetendoRef.current = true;
    setErro(""); setCarregando(true);
    try {
      const r = await api.post("/auth/login", {
        email, password: senha, tenant_slug: slug,
      });
      const { role, full_name, user_id } = r.data;

      if (role !== tipoAcesso) {
        setErro("Acesso não permitido para este tipo de conta.");
        return;
      }

      // Token não exposto — o cookie HttpOnly foi setado pelo backend automaticamente
      login({ id: user_id, email, role, full_name, tenant: slug }, slug);

      if (role === "admin") router.push(`/${slug}/admin`);
      else if (role === "professional") router.push(`/${slug}/profissional`);
      else router.push(`/${slug}`);
    } catch (error) {
      setErro(extrairMensagemErro(error, "Email ou senha incorretos. Verifique seus dados e tente novamente."));
    } finally {
      setCarregando(false);
      submetendoRef.current = false;
    }
  }

  const corP = tema?.cor_primaria || "#2D7EF8";
  const corS = tema?.cor_secundaria || "#10B981";
  const passoNum = PASSO_NUMERO[passo];
  const progresso = Math.round((passoNum / 3) * 100);

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "#080C14", padding: "24px",
      position: "relative", overflow: "hidden",
      fontFamily: "Inter, sans-serif",
    }}>

      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: scale(1) translate(0,0); opacity: 0.5; }
          50% { transform: scale(1.2) translate(3%,2%); opacity: 0.8; }
        }
        @keyframes orb2 {
          0%, 100% { transform: scale(1) translate(0,0); opacity: 0.3; }
          50% { transform: scale(1.15) translate(-2%,-3%); opacity: 0.6; }
        }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(0.92); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.15; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(300%)  skewX(-12deg); }
        }

        /* Gradient text */
        .logo-gradient {
          background: linear-gradient(135deg, ${corP}, ${corS});
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .tenant-gradient {
          background: linear-gradient(135deg, #E8F0FF 10%, ${corP} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Botão CTA */
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
        .btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Inputs */
        .input-login {
          width: 100%; padding: 13px 16px 13px 44px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; color: #F0F4FF;
          font-size: 14px; font-family: Inter, sans-serif;
          outline: none; transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .input-login:focus {
          border-color: ${corP}80;
          box-shadow: 0 0 0 3px ${corP}18;
          background: rgba(255,255,255,0.06);
        }
        .input-login::placeholder { color: #374151; }

        /* Cards de escolha */
        .tipo-btn { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); cursor: pointer; }
        .tipo-btn-admin:hover {
          border-color: rgba(45,126,248,0.5) !important;
          background: rgba(45,126,248,0.1) !important;
          transform: translateY(-2px);
          box-shadow: 0 16px 40px rgba(45,126,248,0.2) !important;
        }
        .tipo-btn-prof:hover {
          border-color: rgba(16,185,129,0.5) !important;
          background: rgba(16,185,129,0.1) !important;
          transform: translateY(-2px);
          box-shadow: 0 16px 40px rgba(16,185,129,0.2) !important;
        }

        /* Botão voltar */
        .voltar-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 8px 14px;
          color: #4B5568; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: Inter, sans-serif;
          transition: all 0.2s ease;
        }
        .voltar-btn:hover {
          color: ${corP} !important;
          border-color: ${corP}40 !important;
          background: ${corP}0D !important;
        }
      `}</style>

      {/* ── Fundo premium ── */}
      <div style={{
        position: "fixed", top: "-20%", left: "-10%",
        width: "600px", height: "600px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corP}26 0%, transparent 70%)`,
        animation: "orb1 11s ease-in-out infinite", pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-20%", right: "-10%",
        width: "700px", height: "700px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corS}1C 0%, transparent 70%)`,
        animation: "orb2 14s ease-in-out infinite", pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: "900px", height: "900px", borderRadius: "50%",
        background: `radial-gradient(circle, ${corP}07 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "28px 28px", pointerEvents: "none",
      }} />

      {/* ── Card principal ── */}
      <div
        key={passo}
        style={{
          width: "100%", maxWidth: "400px",
          background: "rgba(13,17,23,0.85)",
          backdropFilter: "blur(48px)",
          WebkitBackdropFilter: "blur(48px)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "32px",
          padding: "0",
          boxShadow: "0 48px 120px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07)",
          position: "relative", zIndex: 1,
          animation: "fadeUp 0.45s cubic-bezier(0.4,0,0.2,1) forwards",
          overflow: "hidden",
        }}
      >
        {/* Linha de brilho bicolor */}
        <div style={{
          position: "absolute", top: 0, left: "15%", right: "15%", height: "1px",
          background: `linear-gradient(90deg, transparent, ${corP}90, ${corS}70, transparent)`,
          borderRadius: "999px", zIndex: 2,
        }} />

        {/* ── Header de progresso ── */}
        <div style={{ padding: "20px 28px 0" }}>
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

          {/* Linha de navegação */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {passo !== "slug" && (
                <button
                  className="voltar-btn"
                  onClick={() => {
                    if (passo === "credenciais") { setPasso("escolha"); setErro(""); }
                    else if (passo === "escolha") setPasso("slug");
                  }}
                >
                  <ArrowLeft size={13} /> Voltar
                </button>
              )}
            </div>
            <span style={{
              background: `${corP}18`,
              border: `1px solid ${corP}30`,
              borderRadius: "999px", padding: "4px 10px",
              fontSize: "11px", fontWeight: "700", color: corP,
            }}>
              {passoNum} / 3 · {PASSO_LABEL[passo]}
            </span>
          </div>
        </div>

        {/* ── Conteúdo do passo ── */}
        <div style={{ padding: "20px 28px 28px" }}>

          {/* ══ PASSO 1 — Estabelecimento ══ */}
          {passo === "slug" && (
            <>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                {/* Ícone com anel pulsante */}
                <div style={{ position: "relative", width: "72px", height: "72px", margin: "0 auto 20px" }}>
                  <div style={{
                    position: "absolute", inset: "-8px", borderRadius: "24px",
                    background: `linear-gradient(135deg, ${corP}30, ${corS}20)`,
                    animation: "pulse-ring 3.5s ease-in-out infinite",
                  }} />
                  <div style={{
                    width: "72px", height: "72px", borderRadius: "20px",
                    background: `linear-gradient(145deg, ${corP}, ${corS})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                    boxShadow: `0 12px 36px ${corP}50, inset 0 1px 0 rgba(255,255,255,0.22)`,
                  }}>
                    <Building2 size={30} color="white" strokeWidth={1.8} />
                  </div>
                </div>

                <h1 className="logo-gradient" style={{
                  fontSize: "26px", fontWeight: "900",
                  letterSpacing: "-0.5px", marginBottom: "6px",
                }}>
                  AgendaFlow
                </h1>
                <p style={{ color: "#4B5568", fontSize: "13px", fontWeight: "500" }}>
                  Acesso exclusivo para equipes
                </p>
              </div>

              <form onSubmit={handleBuscarEstabelecimento} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{
                    display: "block", fontSize: "11px", fontWeight: "700",
                    color: "#4B5568", textTransform: "uppercase",
                    letterSpacing: "0.1em", marginBottom: "8px",
                  }}>
                    Nome do Estabelecimento
                  </label>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}>
                      <Building2 size={16} color="#374151" />
                    </div>
                    <input
                      className="input-login"
                      type="text"
                      placeholder=""
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s/g, "-"))}
                      required
                    />
                  </div>
                </div>

                {erro && (
                  <div style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.15)",
                    borderRadius: "12px", padding: "12px 14px",
                    color: "#FCA5A5", fontSize: "13px", lineHeight: "1.45",
                  }}>
                    {erro}
                  </div>
                )}

                <button
                  className="btn-cta"
                  type="submit"
                  disabled={carregando || !slug}
                  style={{
                    width: "100%", padding: "16px",
                    background: `linear-gradient(135deg, ${corP}, ${corS})`,
                    border: "none", borderRadius: "14px",
                    color: "white", fontSize: "15px", fontWeight: "700",
                    fontFamily: "Inter, sans-serif",
                    boxShadow: `0 10px 32px ${corP}40`,
                    cursor: carregando || !slug ? "not-allowed" : "pointer",
                  }}
                >
                  {carregando ? "Buscando..." : "Continuar →"}
                </button>
              </form>

              {/* Mini indicador dos próximos passos */}
              <div style={{
                display: "flex", justifyContent: "center", gap: "6px",
                marginTop: "20px",
              }}>
                {["Estabelecimento", "Perfil", "Acesso"].map((label, i) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", gap: "6px",
                  }}>
                    <div style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: i === 0 ? corP : "rgba(255,255,255,0.1)",
                      boxShadow: i === 0 ? `0 0 6px ${corP}` : "none",
                      transition: "all 0.3s",
                    }} />
                    {i < 2 && (
                      <div style={{ width: "16px", height: "1px", background: "rgba(255,255,255,0.06)" }} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══ PASSO 2 — Escolha de perfil ══ */}
          {passo === "escolha" && (
            <>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <p style={{
                  color: "#374151", fontSize: "11px", fontWeight: "700",
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  marginBottom: "6px",
                }}>
                  Bem-vindo a
                </p>
                <h2 className="tenant-gradient" style={{
                  fontSize: "24px", fontWeight: "900",
                  letterSpacing: "-0.4px", lineHeight: "1.2", marginBottom: "6px",
                }}>
                  {tema?.name}
                </h2>
                <p style={{ color: "#4B5568", fontSize: "13px" }}>
                  Como deseja acessar?
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Admin */}
                <button
                  className="tipo-btn tipo-btn-admin"
                  onClick={() => handleEscolherAcesso("admin")}
                  style={{
                    width: "100%", padding: "18px 16px",
                    background: "rgba(45,126,248,0.06)",
                    border: "1px solid rgba(45,126,248,0.15)",
                    borderRadius: "18px",
                    display: "flex", alignItems: "center", gap: "14px",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: "56px", height: "56px", borderRadius: "16px",
                    background: "linear-gradient(145deg, #2D7EF8, #1A5FCC)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 10px 28px rgba(45,126,248,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}>
                    <ShieldCheck size={26} color="white" strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#F0F4FF", fontSize: "15px", fontWeight: "700", marginBottom: "3px" }}>
                      Administrador
                    </p>
                    <p style={{ color: "#374151", fontSize: "12px" }}>
                      Gestão completa do estabelecimento
                    </p>
                  </div>
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "50%",
                    background: "rgba(45,126,248,0.1)",
                    border: "1px solid rgba(45,126,248,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <ArrowRight size={14} color="#2D7EF8" />
                  </div>
                </button>

                {/* Profissional */}
                <button
                  className="tipo-btn tipo-btn-prof"
                  onClick={() => handleEscolherAcesso("professional")}
                  style={{
                    width: "100%", padding: "18px 16px",
                    background: "rgba(16,185,129,0.06)",
                    border: "1px solid rgba(16,185,129,0.15)",
                    borderRadius: "18px",
                    display: "flex", alignItems: "center", gap: "14px",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: "56px", height: "56px", borderRadius: "16px",
                    background: "linear-gradient(145deg, #10B981, #059669)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 10px 28px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}>
                    <Scissors size={26} color="white" strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#F0F4FF", fontSize: "15px", fontWeight: "700", marginBottom: "3px" }}>
                      {tema?.titulo_profissional || "Profissional"}
                    </p>
                    <p style={{ color: "#374151", fontSize: "12px" }}>
                      Agenda e atendimentos do dia
                    </p>
                  </div>
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "50%",
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <ArrowRight size={14} color="#10B981" />
                  </div>
                </button>
              </div>

              {/* Dots de progresso */}
              <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "20px" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "6px",
                  }}>
                    <div style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: i <= 1 ? corP : "rgba(255,255,255,0.1)",
                      boxShadow: i <= 1 ? `0 0 6px ${corP}` : "none",
                    }} />
                    {i < 2 && <div style={{ width: "16px", height: "1px", background: i === 0 ? corP : "rgba(255,255,255,0.06)" }} />}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══ PASSO 3 — Credenciais ══ */}
          {passo === "credenciais" && (
            <>
              {/* Cabeçalho com badge de tipo */}
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  background: tipoAcesso === "admin"
                    ? "rgba(45,126,248,0.1)"
                    : "rgba(16,185,129,0.1)",
                  border: `1px solid ${tipoAcesso === "admin" ? "rgba(45,126,248,0.25)" : "rgba(16,185,129,0.25)"}`,
                  borderRadius: "999px", padding: "7px 16px",
                  marginBottom: "16px",
                }}>
                  {tipoAcesso === "admin"
                    ? <ShieldCheck size={14} color="#2D7EF8" strokeWidth={2} />
                    : <Scissors size={14} color="#10B981" strokeWidth={2} />
                  }
                  <span style={{
                    fontSize: "12px", fontWeight: "700",
                    color: tipoAcesso === "admin" ? "#2D7EF8" : "#10B981",
                  }}>
                    {tipoAcesso === "admin" ? "Administrador" : tema?.titulo_profissional || "Profissional"}
                  </span>
                </div>

                <h2 className="tenant-gradient" style={{
                  fontSize: "22px", fontWeight: "900",
                  letterSpacing: "-0.4px", lineHeight: "1.2",
                }}>
                  {tema?.name}
                </h2>
              </div>

              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Campo Email */}
                <div>
                  <label style={{
                    display: "block", fontSize: "11px", fontWeight: "700",
                    color: "#4B5568", textTransform: "uppercase",
                    letterSpacing: "0.1em", marginBottom: "8px",
                  }}>
                    Email
                  </label>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      position: "absolute", left: "14px", top: "50%",
                      transform: "translateY(-50%)", pointerEvents: "none",
                    }}>
                      <Mail size={16} color="#374151" />
                    </div>
                    <input
                      className="input-login"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Campo Senha */}
                <div>
                  <label style={{
                    display: "block", fontSize: "11px", fontWeight: "700",
                    color: "#4B5568", textTransform: "uppercase",
                    letterSpacing: "0.1em", marginBottom: "8px",
                  }}>
                    Senha
                  </label>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      position: "absolute", left: "14px", top: "50%",
                      transform: "translateY(-50%)", pointerEvents: "none",
                    }}>
                      <Lock size={16} color="#374151" />
                    </div>
                    <input
                      className="input-login"
                      type="password"
                      placeholder="••••••••"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {erro && (
                  <div style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.15)",
                    borderRadius: "12px", padding: "12px 14px",
                    color: "#FCA5A5", fontSize: "13px", lineHeight: "1.45",
                  }}>
                    {erro}
                  </div>
                )}

                <button
                  className="btn-cta"
                  type="submit"
                  disabled={carregando}
                  style={{
                    width: "100%", padding: "16px",
                    background: `linear-gradient(135deg, ${corP}, ${corS})`,
                    border: "none", borderRadius: "14px",
                    color: "white", fontSize: "15px", fontWeight: "700",
                    fontFamily: "Inter, sans-serif",
                    boxShadow: `0 10px 32px ${corP}40`,
                    marginTop: "2px",
                    cursor: carregando ? "not-allowed" : "pointer",
                  }}
                >
                  {carregando ? "Entrando..." : "Entrar →"}
                </button>
              </form>

              {/* Dots de progresso */}
              <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "20px" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: corP,
                      boxShadow: `0 0 6px ${corP}`,
                    }} />
                    {i < 2 && <div style={{ width: "16px", height: "1px", background: corP, opacity: 0.4 }} />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
