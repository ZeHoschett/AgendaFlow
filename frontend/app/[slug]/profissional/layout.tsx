"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import SeletorTema from "@/components/SeletorTema";
import { CalendarDays, BarChart2, LogOut, Menu, X } from "lucide-react";

const menuItems = [
  { label: "Minha Agenda",   icon: CalendarDays, href: "profissional/agenda"    },
  { label: "Meu Desempenho", icon: BarChart2,    href: "profissional/dashboard" },
];

export default function ProfissionalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const { logout, rehidratar } = useAuthStore();
  const slug = params.slug as string;

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("profissional/agenda");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  // Tema exclusivo do profissional — independente do admin e do portal do cliente
  const [temaAtual, setTemaAtual] = useState<"dark" | "light">("dark");
  // Mensagem de confirmação ao trocar o tema
  const [toastTema, setToastTema] = useState("");

  useEffect(() => {
    // Restaura o estado do Zustand a partir do localStorage após page refresh
    rehidratar();

    const u = localStorage.getItem("agendaflow_usuario");
    if (!u) { router.push("/login"); return; }

    if (u) {
      const parsed = JSON.parse(u);
      if (parsed.role !== "professional") { router.push("/login"); return; }
      setNomeUsuario(parsed.full_name || "Profissional");

      // Lê o tema do profissional usando seu ID como chave
      const idProf = parsed.id;
      const chaveTema = `agendaflow_tema_prof_${idProf}`;
      const temaSalvo = localStorage.getItem(chaveTema) as "dark" | "light" | null;
      const temaInicial = temaSalvo || "dark";
      document.documentElement.className = `theme-${temaInicial}`;
      setTemaAtual(temaInicial);
      // Persiste o padrão caso ainda não exista
      if (!temaSalvo) localStorage.setItem(chaveTema, "dark");
    }
  }, []);

  useEffect(() => {
    function check() { setIsDesktop(window.innerWidth >= 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Muda o tema do profissional — salva no localStorage e exibe toast de confirmação
  function mudarTema(novoTema: "dark" | "light") {
    const u = localStorage.getItem("agendaflow_usuario");
    if (!u) return;
    const { id } = JSON.parse(u);
    localStorage.setItem(`agendaflow_tema_prof_${id}`, novoTema);
    document.documentElement.className = `theme-${novoTema}`;
    setTemaAtual(novoTema);
    const label = novoTema === "dark" ? "Escuro" : "Claro";
    setToastTema(`Tema ${label} ativado`);
    setTimeout(() => setToastTema(""), 3000);
  }

  function handleNavegar(href: string) {
    setAbaAtiva(href);
    router.push(`/${slug}/${href}`);
    setSidebarAberta(false);
  }

  function handleLogout() { logout(); router.push("/login"); }

  const sidebarVisivel = isDesktop || sidebarAberta;
  const inicial = nomeUsuario[0]?.toUpperCase() || "P";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      fontFamily: "Inter, sans-serif",
    }}>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Nav items — glass hover */
        .nav-prof {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 12px;
          border: 1px solid transparent;
          cursor: pointer; margin-bottom: 4px;
          background: transparent;
          font-family: Inter, sans-serif;
          transition: all 0.2s ease;
          text-align: left;
        }
        .nav-prof:hover {
          background: var(--glass-bg-hover);
          border-color: var(--glass-border);
        }
        .nav-prof.ativo {
          background: linear-gradient(135deg, rgba(45,126,248,0.15), rgba(16,185,129,0.08));
          border-color: rgba(45,126,248,0.2);
          border-left: 2px solid #2D7EF8;
          box-shadow: 0 4px 16px rgba(45,126,248,0.1);
        }

        /* Logo gradiente — CSS class para evitar WebkitTextFillColor inline */
        .logo-grad-layout {
          background: linear-gradient(135deg, #2D7EF8, #10B981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Overlay mobile */}
      {sidebarAberta && !isDesktop && (
        <div
          onClick={() => setSidebarAberta(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 40,
          }}
        />
      )}

      {/* ── Sidebar glassmorphism ── */}
      <aside style={{
        position: "fixed", top: 0, left: 0,
        height: "100vh", width: "260px",
        /* Glass real: fundo semi-transparente + blur — adapta ao tema claro/escuro */
        background: "var(--bg-overlay)",
        backdropFilter: "var(--glass-blur-lg)",
        WebkitBackdropFilter: "var(--glass-blur-lg)",
        borderRight: "1px solid var(--glass-border)",
        boxShadow: "4px 0 32px rgba(0,0,0,0.25)",
        display: "flex", flexDirection: "column",
        zIndex: 50,
        transform: sidebarVisivel ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}>

        {/* Linha bicolor topo */}
        <div style={{
          height: "2px", flexShrink: 0,
          background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)",
        }} />

        {/* Logo */}
        <div style={{
          padding: "24px 22px 18px",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <h2 className="logo-grad-layout" style={{
            fontSize: "20px", fontWeight: "900",
            letterSpacing: "-0.4px", marginBottom: "4px",
          }}>
            AgendaFlow
          </h2>
          <p style={{
            color: "var(--text-muted)", fontSize: "11px",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Portal do Profissional
          </p>
        </div>

        {/* Perfil */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "12px",
            background: "linear-gradient(135deg, #2D7EF8, #10B981)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: "800", color: "white",
            flexShrink: 0,
            boxShadow: "0 4px 16px rgba(45,126,248,0.35)",
          }}>
            {inicial}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              color: "var(--text-primary)", fontSize: "13px", fontWeight: "700",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {nomeUsuario}
            </p>
            <span style={{
              display: "inline-block",
              background: "rgba(16,185,129,0.15)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: "999px", padding: "2px 8px",
              fontSize: "10px", fontWeight: "700", color: "#10B981",
              marginTop: "2px",
            }}>
              Profissional
            </span>
          </div>
        </div>

        {/* Navegação */}
        <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto" }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const ativo = abaAtiva === item.href;
            return (
              <button
                key={item.href}
                onClick={() => handleNavegar(item.href)}
                className={`nav-prof ${ativo ? "ativo" : ""}`}
              >
                <Icon size={18} color={ativo ? "#2D7EF8" : "var(--text-muted)"} />
                <span style={{
                  fontSize: "14px",
                  fontWeight: ativo ? "600" : "400",
                  color: ativo ? "var(--text-primary)" : "var(--text-muted)",
                }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{
          padding: "12px 10px",
          borderTop: "1px solid var(--border-subtle)",
        }}>
          <button
            onClick={handleLogout}
            className="nav-prof"
            style={{ marginBottom: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <LogOut size={18} color="#EF4444" />
            <span style={{ fontSize: "14px", color: "#EF4444", fontWeight: "500" }}>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Conteúdo principal ── */}
      <main style={{
        flex: 1,
        marginLeft: isDesktop ? "260px" : "0",
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        transition: "margin-left 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}>

        {/* Header glassmorphism */}
        <header style={{
          padding: "0 20px",
          height: "60px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--bg-overlay)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          borderBottom: "1px solid var(--glass-border)",
          boxShadow: "0 1px 0 rgba(45,126,248,0.08), var(--shadow-md)",
          position: "sticky", top: 0, zIndex: 30,
        }}>
          {!isDesktop ? (
            <button
              onClick={() => setSidebarAberta(!sidebarAberta)}
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: "10px", padding: "8px",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {sidebarAberta
                ? <X size={20} color="var(--text-secondary)" />
                : <Menu size={20} color="var(--text-secondary)" />
              }
            </button>
          ) : (
            <div style={{ width: "36px" }} />
          )}

          <h2 className="logo-grad-layout" style={{ fontSize: "16px", fontWeight: "800", letterSpacing: "-0.3px" }}>
            AgendaFlow
          </h2>

          {/* Tema + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SeletorTema temaAtual={temaAtual} onMudar={mudarTema} />
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #2D7EF8, #10B981)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: "700", color: "white",
              boxShadow: "0 3px 10px rgba(45,126,248,0.3)",
            }}>
              {inicial}
            </div>
          </div>
        </header>

        <div style={{ flex: 1, padding: "24px 20px", paddingBottom: "100px" }}>
          {children}
        </div>
      </main>

      {/* Toast de troca de tema */}
      {toastTema && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%",
          transform: "translateX(-50%)",
          background: "var(--bg-overlay)",
          backdropFilter: "var(--glass-blur)",
          border: "1px solid rgba(45,126,248,0.25)",
          borderRadius: "14px", padding: "10px 20px",
          color: "#2D7EF8", fontSize: "13px", fontWeight: "600",
          boxShadow: "var(--shadow-lg)",
          zIndex: 200, whiteSpace: "nowrap",
          animation: "fadeUp 0.3s ease forwards",
        }}>
          ✓ {toastTema}
        </div>
      )}
    </div>
  );
}
