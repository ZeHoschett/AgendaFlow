"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, X, Package, AlertTriangle, Pencil, Check } from "lucide-react";
import api from "@/lib/api";

interface Produto {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  category_order: number;
  is_active: boolean;
}

function SkeletonCards() {
  return (
    <>
      <style>{`@keyframes sk-pulse{0%,100%{opacity:.3}50%{opacity:.65}}`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-lg)", height: "72px",
            animation: "sk-pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }} />
        ))}
      </div>
    </>
  );
}

export default function ProdutosPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Estado do modal de edição
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCategoria, setEditCategoria] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editPreco, setEditPreco] = useState("");
  const [editEstoque, setEditEstoque] = useState("0");
  const [erroEdicao, setErroEdicao] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => { carregarProdutos(); }, []);

  async function carregarProdutos() {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const r = await api.get(`/products/${slug}`, { timeout: 30000 });
      setProdutos(r.data);
    } catch {
      setErroCarregamento("Não foi possível carregar os produtos. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setSalvando(true);
    try {
      await api.post(`/products/${slug}`, {
        name: nome,
        description: descricao,
        price: parseFloat(preco),
        stock: parseInt(estoque) || 0,
        category: categoria.trim() || "Geral",
      });
      setNome(""); setCategoria(""); setDescricao(""); setPreco(""); setEstoque("0");
      setModalAberto(false);
      carregarProdutos();
    } catch (err: any) {
      setErro(err?.response?.data?.detail || "Erro ao cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(produto: Produto) {
    setProdutoEditando(produto);
    setEditNome(produto.name);
    setEditCategoria(produto.category || "Geral");
    setEditDescricao(produto.description || "");
    setEditPreco(String(produto.price));
    setEditEstoque(String(produto.stock));
    setErroEdicao("");
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!produtoEditando) return;
    setErroEdicao(""); setSalvandoEdicao(true);
    try {
      await api.put(`/products/${slug}/${produtoEditando.id}`, {
        name: editNome,
        description: editDescricao || null,
        price: parseFloat(editPreco),
        stock: parseInt(editEstoque) || 0,
        category: editCategoria.trim() || "Geral",
      });
      setProdutoEditando(null);
      carregarProdutos();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErroEdicao(detail || "Erro ao salvar as alterações.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function desativar(id: string) {
    if (!confirm("Desativar este produto?")) return;
    try {
      await api.delete(`/products/${slug}/${id}`);
      carregarProdutos();
    } catch { alert("Não foi possível desativar."); }
  }

  function moeda(v: number) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function infoEstoque(stock: number) {
    if (stock === 0) return { cor: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", label: "Sem estoque" };
    if (stock <= 5) return { cor: "var(--color-warning)", bg: "rgba(244,187,17,0.1)", border: "rgba(244,187,17,0.2)", label: `${stock} un.` };
    return { cor: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)", label: `${stock} un.` };
  }

  // Agrupa produtos por categoria preservando a ordem do backend
  function agruparPorCategoria(lista: Produto[]): [string, Produto[]][] {
    const mapa = new Map<string, Produto[]>();
    for (const p of lista) {
      const cat = p.category || "Geral";
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(p);
    }
    return Array.from(mapa.entries());
  }

  const alertas = produtos.filter((p) => p.stock <= 5);
  const grupos = agruparPorCategoria(produtos);

  // Métricas do painel de estoque — calculadas em tempo real a partir dos dados carregados
  const totalUnidades = produtos.reduce((acc, p) => acc + p.stock, 0);
  const qtdOk = produtos.filter((p) => p.stock > 5).length;
  const qtdBaixo = produtos.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const qtdZero = produtos.filter((p) => p.stock === 0).length;

  // Paleta de cores por índice de categoria
  const coresCat = ["#2D7EF8", "#10B981", "#7C3AED", "#f4bb11", "#EF4444"];

  // Cabeçalho de modal reutilizável
  function ModalHeader({
    icon, iconColor, iconBg, title, subtitle, onClose,
  }: {
    icon: React.ReactNode; iconColor: string; iconBg: string;
    title: string; subtitle?: string; onClose: () => void;
  }) {
    return (
      <>
        <div style={{
          width: "36px", height: "4px",
          background: "rgba(255,255,255,0.12)",
          borderRadius: "999px", margin: "0 auto 24px",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "46px", height: "46px", borderRadius: "14px", flexShrink: 0,
              background: iconBg, border: `1px solid ${iconColor}35`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 16px ${iconColor}25`,
            }}>
              {icon}
            </div>
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: "800", marginBottom: "2px" }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>{subtitle}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "7px", cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} color="var(--text-muted)" />
          </button>
        </div>
        <div style={{
          height: "1px", marginBottom: "22px",
          background: `linear-gradient(90deg, ${iconColor}, #10B981, transparent)`,
        }} />
      </>
    );
  }

  return (
    <>
    <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <style>{`
        .prod-title-grad {
          background: linear-gradient(135deg, var(--text-primary) 30%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        html.theme-light .prod-title-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .prod-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 16px 18px;
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          transition: all 0.2s ease;
        }
        .prod-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(45,126,248,0.2);
          box-shadow: 0 4px 20px rgba(45,126,248,0.06);
        }
        .prod-btn-edit {
          background: rgba(45,126,248,0.08); border: 1px solid rgba(45,126,248,0.15);
          border-radius: 10px; padding: 9px; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .prod-btn-edit:hover { background: rgba(45,126,248,0.18); border-color: rgba(45,126,248,0.35); }
        .prod-btn-del {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15);
          border-radius: 10px; padding: 9px; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .prod-btn-del:hover { background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.35); }
        .prod-erro {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15);
          border-left: 3px solid rgba(239,68,68,0.5);
          border-radius: var(--radius-md); padding: 10px 14px;
          color: #FCA5A5; font-size: 13px;
        }
        .prod-submit-blue {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 15px 24px;
          background: linear-gradient(135deg, #2D7EF8, #1A5FCC);
          border: none; border-radius: 16px;
          color: white; font-family: Inter, sans-serif; font-size: 15px; font-weight: 700;
          cursor: pointer; letter-spacing: -0.2px;
          box-shadow: 0 4px 20px rgba(45,126,248,0.35);
          transition: all 0.2s ease;
        }
        .prod-submit-blue:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(45,126,248,0.5); }
        .prod-submit-blue:active:not(:disabled) { transform: translateY(0); }
        .prod-submit-blue:disabled { opacity: 0.45; cursor: not-allowed; }
        .prod-submit-green {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 15px 24px;
          background: linear-gradient(135deg, #10B981, #059669);
          border: none; border-radius: 16px;
          color: white; font-family: Inter, sans-serif; font-size: 15px; font-weight: 700;
          cursor: pointer; letter-spacing: -0.2px;
          box-shadow: 0 4px 20px rgba(16,185,129,0.35);
          transition: all 0.2s ease;
        }
        .prod-submit-green:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(16,185,129,0.5); }
        .prod-submit-green:active:not(:disabled) { transform: translateY(0); }
        .prod-submit-green:disabled { opacity: 0.45; cursor: not-allowed; }
        .prod-modal-overlay { padding: 0 16px; align-items: flex-end; }
        .prod-modal-content { border-radius: 28px 28px 20px 20px !important; box-shadow: 0 -8px 40px rgba(0,0,0,0.5); }
        @media (min-width: 768px) {
          .prod-modal-overlay { align-items: center; padding: 0 24px; }
          .prod-modal-content { border-radius: 28px !important; }
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="prod-title-grad" style={{ fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px", marginBottom: "4px" }}>
            Produtos
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {produtos.length} cadastrado{produtos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setModalAberto(true)} className="btn-primary" style={{ gap: "8px" }}>
          <Plus size={15} />
          Novo
        </button>
      </div>

      {/* Painel de Estoque */}
      {produtos.length > 0 && (
        <div className="glass-card" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
          {/* Linha decorativa no topo */}
          <div style={{
            position: "absolute", top: 0, left: "15%", right: "15%", height: "2px",
            background: "linear-gradient(90deg, transparent, #2D7EF8, #10B981, transparent)",
          }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(45,126,248,0.25), rgba(45,126,248,0.1))",
                border: "1px solid rgba(45,126,248,0.25)",
                boxShadow: "0 0 16px rgba(45,126,248,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Package size={18} color="#2D7EF8" strokeWidth={2} />
              </div>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "700" }}>
                  Controle de Estoque
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  Atualizado automaticamente a cada venda concluída
                </p>
              </div>
            </div>
            <span style={{
              background: "rgba(45,126,248,0.1)", border: "1px solid rgba(45,126,248,0.2)",
              borderRadius: "999px", padding: "3px 10px",
              color: "#60A5FA", fontSize: "10px", fontWeight: "700",
              textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
            }}>
              Tempo real
            </span>
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "14px" }}>
            <div style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.04))",
              border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px",
              padding: "12px 10px", textAlign: "center",
            }}>
              <p style={{ color: "#34D399", fontSize: "24px", fontWeight: "800", lineHeight: 1 }}>{qtdOk}</p>
              <p style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "4px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em" }}>OK</p>
            </div>
            <div style={{
              background: "linear-gradient(135deg, rgba(244,187,17,0.1), rgba(244,187,17,0.04))",
              border: "1px solid rgba(244,187,17,0.2)", borderRadius: "12px",
              padding: "12px 10px", textAlign: "center",
            }}>
              <p style={{ color: "#f4bb11", fontSize: "24px", fontWeight: "800", lineHeight: 1 }}>{qtdBaixo}</p>
              <p style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "4px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em" }}>Baixo</p>
            </div>
            <div style={{
              background: qtdZero > 0 ? "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.04))" : "rgba(255,255,255,0.02)",
              border: `1px solid ${qtdZero > 0 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: "12px", padding: "12px 10px", textAlign: "center",
            }}>
              <p style={{ color: qtdZero > 0 ? "#FCA5A5" : "var(--text-muted)", fontSize: "24px", fontWeight: "800", lineHeight: 1 }}>{qtdZero}</p>
              <p style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "4px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em" }}>Zerado</p>
            </div>
          </div>

          {/* Total */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px",
          }}>
            <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>Total de unidades em estoque</p>
            <p style={{ color: "var(--text-primary)", fontSize: "16px", fontWeight: "800" }}>
              {totalUnidades.toLocaleString("pt-BR")}
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "400", marginLeft: "4px" }}>un.</span>
            </p>
          </div>
        </div>
      )}

      {/* Alerta de estoque baixo */}
      {alertas.length > 0 && (
        <div style={{
          background: "rgba(244,187,17,0.06)", border: "1px solid rgba(244,187,17,0.18)",
          borderLeft: "3px solid rgba(244,187,17,0.5)",
          borderRadius: "var(--radius-lg)", padding: "14px 16px",
          display: "flex", alignItems: "flex-start", gap: "12px",
        }}>
          <AlertTriangle size={18} color="#f4bb11" style={{ flexShrink: 0, marginTop: "1px" }} />
          <div>
            <p style={{ color: "#f4bb11", fontSize: "13px", fontWeight: "700", marginBottom: "2px" }}>
              {alertas.length} produto{alertas.length > 1 ? "s" : ""} com estoque baixo
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              {alertas.map((p) => p.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {carregando && produtos.length === 0 && <SkeletonCards />}

      {/* Erro */}
      {erroCarregamento && (
        <div style={{
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)",
          borderRadius: "var(--radius-lg)", padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          <p style={{ color: "#FCA5A5", fontSize: "13px" }}>{erroCarregamento}</p>
          <button onClick={carregarProdutos} style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "var(--radius-sm)", padding: "6px 14px",
            color: "#FCA5A5", fontSize: "12px", fontWeight: "700",
            cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif",
          }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Estado vazio */}
      {!carregando && !erroCarregamento && produtos.length === 0 && (
        <div style={{
          background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
          borderRadius: "var(--radius-xl)", padding: "56px 20px", textAlign: "center",
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "18px", margin: "0 auto 14px",
            background: "linear-gradient(135deg, rgba(45,126,248,0.15), rgba(45,126,248,0.05))",
            border: "1px solid rgba(45,126,248,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Package size={24} color="#2D7EF8" strokeWidth={1.8} />
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
            Nenhum produto cadastrado
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
            Cadastre o primeiro produto do estabelecimento.
          </p>
        </div>
      )}

      {/* Lista agrupada por categoria */}
      {produtos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {grupos.map(([cat, lista], gi) => {
            const corCat = coresCat[gi % coresCat.length];
            return (
              <div key={cat}>
                {/* Cabeçalho de categoria */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "18px 0 10px" }}>
                  <div style={{
                    width: "6px", height: "6px", borderRadius: "999px",
                    background: corCat, flexShrink: 0, boxShadow: `0 0 6px ${corCat}`,
                  }} />
                  <span style={{ color: corCat, fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                    {cat}
                  </span>
                  <span style={{
                    background: `${corCat}18`, border: `1px solid ${corCat}30`,
                    borderRadius: "999px", padding: "1px 8px",
                    color: corCat, fontSize: "10px", fontWeight: "700",
                  }}>
                    {lista.length}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {lista.map((p) => {
                    const estq = infoEstoque(p.stock);
                    return (
                      <div key={p.id} className="prod-card" style={{ borderLeft: `3px solid ${corCat}50` }}>
                        {/* Ícone + dados */}
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: "44px", height: "44px", borderRadius: "13px", flexShrink: 0,
                            background: `linear-gradient(135deg, ${corCat}25, ${corCat}10)`,
                            border: `1px solid ${corCat}30`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: `0 0 12px ${corCat}15`,
                          }}>
                            <Package size={20} color={corCat} strokeWidth={2} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              color: "var(--text-primary)", fontSize: "14px", fontWeight: "700", marginBottom: "2px",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {p.name}
                            </p>
                            {p.description && (
                              <p style={{
                                color: "var(--text-muted)", fontSize: "11px", marginBottom: "6px",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {p.description}
                              </p>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{
                                background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
                                borderRadius: "999px", padding: "2px 10px",
                                color: "#10B981", fontSize: "12px", fontWeight: "700",
                              }}>
                                {moeda(p.price)}
                              </span>
                              <span style={{
                                background: estq.bg, border: `1px solid ${estq.border}`,
                                borderRadius: "999px", padding: "2px 10px",
                                color: estq.cor, fontSize: "11px", fontWeight: "600",
                              }}>
                                {estq.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Ações */}
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button onClick={() => abrirEdicao(p)} title="Editar produto" className="prod-btn-edit">
                            <Pencil size={14} color="#93C5FD" />
                          </button>
                          <button onClick={() => desativar(p.id)} title="Desativar produto" className="prod-btn-del">
                            <X size={15} color="#FCA5A5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>

      {/* Modal novo produto */}
      {modalAberto && (
        <div className="bottom-sheet prod-modal-overlay" onClick={() => { setModalAberto(false); setErro(""); }}>
          <div className="bottom-sheet-content prod-modal-content" onClick={(e) => e.stopPropagation()} style={{ overflowY: "auto", maxHeight: "90vh", paddingBottom: "env(safe-area-inset-bottom, 40px)" }}>
            <ModalHeader
              icon={<Plus size={20} color="#2D7EF8" strokeWidth={2.5} />}
              iconColor="#2D7EF8"
              iconBg="linear-gradient(135deg, rgba(45,126,248,0.25), rgba(16,185,129,0.12))"
              title="Novo Produto"
              subtitle="Preencha os dados para cadastrar"
              onClose={() => { setModalAberto(false); setErro(""); }}
            />

            <form onSubmit={cadastrar} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Nome do produto</label>
                <input className="input-premium" type="text" placeholder="Pomada Modeladora"
                  value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Categoria (opcional)</label>
                <input className="input-premium" type="text" placeholder="Ex: Pomadas, Shampoos, Tratamentos"
                  value={categoria} onChange={(e) => setCategoria(e.target.value)} />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Descrição (opcional)</label>
                <input className="input-premium" type="text" placeholder="Breve descrição"
                  value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Preço (R$)</label>
                <input className="input-premium" type="number" placeholder="29.90"
                  value={preco} onChange={(e) => setPreco(e.target.value)} required step="0.01" />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Estoque (unidades)</label>
                <input className="input-premium" type="number" placeholder="10"
                  value={estoque} onChange={(e) => setEstoque(e.target.value)} step="1" min="0" />
              </div>

              {erro && <div className="prod-erro">{erro}</div>}

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "20px" }}>
                <button type="submit" className="prod-submit-blue" disabled={salvando}>
                  {salvando ? "Cadastrando..." : <><Plus size={18} strokeWidth={2.5} />Cadastrar Produto</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edição de produto */}
      {produtoEditando && (
        <div className="bottom-sheet prod-modal-overlay" onClick={() => { setProdutoEditando(null); setErroEdicao(""); }}>
          <div className="bottom-sheet-content prod-modal-content" onClick={(e) => e.stopPropagation()} style={{ overflowY: "auto", maxHeight: "90vh", paddingBottom: "env(safe-area-inset-bottom, 40px)" }}>
            <ModalHeader
              icon={<Package size={20} color="#10B981" strokeWidth={2} />}
              iconColor="#10B981"
              iconBg="linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.08))"
              title="Editar Produto"
              subtitle={produtoEditando.name}
              onClose={() => { setProdutoEditando(null); setErroEdicao(""); }}
            />

            <form onSubmit={salvarEdicao} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Nome do produto</label>
                <input className="input-premium" type="text" placeholder="Pomada Modeladora"
                  value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Categoria (opcional)</label>
                <input className="input-premium" type="text" placeholder="Ex: Pomadas, Shampoos, Tratamentos"
                  value={editCategoria} onChange={(e) => setEditCategoria(e.target.value)} />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Descrição (opcional)</label>
                <input className="input-premium" type="text" placeholder="Breve descrição"
                  value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Preço (R$)</label>
                <input className="input-premium" type="number" placeholder="29.90"
                  value={editPreco} onChange={(e) => setEditPreco(e.target.value)} required step="0.01" min="0" />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Estoque (unidades)</label>
                <input className="input-premium" type="number" placeholder="0"
                  value={editEstoque} onChange={(e) => setEditEstoque(e.target.value)} step="1" min="0" />
              </div>

              {erroEdicao && <div className="prod-erro">{erroEdicao}</div>}

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "20px" }}>
                <button type="submit" className="prod-submit-green" disabled={salvandoEdicao}>
                  {salvandoEdicao ? "Salvando..." : <><Check size={18} strokeWidth={2.5} />Salvar alterações</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
