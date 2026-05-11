"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, X, Link, Scissors, Pencil, Check } from "lucide-react";
import api from "@/lib/api";

interface Servico {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  category_order: number;
  is_active: boolean;
}

interface Produto {
  id: string;
  name: string;
  price: number;
}

function SkeletonCards() {
  return (
    <>
      <style>{`@keyframes sk-pulse{0%,100%{opacity:.3}50%{opacity:.65}}`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              height: "68px",
              animation: "sk-pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

export default function ServicosPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  // Modal novo serviço
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Modal vínculo produto
  const [modalVinculo, setModalVinculo] = useState(false);
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [vinculando, setVinculando] = useState(false);

  // Modal edição de serviço
  const [servicoEditando, setServicoEditando] = useState<Servico | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCategoria, setEditCategoria] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editPreco, setEditPreco] = useState("");
  const [erroEdicao, setErroEdicao] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => { carregarServicos(); }, []);

  async function carregarServicos() {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const r = await api.get(`/services/${slug}`, { timeout: 30000 });
      setServicos(r.data);
    } catch {
      setErroCarregamento("Não foi possível carregar os serviços. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setSalvando(true);
    try {
      await api.post(`/services/${slug}`, {
        name: nome,
        description: descricao,
        price: parseFloat(preco),
        category: categoria.trim() || "Geral",
      });
      setNome(""); setCategoria(""); setDescricao(""); setPreco("");
      setModalAberto(false);
      carregarServicos();
    } catch (err: any) {
      setErro(err?.response?.data?.detail || "Erro ao cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(id: string) {
    if (!confirm("Desativar este serviço?")) return;
    try {
      await api.delete(`/services/${slug}/${id}`);
      carregarServicos();
    } catch { alert("Não foi possível desativar."); }
  }

  async function abrirVinculo(servico: Servico) {
    setServicoSelecionado(servico);
    setProdutosSelecionados([]);
    try {
      const r = await api.get(`/products/${slug}`);
      setProdutos(r.data);
    } catch { setProdutos([]); }
    setModalVinculo(true);
  }

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    if (!servicoSelecionado || produtosSelecionados.length === 0) return;
    setVinculando(true);
    try {
      // Vincula cada produto selecionado em paralelo; ignora 400 (já vinculado)
      await Promise.all(
        produtosSelecionados.map((prodId) =>
          api.post(
            `/services/${slug}/${servicoSelecionado.id}/products/${prodId}`,
            {}
          ).catch((err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status !== 400) throw err;
          })
        )
      );
      setModalVinculo(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail || "Erro ao vincular produtos.");
    } finally {
      setVinculando(false);
    }
  }

  function abrirEdicao(servico: Servico) {
    setServicoEditando(servico);
    setEditNome(servico.name);
    setEditCategoria(servico.category || "Geral");
    setEditDescricao(servico.description || "");
    setEditPreco(String(servico.price));
    setErroEdicao("");
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!servicoEditando) return;
    setErroEdicao(""); setSalvandoEdicao(true);
    try {
      await api.put(`/services/${slug}/${servicoEditando.id}`, {
        name: editNome,
        description: editDescricao || null,
        price: parseFloat(editPreco),
        category: editCategoria.trim() || "Geral",
      });
      setServicoEditando(null);
      carregarServicos();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErroEdicao(detail || "Erro ao salvar as alterações.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  function moeda(v: number) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Agrupa serviços por categoria preservando a ordem do backend
  function agruparPorCategoria(lista: Servico[]): [string, Servico[]][] {
    const mapa = new Map<string, Servico[]>();
    for (const s of lista) {
      const cat = s.category || "Geral";
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(s);
    }
    return Array.from(mapa.entries());
  }

  const grupos = agruparPorCategoria(servicos);

  // Paleta de cores por índice de categoria
  const coresCat = ["#2D7EF8", "#10B981", "#7C3AED", "#f4bb11", "#EF4444"];

  // Cabeçalho modal reutilizável
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
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px", padding: "7px", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
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
        .serv-title-grad {
          background: linear-gradient(135deg, var(--text-primary) 30%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        html.theme-light .serv-title-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .serv-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 16px 18px;
          transition: all 0.2s ease;
        }
        .serv-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(45,126,248,0.2);
          box-shadow: 0 4px 20px rgba(45,126,248,0.06);
        }
        .serv-btn-edit {
          background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.15);
          border-radius: 10px; padding: 9px; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .serv-btn-edit:hover { background: rgba(16,185,129,0.18); border-color: rgba(16,185,129,0.35); }
        .serv-btn-link {
          background: rgba(45,126,248,0.08); border: 1px solid rgba(45,126,248,0.15);
          border-radius: 10px; padding: 9px; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .serv-btn-link:hover { background: rgba(45,126,248,0.18); border-color: rgba(45,126,248,0.35); }
        .serv-btn-del {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15);
          border-radius: 10px; padding: 9px; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .serv-btn-del:hover { background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.35); }
        .serv-erro {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15);
          border-left: 3px solid rgba(239,68,68,0.5);
          border-radius: var(--radius-md); padding: 10px 14px;
          color: #FCA5A5; font-size: 13px;
        }
        .serv-submit-blue {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 15px 24px; margin-top: 8px;
          background: linear-gradient(135deg, #2D7EF8, #1A5FCC);
          border: none; border-radius: 16px;
          color: white; font-family: Inter, sans-serif; font-size: 15px; font-weight: 700;
          cursor: pointer; letter-spacing: -0.2px;
          box-shadow: 0 4px 20px rgba(45,126,248,0.35);
          transition: all 0.2s ease;
        }
        .serv-submit-blue:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(45,126,248,0.5);
        }
        .serv-submit-blue:active:not(:disabled) { transform: translateY(0); }
        .serv-submit-blue:disabled { opacity: 0.45; cursor: not-allowed; }

        .serv-submit-green {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 15px 24px; margin-top: 8px;
          background: linear-gradient(135deg, #10B981, #059669);
          border: none; border-radius: 16px;
          color: white; font-family: Inter, sans-serif; font-size: 15px; font-weight: 700;
          cursor: pointer; letter-spacing: -0.2px;
          box-shadow: 0 4px 20px rgba(16,185,129,0.35);
          transition: all 0.2s ease;
        }
        .serv-submit-green:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(16,185,129,0.5);
        }
        .serv-submit-green:active:not(:disabled) { transform: translateY(0); }
        .serv-submit-green:disabled { opacity: 0.45; cursor: not-allowed; }
        .serv-modal-overlay {
          padding: 0 16px;
          align-items: flex-end;
        }
        .serv-modal-content {
          border-radius: 28px 28px 20px 20px !important;
          box-shadow: 0 -8px 40px rgba(0,0,0,0.5);
        }
        @media (min-width: 768px) {
          .serv-modal-overlay { align-items: center; padding: 0 24px; }
          .serv-modal-content { border-radius: 28px !important; }
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="serv-title-grad" style={{ fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px", marginBottom: "4px" }}>
            Serviços
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {servicos.length} cadastrado{servicos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setModalAberto(true)} className="btn-primary" style={{ gap: "8px" }}>
          <Plus size={15} />
          Novo
        </button>
      </div>

      {/* Skeleton — somente na primeira carga (sem dados ainda) */}
      {carregando && servicos.length === 0 && <SkeletonCards />}

      {/* Erro com botão de retry */}
      {erroCarregamento && (
        <div style={{
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)",
          borderRadius: "var(--radius-lg)", padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          <p style={{ color: "#FCA5A5", fontSize: "13px" }}>{erroCarregamento}</p>
          <button onClick={carregarServicos} style={{
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
      {!carregando && !erroCarregamento && servicos.length === 0 && (
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
            <Scissors size={24} color="#2D7EF8" strokeWidth={1.8} />
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
            Nenhum serviço cadastrado
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
            Cadastre o primeiro serviço do estabelecimento.
          </p>
        </div>
      )}

      {/* Lista agrupada por categoria — mantém dados visíveis durante reload */}
      {servicos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {grupos.map(([cat, lista], gi) => {
            const corCat = coresCat[gi % coresCat.length];
            return (
              <div key={cat}>
                {/* Cabeçalho de categoria */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "18px 0 10px",
                }}>
                  <div style={{
                    width: "6px", height: "6px", borderRadius: "999px",
                    background: corCat, flexShrink: 0,
                    boxShadow: `0 0 6px ${corCat}`,
                  }} />
                  <span style={{
                    color: corCat, fontSize: "11px", fontWeight: "800",
                    textTransform: "uppercase", letterSpacing: "0.12em",
                  }}>
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
                  {lista.map((s) => (
                    <div key={s.id} className="serv-card" style={{ borderLeft: `3px solid ${corCat}50` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Ícone + nome */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                            <div style={{
                              width: "38px", height: "38px", borderRadius: "12px", flexShrink: 0,
                              background: `linear-gradient(135deg, ${corCat}25, ${corCat}10)`,
                              border: `1px solid ${corCat}30`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: `0 0 12px ${corCat}15`,
                            }}>
                              <Scissors size={16} color={corCat} strokeWidth={2} />
                            </div>
                            <p style={{
                              color: "var(--text-primary)", fontSize: "14px", fontWeight: "700",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {s.name}
                            </p>
                          </div>

                          {s.description && (
                            <p style={{
                              color: "var(--text-muted)", fontSize: "12px",
                              marginBottom: "8px", marginLeft: "48px",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {s.description}
                            </p>
                          )}

                          <div style={{ marginLeft: "48px" }}>
                            <span style={{
                              background: "rgba(16,185,129,0.1)",
                              border: "1px solid rgba(16,185,129,0.2)",
                              borderRadius: "999px", padding: "3px 12px",
                              color: "#10B981", fontSize: "13px", fontWeight: "700",
                            }}>
                              {moeda(s.price)}
                            </span>
                          </div>
                        </div>

                        {/* Ações */}
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button onClick={() => abrirEdicao(s)} title="Editar serviço" className="serv-btn-edit">
                            <Pencil size={14} color="#6EE7B7" />
                          </button>
                          <button onClick={() => abrirVinculo(s)} title="Vincular produto" className="serv-btn-link">
                            <Link size={14} color="#93C5FD" />
                          </button>
                          <button onClick={() => desativar(s.id)} title="Desativar serviço" className="serv-btn-del">
                            <X size={14} color="#FCA5A5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>

      {/* Modais fora do animate-fade-up para não serem afetados pelo transform da animação */}

      {/* Modal novo serviço */}
      {modalAberto && (
        <div className="bottom-sheet serv-modal-overlay" onClick={() => { setModalAberto(false); setErro(""); }}>
          <div className="bottom-sheet-content serv-modal-content" onClick={(e) => e.stopPropagation()} style={{ overflowY: "auto", maxHeight: "90vh", paddingBottom: "env(safe-area-inset-bottom, 40px)" }}>
            <ModalHeader
              icon={<Plus size={20} color="#2D7EF8" strokeWidth={2.5} />}
              iconColor="#2D7EF8"
              iconBg="linear-gradient(135deg, rgba(45,126,248,0.25), rgba(16,185,129,0.12))"
              title="Novo Serviço"
              subtitle="Preencha os dados para cadastrar"
              onClose={() => { setModalAberto(false); setErro(""); }}
            />

            <form onSubmit={cadastrar} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Nome do serviço</label>
                <input className="input-premium" type="text" placeholder="Corte Degradê"
                  value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Categoria (opcional)</label>
                <input className="input-premium" type="text" placeholder="Ex: Corte, Barba, Tratamento"
                  value={categoria} onChange={(e) => setCategoria(e.target.value)} />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Descrição (opcional)</label>
                <input className="input-premium" type="text" placeholder="Breve descrição"
                  value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Preço (R$)</label>
                <input className="input-premium" type="number" placeholder="45.00"
                  value={preco} onChange={(e) => setPreco(e.target.value)} required step="0.01" />
              </div>

              {erro && <div className="serv-erro">{erro}</div>}

              <div style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: "20px", marginTop: "6px",
              }}>
                <button type="submit" className="serv-submit-blue" disabled={salvando}>
                  {salvando ? (
                    "Cadastrando..."
                  ) : (
                    <><Plus size={18} strokeWidth={2.5} />Cadastrar Serviço</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal vínculo produto — checkboxes múltiplos */}
      {modalVinculo && (
        <div className="bottom-sheet serv-modal-overlay" onClick={() => setModalVinculo(false)}>
          <div className="bottom-sheet-content serv-modal-content" onClick={(e) => e.stopPropagation()} style={{ overflowY: "auto", maxHeight: "90vh", paddingBottom: "env(safe-area-inset-bottom, 40px)" }}>
            <ModalHeader
              icon={<Link size={20} color="#2D7EF8" strokeWidth={2} />}
              iconColor="#2D7EF8"
              iconBg="linear-gradient(135deg, rgba(45,126,248,0.25), rgba(45,126,248,0.08))"
              title="Vincular Produtos"
              subtitle={servicoSelecionado?.name}
              onClose={() => setModalVinculo(false)}
            />

            <form onSubmit={vincular} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <label className="label-premium" style={{ margin: 0 }}>Produtos recomendados</label>
                  {produtosSelecionados.length > 0 && (
                    <span style={{
                      background: "rgba(45,126,248,0.15)", border: "1px solid rgba(45,126,248,0.25)",
                      borderRadius: "999px", padding: "1px 8px",
                      color: "#93C5FD", fontSize: "11px", fontWeight: "700",
                    }}>
                      {produtosSelecionados.length} selecionado{produtosSelecionados.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {produtos.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                    Nenhum produto cadastrado.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {produtos.map((p) => {
                      const selecionado = produtosSelecionados.includes(p.id);
                      return (
                        <label key={p.id} style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          background: selecionado ? "rgba(45,126,248,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${selecionado ? "rgba(45,126,248,0.25)" : "rgba(255,255,255,0.07)"}`,
                          borderLeft: `3px solid ${selecionado ? "#2D7EF8" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: "12px", padding: "12px 14px",
                          cursor: "pointer", transition: "all 0.2s ease",
                        }}>
                          <input
                            type="checkbox" checked={selecionado}
                            onChange={(e) => {
                              if (e.target.checked) setProdutosSelecionados((prev) => [...prev, p.id]);
                              else setProdutosSelecionados((prev) => prev.filter((id) => id !== p.id));
                            }}
                            style={{ display: "none" }}
                          />
                          {/* Checkbox customizado */}
                          <div style={{
                            width: "20px", height: "20px", flexShrink: 0, borderRadius: "6px",
                            background: selecionado ? "linear-gradient(135deg, #2D7EF8, #1A5FCC)" : "transparent",
                            border: `2px solid ${selecionado ? "#2D7EF8" : "rgba(255,255,255,0.2)"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease",
                            boxShadow: selecionado ? "0 0 10px rgba(45,126,248,0.3)" : "none",
                          }}>
                            {selecionado && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <p style={{ flex: 1, color: "var(--text-primary)", fontSize: "13px", fontWeight: "600" }}>
                            {p.name}
                          </p>
                          <span style={{
                            background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
                            borderRadius: "999px", padding: "3px 10px",
                            color: "#10B981", fontSize: "12px", fontWeight: "700",
                          }}>
                            {moeda(p.price)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: "20px", marginTop: "6px",
              }}>
                <button type="submit" className="serv-submit-blue"
                  disabled={vinculando || produtosSelecionados.length === 0}>
                  {vinculando ? (
                    "Vinculando..."
                  ) : (
                    <>
                      <Link size={18} strokeWidth={2} />
                      {produtosSelecionados.length > 0
                        ? `Vincular ${produtosSelecionados.length} Produto${produtosSelecionados.length !== 1 ? "s" : ""}`
                        : "Selecione produtos"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edição de serviço */}
      {servicoEditando && (
        <div className="bottom-sheet serv-modal-overlay" onClick={() => { setServicoEditando(null); setErroEdicao(""); }}>
          <div className="bottom-sheet-content serv-modal-content" onClick={(e) => e.stopPropagation()} style={{ overflowY: "auto", maxHeight: "90vh", paddingBottom: "env(safe-area-inset-bottom, 40px)" }}>
            <ModalHeader
              icon={<Scissors size={20} color="#10B981" strokeWidth={2} />}
              iconColor="#10B981"
              iconBg="linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.08))"
              title="Editar Serviço"
              subtitle={servicoEditando.name}
              onClose={() => { setServicoEditando(null); setErroEdicao(""); }}
            />

            <form onSubmit={salvarEdicao} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Nome do serviço</label>
                <input className="input-premium" type="text" placeholder="Corte Degradê"
                  value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Categoria (opcional)</label>
                <input className="input-premium" type="text" placeholder="Ex: Corte, Barba, Tratamento"
                  value={editCategoria} onChange={(e) => setEditCategoria(e.target.value)} />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Descrição (opcional)</label>
                <input className="input-premium" type="text" placeholder="Breve descrição"
                  value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} />
              </div>
              <div>
                <label className="label-premium" style={{ marginBottom: "8px", display: "block" }}>Preço (R$)</label>
                <input className="input-premium" type="number" placeholder="45.00"
                  value={editPreco} onChange={(e) => setEditPreco(e.target.value)}
                  required step="0.01" min="0" />
              </div>

              {erroEdicao && <div className="serv-erro">{erroEdicao}</div>}

              <div style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: "20px", marginTop: "6px",
              }}>
                <button type="submit" className="serv-submit-green" disabled={salvandoEdicao}>
                  {salvandoEdicao ? (
                    "Salvando..."
                  ) : (
                    <><Check size={18} strokeWidth={2.5} />Salvar alterações</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
