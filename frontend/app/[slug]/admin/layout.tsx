"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import api from "@/lib/api";
import SeletorTema from "@/components/SeletorTema";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Package,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Users2,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "admin" },
  { label: "Agenda", icon: CalendarDays, href: "admin/agenda" },
  { label: "Profissionais", icon: Users, href: "admin/profissionais" },
  { label: "Serviços", icon: Scissors, href: "admin/servicos" },
  { label: "Produtos", icon: Package, href: "admin/produtos" },
  { label: "Financeiro", icon: DollarSign, href: "admin/financeiro" },
  { label: "Configurações", icon: Settings, href: "admin/configuracoes" },
  { label: "CRM", icon: Users2, href: "admin/crm" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const { logout, rehidratar } = useAuthStore();
  const slug = params.slug as string;

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("admin");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  // Tema do painel do admin — não afeta portal do cliente nem login
  const [temaAtual, setTemaAtual] = useState<"dark" | "light">("dark");
  // Mensagem de confirmação ao trocar o tema
  const [toastTema, setToastTema] = useState("");

  useEffect(() => {

    // Restaura o estado do Zustand a partir do localStorage após page refresh
    // (o store começa null para evitar hydration error no SSR)
    rehidratar();

    // Proteção de rota, verificação de anamnese e carregamento de tema
    async function verificar() {
      const usuarioSalvo = localStorage.getItem("agendaflow_usuario");

      if (!usuarioSalvo) { router.push("/login"); return; }

      if (usuarioSalvo) {
        const u = JSON.parse(usuarioSalvo);
        if (u.role !== "admin") { router.push("/login"); return; }
        setNomeUsuario(u.full_name || "Administrador");
      }

      // Carrega o tema do painel do admin do localStorage
      const chaveTemaPainel = `agendaflow_tema_admin_${slug}`;
      const temaSalvo = localStorage.getItem(chaveTemaPainel) as "dark" | "light" | null;
      const temaInicial = temaSalvo || "dark";
      document.documentElement.className = `theme-${temaInicial}`;
      setTemaAtual(temaInicial);
      // Garante que o valor exista no localStorage para próximas visitas
      if (!temaSalvo) localStorage.setItem(chaveTemaPainel, "dark");

      // Verifica se a anamnese foi concluída
      try {
        const r = await fetch(`http://127.0.0.1:8000/anamnese/${slug}/status`);
        const dados = await r.json();

        if (!dados.anamnese_concluida) {
          router.push(`/${slug}/onboarding`);
          return;
        }
      } catch {
        // Se falhar na verificação deixa passar — não trava o usuário
      }
    }

    verificar();
  }, [slug]);

  useEffect(() => {
    // Detecta se é desktop e monitora redimensionamento
    function verificarTamanho() {
      setIsDesktop(window.innerWidth >= 768);
    }
    verificarTamanho();
    window.addEventListener("resize", verificarTamanho);
    return () => window.removeEventListener("resize", verificarTamanho);
  }, []);

  // Muda o tema do painel do admin — salva no localStorage e exibe toast de confirmação
  function mudarTemaPainel(novoTema: "dark" | "light") {
    localStorage.setItem(`agendaflow_tema_admin_${slug}`, novoTema);
    document.documentElement.className = `theme-${novoTema}`;
    setTemaAtual(novoTema);
    const label = novoTema === "dark" ? "Escuro" : "Claro";
    setToastTema(`Tema ${label} ativado`);
    setTimeout(() => setToastTema(""), 3000);
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function handleNavegar(href: string) {
    setAbaAtiva(href);
    router.push(`/${slug}/${href}`);
    setSidebarAberta(false);
  }

  // No desktop a sidebar fica sempre visível
  const sidebarVisivel = isDesktop || sidebarAberta;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      fontFamily: "Inter, sans-serif",
    }}>

      {/* Overlay — só no mobile */}
      {sidebarAberta && !isDesktop && (
        <div
          onClick={() => setSidebarAberta(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 40,
          }}
        />
      )}

      <style>{`
        .logo-grad-admin {
          background: linear-gradient(135deg, #2D7EF8, #10B981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nav-admin {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 11px 14px; border-radius: 12px;
          border: 1px solid transparent; border-left: 2px solid transparent;
          cursor: pointer; margin-bottom: 3px;
          background: transparent;
          font-family: Inter, sans-serif;
          transition: all 0.2s ease;
          text-align: left;
        }
        .nav-admin:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.06);
        }
        .nav-admin.ativo {
          background: linear-gradient(135deg, rgba(45,126,248,0.16), rgba(16,185,129,0.08));
          border-color: rgba(45,126,248,0.22);
          border-left-color: #2D7EF8;
          box-shadow: 0 4px 16px rgba(45,126,248,0.1);
        }
        .nav-admin-sair:hover {
          background: rgba(239,68,68,0.1) !important;
          border-color: rgba(239,68,68,0.15) !important;
        }
      `}</style>

      {/* Sidebar */}
      <aside style={{
        position: "fixed", top: 0, left: 0,
        height: "100vh", width: "260px",
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

        {/* Linha bicolor no topo */}
        <div style={{
          height: "2px", flexShrink: 0,
          background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)",
        }} />

        {/* Logo */}
        <div style={{
          padding: "22px 22px 18px",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <h2 className="logo-grad-admin" style={{
            fontSize: "20px", fontWeight: "900",
            letterSpacing: "-0.4px", marginBottom: "4px",
          }}>
            AgendaFlow
          </h2>
          <p style={{
            color: "var(--text-muted)", fontSize: "11px",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Painel do Administrador
          </p>
        </div>

        {/* Perfil do admin */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
            background: "linear-gradient(135deg, #2D7EF8, #10B981)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: "800", color: "white",
            boxShadow: "0 4px 16px rgba(45,126,248,0.35)",
          }}>
            {nomeUsuario[0]?.toUpperCase() || "A"}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              color: "var(--text-primary)", fontSize: "13px", fontWeight: "700",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              marginBottom: "3px",
            }}>
              {nomeUsuario}
            </p>
            <span style={{
              display: "inline-block",
              background: "rgba(45,126,248,0.15)",
              border: "1px solid rgba(45,126,248,0.3)",
              borderRadius: "999px", padding: "2px 8px",
              fontSize: "10px", fontWeight: "700", color: "#60A5FA",
            }}>
              Administrador
            </span>
          </div>
        </div>

        {/* Menu de navegação */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const ativo = abaAtiva === item.href;
            return (
              <button
                key={item.href}
                onClick={() => handleNavegar(item.href)}
                className={`nav-admin${ativo ? " ativo" : ""}`}
              >
                <Icon size={18} color={ativo ? "#2D7EF8" : "var(--text-muted)"} strokeWidth={ativo ? 2 : 1.8} />
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
        <div style={{ padding: "10px 10px 14px", borderTop: "1px solid var(--border-subtle)" }}>
          <button
            onClick={handleLogout}
            className="nav-admin nav-admin-sair"
            style={{ marginBottom: 0 }}
          >
            <LogOut size={18} color="#EF4444" strokeWidth={1.8} />
            <span style={{ fontSize: "14px", color: "#EF4444", fontWeight: "500" }}>Sair</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main style={{
        flex: 1,
        marginLeft: isDesktop ? "260px" : "0",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
        transition: "margin-left 0.3s ease",
      }}>

        {/* Header */}
        <header style={{
          padding: "16px 20px",
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(16px)",
          position: "sticky", top: 0, zIndex: 30,
        }}>
          {/* Botão hamburger — só no mobile */}
          {!isDesktop ? (
            <button
              onClick={() => setSidebarAberta(!sidebarAberta)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px", padding: "8px",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {sidebarAberta
                ? <X size={20} color="#94A3B8" />
                : <Menu size={20} color="#94A3B8" />
              }
            </button>
          ) : (
            // Espaço vazio no lugar do botão no desktop
            <div style={{ width: "36px" }} />
          )}

          <h2 style={{
            fontSize: "16px", fontWeight: "700",
            background: "linear-gradient(135deg, #0EA5E9, #10B981)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            AgendaFlow
          </h2>

          {/* Seletor de tema do painel do admin + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <SeletorTema temaAtual={temaAtual} onMudar={mudarTemaPainel} />

            {/* Avatar */}
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #0EA5E9, #10B981)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: "700", color: "white",
            }}>
              {nomeUsuario[0]?.toUpperCase() || "A"}
            </div>
          </div>
        </header>

        {/* Conteúdo da página */}
        <div style={{ flex: 1, padding: "24px 20px", paddingBottom: "100px", background: "var(--bg-base)" }}>
          {children}
        </div>
      </main>

      {/* Toast de confirmação de troca de tema */}
      {toastTema && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(13,17,23,0.95)",
          border: "1px solid rgba(45,126,248,0.3)",
          borderRadius: "12px", padding: "10px 20px",
          color: "#93C5FD", fontSize: "13px", fontWeight: "600",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
          zIndex: 200,
          whiteSpace: "nowrap",
          animation: "fadeUp 0.3s ease forwards",
        }}>
          ✓ {toastTema}
        </div>
      )}
    </div>
  );
}
