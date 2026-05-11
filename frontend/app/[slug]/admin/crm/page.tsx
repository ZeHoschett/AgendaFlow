"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Users2, X, FileDown, Filter, AlertTriangle, Plus, BarChart2,
  TrendingUp, UserCheck, Clock, MessageSquare, Scissors, Star,
} from "lucide-react";
import api from "@/lib/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DashboardCRM {
  total_clientes_unicos: number;
  novos_este_mes: number;
  voltaram_este_mes: number;
  taxa_retorno_percentual: number;
  frequentes: number;
  regulares: number;
  em_risco: number;
}

interface ClienteCRM {
  client_phone: string;
  client_name: string;
  total_agendamentos: number;
  agendamentos_90_dias: number;
  ultimo_agendamento: string;
  primeiro_agendamento: string;
  dias_desde_ultimo: number;
  ticket_medio: number;
  grupo: string;
  servico_favorito: string | null;
  profissional_favorito: string | null;
  profissional_favorito_id: string | null;
  total_profissionais_distintos: number;
}

interface PerfilCliente extends ClienteCRM {
  total_gasto: number;
  servicos_frequentes: { name: string; total: number }[];
  profissionais_frequentes: { full_name: string; total: number }[];
  historico: {
    id: string;
    scheduled_date: string;
    scheduled_time: string;
    status: string;
    servico: string;
    valor: number;
    profissional: string;
  }[];
  notas: { id: string; note: string; created_at: string }[];
}

interface Profissional {
  id: string;
  full_name: string;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

const COR_GRUPO: Record<string, { bg: string; border: string; text: string; left: string }> = {
  Frequente:  { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  text: "#10B981",           left: "rgba(16,185,129,0.5)"  },
  Regular:    { bg: "rgba(45,126,248,0.12)",   border: "rgba(45,126,248,0.25)",   text: "#60A5FA",           left: "rgba(45,126,248,0.5)"  },
  "Em Risco": { bg: "rgba(244,187,17,0.12)",   border: "rgba(244,187,17,0.25)",   text: "#f4bb11",           left: "rgba(244,187,17,0.5)"  },
};

const COR_STATUS: Record<string, string> = {
  completed:   "#10B981",
  confirmed:   "#2D7EF8",
  cancelled:   "#EF4444",
  pending:     "#f4bb11",
  in_progress: "#7C3AED",
};

function formatarData(data: string): string {
  if (!data) return "-";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarTelefone(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone || "";
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SkeletonCards({ n = 3 }: { n?: number }) {
  return (
    <>
      <style>{`@keyframes sk-pulse{0%,100%{opacity:.3}50%{opacity:.65}}`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-lg)",
            height: "76px",
            animation: "sk-pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }} />
        ))}
      </div>
    </>
  );
}

function BannerErro({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)",
      borderLeft: "3px solid rgba(239,68,68,0.6)",
      borderRadius: "var(--radius-lg)", padding: "14px 18px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
    }}>
      <p style={{ color: "#FCA5A5", fontSize: "13px" }}>{msg}</p>
      <button onClick={onRetry} style={{
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: "10px", padding: "6px 14px",
        color: "#FCA5A5", fontSize: "12px", fontWeight: "700",
        cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif", flexShrink: 0,
      }}>
        Tentar novamente
      </button>
    </div>
  );
}

function BadgeGrupo({ grupo }: { grupo: string }) {
  const cor = COR_GRUPO[grupo] || COR_GRUPO["Em Risco"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: cor.bg, border: `1px solid ${cor.border}`,
      borderRadius: "999px", padding: "3px 10px",
      color: cor.text, fontSize: "11px", fontWeight: "700",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {grupo}
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Aba = "visao-geral" | "clientes";

export default function CRMPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [abaAtiva, setAbaAtiva] = useState<Aba>("visao-geral");

  const [dashboard, setDashboard] = useState<DashboardCRM | null>(null);
  const [carregandoDash, setCarregandoDash] = useState(true);
  const [erroDash, setErroDash] = useState<string | null>(null);

  const [clientes, setClientes] = useState<ClienteCRM[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [erroClientes, setErroClientes] = useState<string | null>(null);
  const [clientesCarregados, setClientesCarregados] = useState(false);

  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroProfissional, setFiltroProfissional] = useState("");
  const [filtroDias, setFiltroDias] = useState("");
  const [filtroTicketMin, setFiltroTicketMin] = useState("");
  const [filtroTicketMax, setFiltroTicketMax] = useState("");

  const [perfilAberto, setPerfilAberto] = useState<PerfilCliente | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const [novaNota, setNovaNota] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [erroNota, setErroNota] = useState("");

  const [exportando, setExportando] = useState(false);

  useEffect(() => { carregarDashboard(); }, []);

  useEffect(() => {
    if (abaAtiva === "clientes" && !clientesCarregados) {
      carregarClientes();
      carregarProfissionais();
    }
  }, [abaAtiva]);

  async function carregarDashboard() {
    setCarregandoDash(true);
    setErroDash(null);
    try {
      const r = await api.get(`/crm/${slug}/dashboard`, { timeout: 30000 });
      setDashboard(r.data);
    } catch {
      setErroDash("Não foi possível carregar as métricas. Tente novamente.");
    } finally {
      setCarregandoDash(false);
    }
  }

  async function carregarClientes(filtros?: Record<string, string>) {
    setCarregandoClientes(true);
    setErroClientes(null);
    try {
      const r = await api.get(`/crm/${slug}/clientes`, { params: filtros, timeout: 30000 });
      setClientes(r.data);
      setClientesCarregados(true);
    } catch {
      setErroClientes("Não foi possível carregar os clientes. Tente novamente.");
    } finally {
      setCarregandoClientes(false);
    }
  }

  async function carregarProfissionais() {
    try {
      const r = await api.get(`/professionals/${slug}`, { timeout: 15000 });
      setProfissionais(r.data);
    } catch {
      // Silencia — filtro fica sem opções extras
    }
  }

  function aplicarFiltros() {
    const p: Record<string, string> = {};
    if (filtroGrupo) p.grupo = filtroGrupo;
    if (filtroProfissional === "__sem_preferencia__") {
      p.sem_preferencia_profissional = "true";
    } else if (filtroProfissional) {
      p.profissional_id = filtroProfissional;
    }
    if (filtroDias) p.dias_sem_aparecer = filtroDias;
    if (filtroTicketMin) p.ticket_minimo = filtroTicketMin;
    if (filtroTicketMax) p.ticket_maximo = filtroTicketMax;
    carregarClientes(p);
  }

  function limparFiltros() {
    setFiltroGrupo("");
    setFiltroProfissional("");
    setFiltroDias("");
    setFiltroTicketMin("");
    setFiltroTicketMax("");
    carregarClientes();
  }

  async function abrirPerfil(phone: string) {
    setCarregandoPerfil(true);
    setNovaNota("");
    setErroNota("");
    try {
      const r = await api.get(`/crm/${slug}/clientes/${phone}`, { timeout: 30000 });
      setPerfilAberto(r.data);
    } catch {
      // Não abre modal se a busca falhar
    } finally {
      setCarregandoPerfil(false);
    }
  }

  async function adicionarNota() {
    if (!perfilAberto || !novaNota.trim()) return;
    setErroNota("");
    setSalvandoNota(true);
    try {
      await api.post(`/crm/${slug}/notas`, {
        client_phone: perfilAberto.client_phone,
        client_name: perfilAberto.client_name,
        note: novaNota.trim(),
      });
      const r = await api.get(`/crm/${slug}/clientes/${perfilAberto.client_phone}`, { timeout: 30000 });
      setPerfilAberto(r.data);
      setNovaNota("");
    } catch {
      setErroNota("Não foi possível salvar a nota. Tente novamente.");
    } finally {
      setSalvandoNota(false);
    }
  }

  async function exportarPDF() {
    setExportando(true);
    try {
      const r = await api.get(`/crm/${slug}/exportar`, { timeout: 30000 });
      const dados = r.data;

      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const larg = doc.internal.pageSize.getWidth();

      const fundo:    [number, number, number] = [8,  12,  20];
      const glassBg:  [number, number, number] = [15, 23,  42];
      const glassHd:  [number, number, number] = [20, 30,  50];
      const glassLn:  [number, number, number] = [30, 41,  59];
      const azul:     [number, number, number] = [45, 126, 248];
      const verde:    [number, number, number] = [16, 185, 129];
      const claro:    [number, number, number] = [248, 250, 252];
      const muted:    [number, number, number] = [100, 116, 139];

      // ── Capa ──
      doc.setFillColor(...fundo);  doc.rect(0, 0, larg, 297, "F");
      doc.setFillColor(...azul);   doc.rect(0, 0, larg, 2,   "F");
      doc.setTextColor(...azul);   doc.setFontSize(28); doc.setFont("helvetica", "bold");
      doc.text("AgendaFlow", larg / 2, 80, { align: "center" });
      doc.setTextColor(...claro);  doc.setFontSize(20);
      doc.text("Relatório CRM", larg / 2, 95, { align: "center" });
      doc.setFillColor(...glassBg);
      doc.roundedRect(20, 108, larg - 40, 40, 4, 4, "F");
      doc.setTextColor(...muted);  doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text("Estabelecimento", larg / 2, 122, { align: "center" });
      doc.setTextColor(...claro);  doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(dados.estabelecimento, larg / 2, 133, { align: "center" });
      doc.setTextColor(...muted);  doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Data: ${formatarData(dados.data_exportacao)}  ·  Clientes: ${dados.clientes.length}`, larg / 2, 163, { align: "center" });
      doc.text("Powered by KronumTech", larg / 2, 280, { align: "center" });

      // ── Métricas ──
      doc.addPage();
      doc.setFillColor(...fundo); doc.rect(0, 0, larg, 297, "F");
      doc.setFillColor(...azul);  doc.rect(0, 0, larg, 2,   "F");
      doc.setTextColor(...claro); doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text("Dashboard — Métricas de Retenção", 20, 25);
      if (dashboard) {
        autoTable(doc, {
          startY: 35,
          head: [["Métrica", "Valor"]],
          body: [
            ["Total de Clientes Únicos",             String(dashboard.total_clientes_unicos)],
            ["Frequentes (4+ agend./90 dias)",        String(dashboard.frequentes)],
            ["Regulares (2–3 agend./90 dias)",        String(dashboard.regulares)],
            ["Em Risco (45+ dias sem aparecer)",      String(dashboard.em_risco)],
            ["Novos Este Mês",                        String(dashboard.novos_este_mes)],
            ["Voltaram Este Mês",                     String(dashboard.voltaram_este_mes)],
            ["Taxa de Retorno",                       `${dashboard.taxa_retorno_percentual}%`],
          ],
          theme: "plain",
          styles:      { fillColor: glassBg, textColor: claro,   fontSize: 10, lineColor: glassLn, lineWidth: 0.3 },
          headStyles:  { fillColor: glassHd, textColor: azul,    fontStyle: "bold" },
          columnStyles:{ 0: { cellWidth: 120 }, 1: { cellWidth: 40, halign: "right", textColor: verde } },
        });
      }

      // ── Lista de clientes ──
      doc.addPage();
      doc.setFillColor(...fundo); doc.rect(0, 0, larg, 297, "F");
      doc.setFillColor(...azul);  doc.rect(0, 0, larg, 2,   "F");
      doc.setTextColor(...claro); doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text("Lista de Clientes", 20, 25);
      type ItemExp = { nome: string; telefone: string; grupo: string; total_agendamentos: number; ultimo_agendamento: string; servico_favorito: string; ticket_medio: number };
      autoTable(doc, {
        startY: 35,
        head: [["Nome", "Telefone", "Grupo", "Agend.", "Último", "Serviço Fav.", "Ticket Méd."]],
        body: dados.clientes.map((c: ItemExp) => [
          c.nome, formatarTelefone(c.telefone), c.grupo,
          String(c.total_agendamentos), formatarData(c.ultimo_agendamento),
          c.servico_favorito, formatarMoeda(c.ticket_medio),
        ]),
        theme: "plain",
        styles:     { fillColor: glassBg, textColor: claro, fontSize: 7, lineColor: glassLn, lineWidth: 0.2, cellPadding: 2 },
        headStyles: { fillColor: glassHd, textColor: azul,  fontStyle: "bold", fontSize: 7 },
        didDrawPage: () => {
          doc.setFillColor(...fundo); doc.rect(0, 0, larg, 297, "F");
          doc.setFillColor(...azul);  doc.rect(0, 0, larg, 2,   "F");
        },
      });

      doc.save(`crm-${slug}-${dados.data_exportacao}.pdf`);
    } catch {
      // Não bloqueia a UI
    } finally {
      setExportando(false);
    }
  }

  const inputBase: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--glass-border)",
    borderRadius: "12px", padding: "12px 14px",
    color: "var(--text-primary)", fontSize: "13px",
    fontFamily: "Inter, sans-serif", outline: "none",
    boxSizing: "border-box",
  };

  return (
    <>
      <style>{`
        .crm-title-grad {
          background: linear-gradient(135deg, #E8F0FF 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        html.theme-light .crm-title-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .crm-cliente-card {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: background 0.2s, border-color 0.2s;
        }
        .crm-cliente-card:hover {
          background: var(--glass-bg-hover);
        }
        .crm-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 200;
          padding: 0 12px;
        }
        @media (min-width: 640px) {
          .crm-modal-overlay {
            align-items: center;
            padding: 20px;
          }
          .crm-modal-content {
            border-radius: 28px !important;
            max-width: 480px;
            width: 100%;
          }
        }
        .crm-modal-content {
          background: var(--bg-overlay);
          backdrop-filter: var(--glass-blur-lg);
          -webkit-backdrop-filter: var(--glass-blur-lg);
          border: 1px solid var(--glass-border);
          border-radius: 28px 28px 20px 20px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px 20px;
          padding-bottom: env(safe-area-inset-bottom, 40px);
          box-sizing: border-box;
          position: relative;
        }
        .crm-label {
          display: block;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }
      `}</style>

      <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── Cabeçalho ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 className="crm-title-grad" style={{
              fontSize: "24px", fontWeight: "800",
              letterSpacing: "-0.5px", marginBottom: "4px",
            }}>
              CRM
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Central de Relacionamento com Clientes
            </p>
          </div>
          <button
            onClick={exportarPDF}
            disabled={exportando}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 18px", borderRadius: "12px",
              background: "rgba(45,126,248,0.1)", border: "1px solid rgba(45,126,248,0.25)",
              color: "#93C5FD", fontSize: "13px", fontWeight: "700",
              cursor: "pointer", fontFamily: "Inter, sans-serif",
              opacity: exportando ? 0.7 : 1, transition: "opacity 0.2s",
              flexShrink: 0,
            }}
          >
            <FileDown size={15} />
            {exportando ? "Gerando..." : "Exportar PDF"}
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: "4px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--glass-border)",
          borderRadius: "16px",
          padding: "4px",
        }}>
          {([
            { id: "visao-geral", label: "Visão Geral",  icon: BarChart2 },
            { id: "clientes",    label: "Clientes",     icon: Users2    },
          ] as { id: Aba; label: string; icon: React.ElementType }[]).map((tab) => {
            const ativo = abaAtiva === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "8px", padding: "11px 14px",
                  borderRadius: "12px", border: "none",
                  background: ativo ? "rgba(45,126,248,0.15)" : "transparent",
                  color: ativo ? "#93C5FD" : "var(--text-muted)",
                  fontSize: "13px", fontWeight: ativo ? "700" : "500",
                  fontFamily: "Inter, sans-serif", cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: ativo ? "0 0 16px rgba(45,126,248,0.1)" : "none",
                  borderBottom: ativo ? "2px solid #2D7EF8" : "2px solid transparent",
                }}
              >
                <Icon size={15} />
                {tab.label}
                {tab.id === "clientes" && clientes.length > 0 && (
                  <span style={{
                    background: "rgba(45,126,248,0.2)", borderRadius: "999px",
                    padding: "1px 7px", fontSize: "10px", fontWeight: "700", color: "#93C5FD",
                  }}>
                    {clientes.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            ABA — VISÃO GERAL
        ══════════════════════════════════════════════════════════════ */}
        {abaAtiva === "visao-geral" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {carregandoDash && <SkeletonCards n={6} />}
            {erroDash && <BannerErro msg={erroDash} onRetry={carregarDashboard} />}

            {dashboard && (
              <>
                {/* KPI Cards */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: "10px",
                }}>
                  {[
                    { label: "Total de Clientes", valor: dashboard.total_clientes_unicos, cor: "#60A5FA",  bg: "rgba(45,126,248,0.08)",  icon: <Users2 size={16} color="#60A5FA" /> },
                    { label: "Frequentes",         valor: dashboard.frequentes,            cor: "#10B981",  bg: "rgba(16,185,129,0.08)",  icon: <Star size={16} color="#10B981" /> },
                    { label: "Regulares",          valor: dashboard.regulares,             cor: "#60A5FA",  bg: "rgba(45,126,248,0.08)",  icon: <UserCheck size={16} color="#60A5FA" /> },
                    { label: "Em Risco",           valor: dashboard.em_risco,              cor: "#f4bb11",  bg: "rgba(244,187,17,0.08)",  icon: <AlertTriangle size={16} color="#f4bb11" /> },
                    { label: "Novos Este Mês",     valor: dashboard.novos_este_mes,        cor: "#A78BFA",  bg: "rgba(167,139,250,0.08)", icon: <TrendingUp size={16} color="#A78BFA" /> },
                    { label: "Taxa de Retorno",    valor: `${dashboard.taxa_retorno_percentual}%`, cor: "#10B981", bg: "rgba(16,185,129,0.08)", icon: <TrendingUp size={16} color="#10B981" /> },
                  ].map((kpi) => (
                    <div key={kpi.label} className="kpi-card" style={{ textAlign: "center", padding: "16px 10px" }}>
                      <div style={{
                        width: "34px", height: "34px", borderRadius: "10px",
                        background: kpi.bg, display: "flex", alignItems: "center",
                        justifyContent: "center", margin: "0 auto 8px",
                      }}>
                        {kpi.icon}
                      </div>
                      <p style={{ fontSize: "22px", fontWeight: "800", color: kpi.cor, marginBottom: "4px", lineHeight: 1 }}>
                        {kpi.valor}
                      </p>
                      <p style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {kpi.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Alerta em risco */}
                {dashboard.em_risco > 0 && (
                  <div style={{
                    background: "rgba(244,187,17,0.06)", border: "1px solid rgba(244,187,17,0.2)",
                    borderLeft: "3px solid rgba(244,187,17,0.6)",
                    borderRadius: "var(--radius-lg)", padding: "14px 18px",
                    display: "flex", alignItems: "center", gap: "12px",
                  }}>
                    <AlertTriangle size={18} color="#f4bb11" style={{ flexShrink: 0 }} />
                    <p style={{ color: "#f4bb11", fontSize: "13px", fontWeight: "600", flex: 1 }}>
                      {dashboard.em_risco} cliente{dashboard.em_risco > 1 ? "s" : ""} em risco — baixa frequência ou ausência prolongada.
                    </p>
                    <button
                      onClick={() => setAbaAtiva("clientes")}
                      style={{
                        flexShrink: 0,
                        background: "rgba(244,187,17,0.1)", border: "1px solid rgba(244,187,17,0.25)",
                        borderRadius: "10px", padding: "5px 12px",
                        color: "#f4bb11", fontSize: "11px", fontWeight: "700",
                        cursor: "pointer", fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Ver clientes
                    </button>
                  </div>
                )}

                {/* Distribuição de grupos */}
                <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", top: 0, left: "20%", right: "20%",
                    height: "2px", background: "linear-gradient(90deg, #10B981, #2D7EF8, #f4bb11)",
                    zIndex: 1,
                  }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "10px",
                      background: "rgba(45,126,248,0.12)", border: "1px solid rgba(45,126,248,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <BarChart2 size={16} color="#2D7EF8" />
                    </div>
                    <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>
                      Distribuição da base
                    </p>
                  </div>
                  {[
                    { label: "Frequentes",  valor: dashboard.frequentes,  total: dashboard.total_clientes_unicos, cor: "#10B981" },
                    { label: "Regulares",   valor: dashboard.regulares,   total: dashboard.total_clientes_unicos, cor: "#60A5FA" },
                    { label: "Em Risco",    valor: dashboard.em_risco,    total: dashboard.total_clientes_unicos, cor: "#f4bb11" },
                  ].map((g) => {
                    const pct = g.total > 0 ? Math.round((g.valor / g.total) * 100) : 0;
                    return (
                      <div key={g.label} style={{ marginBottom: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: "600" }}>{g.label}</span>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{g.valor} <span style={{ color: g.cor, fontWeight: "700" }}>({pct}%)</span></span>
                        </div>
                        <div style={{
                          height: "6px", borderRadius: "999px",
                          background: "rgba(255,255,255,0.06)", overflow: "hidden",
                        }}>
                          <div style={{
                            height: "100%", borderRadius: "999px",
                            width: `${pct}%`, background: g.cor,
                            transition: "width 0.6s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Novos / Voltaram */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: "10px",
                }}>
                  {[
                    { label: "Novos Este Mês",   valor: dashboard.novos_este_mes,    sub: "1ª visita no mês",     cor: "#A78BFA", bg: "rgba(167,139,250,0.08)", icon: <TrendingUp size={18} color="#A78BFA" /> },
                    { label: "Voltaram",          valor: dashboard.voltaram_este_mes, sub: "retorno mês anterior", cor: "#10B981", bg: "rgba(16,185,129,0.08)",  icon: <UserCheck size={18} color="#10B981" /> },
                  ].map((item) => (
                    <div key={item.label} className="glass-card" style={{ padding: "18px" }}>
                      <div style={{
                        width: "38px", height: "38px", borderRadius: "10px",
                        background: item.bg, display: "flex", alignItems: "center",
                        justifyContent: "center", marginBottom: "12px",
                      }}>
                        {item.icon}
                      </div>
                      <p style={{ fontSize: "26px", fontWeight: "800", color: item.cor, marginBottom: "4px", lineHeight: 1 }}>
                        {item.valor}
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: "600", marginBottom: "2px" }}>
                        {item.label}
                      </p>
                      <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.sub}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            ABA — CLIENTES
        ══════════════════════════════════════════════════════════════ */}
        {abaAtiva === "clientes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Filtros */}
            <div className="glass-card" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%",
                height: "2px", background: "linear-gradient(90deg, #2D7EF8, #10B981)",
                zIndex: 1,
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "10px",
                  background: "rgba(45,126,248,0.12)", border: "1px solid rgba(45,126,248,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Filter size={16} color="#2D7EF8" />
                </div>
                <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>Filtros</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label className="crm-label">Grupo</label>
                  <select value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}
                    style={{ ...inputBase, appearance: "none", cursor: "pointer" }}>
                    <option value="">Todos os grupos</option>
                    <option value="Frequente">Frequente</option>
                    <option value="Regular">Regular</option>
                    <option value="Em Risco">Em Risco</option>
                  </select>
                </div>

                <div>
                  <label className="crm-label">Profissional</label>
                  <select value={filtroProfissional} onChange={(e) => setFiltroProfissional(e.target.value)}
                    style={{ ...inputBase, appearance: "none", cursor: "pointer" }}>
                    <option value="">Todos</option>
                    <option value="__sem_preferencia__">Sem preferência definida (2+ profissionais)</option>
                    {profissionais.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="crm-label">Dias sem aparecer (mínimo)</label>
                  <input type="number" placeholder="Ex: 30" value={filtroDias}
                    onChange={(e) => setFiltroDias(e.target.value)} style={inputBase} min="0" />
                </div>

                <div>
                  <label className="crm-label">Ticket mínimo (R$)</label>
                  <input type="number" placeholder="Ex: 50" value={filtroTicketMin}
                    onChange={(e) => setFiltroTicketMin(e.target.value)} style={inputBase} min="0" />
                </div>

                <div>
                  <label className="crm-label">Ticket máximo (R$)</label>
                  <input type="number" placeholder="Ex: 200" value={filtroTicketMax}
                    onChange={(e) => setFiltroTicketMax(e.target.value)} style={inputBase} min="0" />
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "16px", marginTop: "16px", display: "flex", gap: "10px" }}>
                <button onClick={aplicarFiltros} className="btn-primary" style={{ flex: 1, padding: "12px" }}>
                  Aplicar Filtros
                </button>
                <button onClick={limparFiltros} className="btn-secondary" style={{ flex: 1, padding: "12px" }}>
                  Limpar
                </button>
              </div>
            </div>

            {carregandoClientes && <SkeletonCards n={4} />}
            {erroClientes && <BannerErro msg={erroClientes} onRetry={() => carregarClientes()} />}

            {/* Estado vazio */}
            {!carregandoClientes && !erroClientes && clientesCarregados && clientes.length === 0 && (
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
                  <Users2 size={24} color="#2D7EF8" />
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  Nenhum cliente encontrado.
                </p>
              </div>
            )}

            {/* Lista de clientes */}
            {clientes.length > 0 && !carregandoClientes && (
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "10px", fontWeight: "600" }}>
                  {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} encontrado{clientes.length !== 1 ? "s" : ""}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {clientes.map((c) => {
                    const corGrupo = COR_GRUPO[c.grupo] || COR_GRUPO["Em Risco"];
                    return (
                      <div
                        key={c.client_phone}
                        className="crm-cliente-card"
                        style={{ borderLeft: `3px solid ${corGrupo.left}` }}
                      >
                        {/* Linha 1 — avatar + nome + badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {/* Avatar com inicial */}
                          <div style={{
                            width: "44px", height: "44px", borderRadius: "50%",
                            background: corGrupo.bg,
                            border: `1px solid ${corGrupo.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "16px", fontWeight: "800", color: corGrupo.text,
                            flexShrink: 0,
                          }}>
                            {c.client_name[0].toUpperCase()}
                          </div>
                          {/* Nome + telefone */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              color: "var(--text-primary)", fontSize: "15px", fontWeight: "700", marginBottom: "2px",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {c.client_name}
                            </p>
                            <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                              {formatarTelefone(c.client_phone)}
                            </p>
                          </div>
                          {/* Badge grupo */}
                          <BadgeGrupo grupo={c.grupo} />
                        </div>

                        {/* Linha 2 — métricas */}
                        <div style={{
                          display: "flex", flexWrap: "wrap", gap: "6px",
                          paddingLeft: "56px",
                        }}>
                          <span style={{
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "8px", padding: "4px 10px",
                            fontSize: "12px", color: "var(--text-muted)",
                          }}>
                            <span style={{ color: "var(--text-primary)", fontWeight: "700" }}>{c.total_agendamentos}</span> agend.
                          </span>
                          <span style={{
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "8px", padding: "4px 10px",
                            fontSize: "12px", color: "var(--text-muted)",
                          }}>
                            Último: <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{formatarData(c.ultimo_agendamento)}</span>
                          </span>
                          {c.servico_favorito && (
                            <span style={{
                              background: "rgba(45,126,248,0.06)", border: "1px solid rgba(45,126,248,0.12)",
                              borderRadius: "8px", padding: "4px 10px",
                              fontSize: "12px", color: "#93C5FD", fontWeight: "600",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              maxWidth: "160px",
                            }}>
                              {c.servico_favorito}
                            </span>
                          )}
                          <span style={{
                            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)",
                            borderRadius: "8px", padding: "4px 10px",
                            fontSize: "12px", color: "#10B981", fontWeight: "700",
                          }}>
                            {formatarMoeda(c.ticket_medio)}
                          </span>
                        </div>

                        {/* Botão ver perfil */}
                        <button
                          onClick={() => abrirPerfil(c.client_phone)}
                          disabled={carregandoPerfil}
                          style={{
                            width: "100%", padding: "10px",
                            borderRadius: "12px", border: "1px solid var(--glass-border)",
                            background: "rgba(255,255,255,0.04)",
                            color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600",
                            fontFamily: "Inter, sans-serif", cursor: "pointer",
                            opacity: carregandoPerfil ? 0.7 : 1,
                            transition: "background 0.2s",
                          }}
                        >
                          Ver Perfil
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal — Perfil do cliente ──────────────────────────────────── */}
      {perfilAberto && (
        <div
          className="crm-modal-overlay"
          onClick={() => setPerfilAberto(null)}
        >
          <div
            className="crm-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Linha decorativa bicolor no topo */}
            <div style={{
              position: "absolute", top: 0, left: "20%", right: "20%",
              height: "2px",
              background: "linear-gradient(90deg, #2D7EF8, #10B981)",
              borderRadius: "0 0 4px 4px",
            }} />

            {/* Drag handle */}
            <div style={{
              width: "36px", height: "4px",
              background: "rgba(255,255,255,0.15)", borderRadius: "999px",
              margin: "0 auto 20px",
            }} />

            {/* Cabeçalho do modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                {/* Avatar */}
                <div style={{
                  width: "48px", height: "48px", borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(45,126,248,0.3), rgba(16,185,129,0.2))",
                  border: "1px solid rgba(45,126,248,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", fontWeight: "800", color: "#93C5FD",
                  flexShrink: 0, boxShadow: "0 0 20px rgba(45,126,248,0.2)",
                }}>
                  {perfilAberto.client_name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <h2 style={{
                      color: "var(--text-primary)", fontSize: "17px", fontWeight: "800",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {perfilAberto.client_name}
                    </h2>
                    <BadgeGrupo grupo={perfilAberto.grupo} />
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "2px" }}>
                    {formatarTelefone(perfilAberto.client_phone)}
                  </p>
                  <p style={{ color: "#10B981", fontSize: "14px", fontWeight: "700" }}>
                    {formatarMoeda(perfilAberto.total_gasto)} gastos no total
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPerfilAberto(null)}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px", padding: "8px", cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            {/* Métricas 2×2 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "20px" }}>
              {[
                { label: "Total de Agend.",   valor: String(perfilAberto.total_agendamentos),          cor: "#2D7EF8",  bg: "rgba(45,126,248,0.08)",   bd: "rgba(45,126,248,0.15)"   },
                { label: "Ticket Médio",      valor: formatarMoeda(perfilAberto.ticket_medio),          cor: "#10B981",  bg: "rgba(16,185,129,0.08)",   bd: "rgba(16,185,129,0.15)"   },
                { label: "Cliente desde",     valor: formatarData(perfilAberto.primeiro_agendamento),   cor: "#A78BFA",  bg: "rgba(167,139,250,0.08)",  bd: "rgba(167,139,250,0.15)"  },
                { label: "Dias sem aparecer", valor: `${perfilAberto.dias_desde_ultimo}d`,              cor: "#f4bb11",  bg: "rgba(244,187,17,0.08)",   bd: "rgba(244,187,17,0.15)"   },
              ].map((m) => (
                <div key={m.label} style={{
                  background: m.bg, border: `1px solid ${m.bd}`,
                  borderRadius: "12px", padding: "14px", textAlign: "center",
                }}>
                  <p style={{ color: m.cor, fontSize: "17px", fontWeight: "800", marginBottom: "4px", lineHeight: 1 }}>
                    {m.valor}
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</p>
                </div>
              ))}
            </div>

            {/* Serviços frequentes */}
            {perfilAberto.servicos_frequentes.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <Scissors size={14} color="#2D7EF8" />
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Serviços mais frequentes
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {perfilAberto.servicos_frequentes.map((s, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "rgba(45,126,248,0.05)", border: "1px solid rgba(45,126,248,0.1)",
                      borderLeft: "3px solid rgba(45,126,248,0.4)",
                      borderRadius: "10px", padding: "10px 14px",
                    }}>
                      <span style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: "500" }}>{s.name}</span>
                      <span style={{
                        background: "rgba(45,126,248,0.15)", border: "1px solid rgba(45,126,248,0.25)",
                        borderRadius: "999px", padding: "2px 10px",
                        color: "#93C5FD", fontSize: "11px", fontWeight: "700",
                      }}>{s.total}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profissionais preferidos */}
            {perfilAberto.profissionais_frequentes.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <Star size={14} color="#10B981" />
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Profissionais preferidos
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {perfilAberto.profissionais_frequentes.map((p, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)",
                      borderLeft: "3px solid rgba(16,185,129,0.4)",
                      borderRadius: "10px", padding: "10px 14px",
                    }}>
                      <span style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: "500" }}>{p.full_name}</span>
                      <span style={{
                        background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)",
                        borderRadius: "999px", padding: "2px 10px",
                        color: "#6EE7B7", fontSize: "11px", fontWeight: "700",
                      }}>{p.total}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico */}
            {perfilAberto.historico.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <Clock size={14} color="var(--text-muted)" />
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Histórico de agendamentos
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {perfilAberto.historico.map((h) => {
                    const corStatus = COR_STATUS[h.status] || "#60A5FA";
                    return (
                      <div key={h.id} style={{
                        background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                        borderLeft: `3px solid ${corStatus}60`,
                        borderRadius: "10px", padding: "12px 14px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              color: "var(--text-primary)", fontSize: "13px", fontWeight: "600", marginBottom: "2px",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {h.servico}
                            </p>
                            <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                              {h.profissional} · {h.scheduled_date} às {h.scheduled_time}
                            </p>
                          </div>
                          <p style={{ color: "#10B981", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
                            {formatarMoeda(Number(h.valor))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notas */}
            <div style={{
              background: "rgba(45,126,248,0.04)",
              border: "1px solid rgba(45,126,248,0.12)",
              borderRadius: "16px", padding: "16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <div style={{
                  width: "30px", height: "30px", borderRadius: "8px",
                  background: "rgba(45,126,248,0.15)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <MessageSquare size={14} color="#93C5FD" />
                </div>
                <p style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                  Notas do Cliente
                </p>
              </div>

              {/* Formulário de nova nota */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                <textarea
                  placeholder="Escreva uma observação sobre este cliente..."
                  value={novaNota}
                  onChange={(e) => setNovaNota(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "12px", padding: "12px 14px",
                    color: "var(--text-primary)", fontSize: "13px", lineHeight: "1.6",
                    fontFamily: "Inter, sans-serif", outline: "none",
                    resize: "none", boxSizing: "border-box",
                  }}
                />
                {erroNota && (
                  <p style={{ color: "#FCA5A5", fontSize: "12px" }}>{erroNota}</p>
                )}
                <button
                  onClick={adicionarNota}
                  disabled={salvandoNota || !novaNota.trim()}
                  style={{
                    width: "100%", padding: "13px",
                    borderRadius: "14px", border: "none",
                    background: "linear-gradient(135deg, #2D7EF8, #1A5FCC)",
                    color: "#fff", fontSize: "14px", fontWeight: "700",
                    fontFamily: "Inter, sans-serif",
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: "8px",
                    opacity: (salvandoNota || !novaNota.trim()) ? 0.5 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  <Plus size={15} />
                  {salvandoNota ? "Salvando..." : "Adicionar Nota"}
                </button>
              </div>

              {/* Divisor */}
              <div style={{ height: "1px", background: "rgba(45,126,248,0.15)", marginBottom: "14px" }} />

              {/* Lista de notas */}
              {perfilAberto.notas.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {perfilAberto.notas.map((n) => (
                    <div key={n.id} style={{
                      background: "rgba(45,126,248,0.06)", border: "1px solid rgba(45,126,248,0.15)",
                      borderLeft: "3px solid rgba(45,126,248,0.5)",
                      borderRadius: "12px", padding: "14px 16px",
                    }}>
                      <p style={{
                        color: "var(--text-primary)", fontSize: "13px",
                        lineHeight: "1.6", marginBottom: "10px",
                      }}>
                        {n.note}
                      </p>
                      <p style={{
                        color: "var(--text-muted)", fontSize: "11px",
                        textAlign: "right", borderTop: "1px solid rgba(45,126,248,0.1)",
                        paddingTop: "8px",
                      }}>
                        {n.created_at}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "10px",
                    background: "rgba(45,126,248,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 10px",
                  }}>
                    <MessageSquare size={18} color="#93C5FD40" />
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "4px" }}>
                    Nenhuma nota registrada
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: "11px", opacity: 0.6 }}>
                    Use o campo acima para registrar observações
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
