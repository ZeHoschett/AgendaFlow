"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { UserPlus, X, Users, Pencil } from "lucide-react";
import api from "@/lib/api";

interface Profissional {
  id: string;
  full_name: string;
  phone: string;
  commission_rate: number;
  is_active: boolean;
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

export default function ProfissionaisPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [comissao, setComissao] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Estado do modal de edição
  const [profissionalEditando, setProfissionalEditando] = useState<Profissional | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editComissao, setEditComissao] = useState("0");
  const [erroEdicao, setErroEdicao] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => { carregarProfissionais(); }, []);

  async function carregarProfissionais() {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const r = await api.get(`/professionals/${slug}`, { timeout: 30000 });
      setProfissionais(r.data);
    } catch {
      setErroCarregamento("Não foi possível carregar os profissionais. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setSalvando(true);
    try {
      await api.post(`/professionals/${slug}`, {
        full_name: nome, email, password: senha,
        phone: telefone.replace(/\D/g, ""), commission_rate: parseFloat(comissao) || 0,
      });
      setNome(""); setEmail(""); setSenha(""); setTelefone(""); setComissao("0");
      setModalAberto(false);
      carregarProfissionais();
    } catch (err: any) {
      setErro(err?.response?.data?.detail || "Erro ao cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  // Formata telefone para exibição: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  function formatarTelefone(phone: string): string {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone || "";
  }

  // Máscara progressiva aplicada enquanto o usuário digita no input
  function mascararTelefone(valor: string): string {
    const digits = valor.replace(/\D/g, "").slice(0, 11);
    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function abrirEdicao(prof: Profissional) {
    setProfissionalEditando(prof);
    setEditNome(prof.full_name);
    setEditTelefone(formatarTelefone(prof.phone || ""));
    setEditComissao(String(prof.commission_rate));
    setErroEdicao("");
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!profissionalEditando) return;
    setErroEdicao(""); setSalvandoEdicao(true);
    try {
      await api.put(`/professionals/${slug}/${profissionalEditando.id}`, {
        full_name: editNome,
        phone: editTelefone.replace(/\D/g, "") || null,
        commission_rate: parseFloat(editComissao) || 0,
      });
      setProfissionalEditando(null);
      carregarProfissionais();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErroEdicao(detail || "Erro ao salvar as alterações.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function desativar(id: string) {
    if (!confirm("Desativar este profissional?")) return;
    try {
      await api.delete(`/professionals/${slug}/${id}`);
      carregarProfissionais();
    } catch { alert("Não foi possível desativar."); }
  }

  // Cores para avatares
  const coresAvatar = [
    "linear-gradient(135deg, #2D7EF8, #1A5FCC)",
    "linear-gradient(135deg, #10B981, #059669)",
    "linear-gradient(135deg, #7C3AED, #5B21B6)",
    "linear-gradient(135deg, #f4bb11, #d4a010)",
    "linear-gradient(135deg, #EF4444, #DC2626)",
  ];

  return (
    <>
    <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <style>{`
        .prof-title-grad {
          background: linear-gradient(135deg, var(--text-primary) 30%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        html.theme-light .prof-title-grad {
          background: linear-gradient(135deg, #1E3A8A 20%, #2D7EF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .prof-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: all 0.2s ease;
        }
        .prof-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(45,126,248,0.2);
          box-shadow: 0 4px 20px rgba(45,126,248,0.06);
        }
        .prof-btn-edit {
          background: rgba(45,126,248,0.08);
          border: 1px solid rgba(45,126,248,0.15);
          border-radius: 10px;
          padding: 9px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .prof-btn-edit:hover {
          background: rgba(45,126,248,0.18);
          border-color: rgba(45,126,248,0.35);
        }
        .prof-btn-del {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.15);
          border-radius: 10px;
          padding: 9px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .prof-btn-del:hover {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.35);
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="prof-title-grad" style={{
            fontSize: "26px", fontWeight: "800",
            letterSpacing: "-0.5px", marginBottom: "4px",
          }}>
            Profissionais
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {profissionais.length} cadastrado{profissionais.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          onClick={() => setModalAberto(true)}
          className="btn-primary"
          style={{ gap: "8px" }}
        >
          <UserPlus size={15} />
          Novo
        </button>
      </div>

      {/* Skeleton — somente na primeira carga (sem dados ainda) */}
      {carregando && profissionais.length === 0 && <SkeletonCards />}

      {/* Erro com botão de retry */}
      {erroCarregamento && (
        <div style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.12)",
          borderRadius: "var(--radius-lg)", padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          <p style={{ color: "#FCA5A5", fontSize: "13px" }}>{erroCarregamento}</p>
          <button
            onClick={carregarProfissionais}
            style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "var(--radius-sm)", padding: "6px 14px",
              color: "#FCA5A5", fontSize: "12px", fontWeight: "700",
              cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif",
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Estado vazio */}
      {!carregando && !erroCarregamento && profissionais.length === 0 && (
        <div style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          borderRadius: "var(--radius-xl)", padding: "56px 20px",
          textAlign: "center",
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "18px", margin: "0 auto 14px",
            background: "linear-gradient(135deg, rgba(45,126,248,0.15), rgba(45,126,248,0.05))",
            border: "1px solid rgba(45,126,248,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={24} color="#2D7EF8" strokeWidth={1.8} />
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
            Nenhum profissional
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
            Cadastre o primeiro profissional do estabelecimento.
          </p>
        </div>
      )}

      {/* Lista — mantém dados visíveis durante reload */}
      {profissionais.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {profissionais.map((prof, i) => {
            const gradAvatar = coresAvatar[i % coresAvatar.length];
            // Extrai a primeira cor do gradiente para usar no borderLeft
            const corBorda = ["#2D7EF8", "#10B981", "#7C3AED", "#f4bb11", "#EF4444"][i % 5];
            return (
              <div key={prof.id} className="prof-card" style={{ borderLeft: `3px solid ${corBorda}40` }}>

                {/* Avatar + dados */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: "48px", height: "48px",
                    borderRadius: "14px",
                    background: gradAvatar,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", fontWeight: "800", color: "white",
                    flexShrink: 0,
                    boxShadow: `0 4px 16px ${corBorda}35`,
                  }}>
                    {prof.full_name[0].toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "2px" }}>
                      <p style={{
                        color: "var(--text-primary)", fontSize: "14px", fontWeight: "700",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {prof.full_name}
                      </p>
                      {/* Badge ativo/inativo */}
                      <span style={{
                        flexShrink: 0,
                        background: prof.is_active ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)",
                        border: `1px solid ${prof.is_active ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`,
                        borderRadius: "999px", padding: "1px 8px",
                        color: prof.is_active ? "#34D399" : "#FCA5A5",
                        fontSize: "10px", fontWeight: "700",
                      }}>
                        {prof.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "4px" }}>
                      {prof.phone ? formatarTelefone(prof.phone) : "Sem telefone"}
                    </p>

                    {prof.commission_rate > 0 && (
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.2)",
                        borderRadius: "var(--radius-full)",
                        padding: "2px 8px",
                        color: "#10B981", fontSize: "10px", fontWeight: "700",
                      }}>
                        Comissão {prof.commission_rate}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => abrirEdicao(prof)}
                    title="Editar profissional"
                    className="prof-btn-edit"
                  >
                    <Pencil size={14} color="#93C5FD" />
                  </button>

                  <button
                    onClick={() => desativar(prof.id)}
                    title="Desativar profissional"
                    className="prof-btn-del"
                  >
                    <X size={15} color="#FCA5A5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>

      {/* Modal fora do animate-fade-up para não ser afetado pelo transform da animação */}
      {modalAberto && (
        <div className="bottom-sheet" onClick={() => { setModalAberto(false); setErro(""); }}>
          <div
            className="bottom-sheet-content"
            onClick={(e) => e.stopPropagation()}
            style={{ overflowY: "auto", maxHeight: "90vh", paddingBottom: "env(safe-area-inset-bottom, 40px)" }}
          >
            {/* Alça */}
            <div style={{
              width: "36px", height: "4px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: "var(--radius-full)",
              margin: "0 auto 24px",
            }} />

            {/* Cabeçalho do modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "46px", height: "46px", borderRadius: "14px", flexShrink: 0,
                  background: "linear-gradient(135deg, rgba(45,126,248,0.25), rgba(16,185,129,0.12))",
                  border: "1px solid rgba(45,126,248,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(45,126,248,0.2)",
                }}>
                  <UserPlus size={20} color="#2D7EF8" strokeWidth={2} />
                </div>
                <div>
                  <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: "800", marginBottom: "2px" }}>
                    Novo Profissional
                  </h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    Preencha os dados para cadastrar
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setModalAberto(false); setErro(""); }}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px", padding: "7px",
                  cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            {/* Linha bicolor decorativa */}
            <div style={{
              height: "1px", marginBottom: "22px",
              background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)",
            }} />

            <form onSubmit={cadastrar} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "Nome completo", value: nome, set: setNome, type: "text", placeholder: "João Silva", required: true },
                { label: "Email", value: email, set: setEmail, type: "email", placeholder: "joao@email.com", required: true },
                { label: "Senha", value: senha, set: setSenha, type: "password", placeholder: "••••••••", required: true },
                { label: "Telefone", value: telefone, set: setTelefone, type: "tel", placeholder: "(11) 99999-9999", required: false },
                { label: "Comissão (%)", value: comissao, set: setComissao, type: "number", placeholder: "0", required: false },
              ].map((campo) => (
                <div key={campo.label}>
                  <label className="label-premium">{campo.label}</label>
                  <input
                    className="input-premium"
                    type={campo.type}
                    placeholder={campo.placeholder}
                    value={campo.value}
                    onChange={(e) =>
                      campo.type === "tel"
                        ? campo.set(mascararTelefone(e.target.value))
                        : campo.set(e.target.value)
                    }
                    required={campo.required}
                  />
                </div>
              ))}

              {erro && (
                <div style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderLeft: "3px solid rgba(239,68,68,0.5)",
                  borderRadius: "var(--radius-md)", padding: "10px 14px",
                  color: "#FCA5A5", fontSize: "13px",
                }}>
                  {erro}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={salvando}
                style={{ width: "100%", marginTop: "4px", opacity: salvando ? 0.7 : 1 }}
              >
                {salvando ? "Cadastrando..." : "Cadastrar Profissional"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {profissionalEditando && (
        <div className="bottom-sheet" onClick={() => { setProfissionalEditando(null); setErroEdicao(""); }}>
          <div
            className="bottom-sheet-content"
            onClick={(e) => e.stopPropagation()}
            style={{ overflowY: "auto", maxHeight: "90vh", paddingBottom: "env(safe-area-inset-bottom, 40px)" }}
          >
            {/* Alça */}
            <div style={{
              width: "36px", height: "4px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: "var(--radius-full)",
              margin: "0 auto 24px",
            }} />

            {/* Cabeçalho do modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                {/* Avatar com inicial do profissional */}
                <div style={{
                  width: "46px", height: "46px", borderRadius: "14px", flexShrink: 0,
                  background: "linear-gradient(135deg, #2D7EF8, #1A5FCC)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", fontWeight: "800", color: "white",
                  boxShadow: "0 4px 16px rgba(45,126,248,0.3)",
                }}>
                  {profissionalEditando.full_name[0].toUpperCase()}
                </div>
                <div>
                  <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: "800", marginBottom: "2px" }}>
                    Editar dados do Profissional
                  </h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    {profissionalEditando.full_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setProfissionalEditando(null); setErroEdicao(""); }}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px", padding: "7px",
                  cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            {/* Linha bicolor decorativa */}
            <div style={{
              height: "1px", marginBottom: "22px",
              background: "linear-gradient(90deg, #2D7EF8, #10B981, transparent)",
            }} />

            <form onSubmit={salvarEdicao} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "Nome completo", value: editNome, set: setEditNome, type: "text", placeholder: "João Silva", required: true },
                { label: "Telefone", value: editTelefone, set: setEditTelefone, type: "tel", placeholder: "(11) 99999-9999", required: false },
                { label: "Comissão (%)", value: editComissao, set: setEditComissao, type: "number", placeholder: "0", required: false },
              ].map((campo) => (
                <div key={campo.label}>
                  <label className="label-premium">{campo.label}</label>
                  <input
                    className="input-premium"
                    type={campo.type}
                    placeholder={campo.placeholder}
                    value={campo.value}
                    onChange={(e) =>
                      campo.type === "tel"
                        ? campo.set(mascararTelefone(e.target.value))
                        : campo.set(e.target.value)
                    }
                    required={campo.required}
                    min={campo.type === "number" ? "0" : undefined}
                    max={campo.type === "number" ? "100" : undefined}
                    step={campo.type === "number" ? "0.1" : undefined}
                  />
                </div>
              ))}

              {erroEdicao && (
                <div style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderLeft: "3px solid rgba(239,68,68,0.5)",
                  borderRadius: "var(--radius-md)", padding: "10px 14px",
                  color: "#FCA5A5", fontSize: "13px",
                }}>
                  {erroEdicao}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={salvandoEdicao}
                style={{ width: "100%", marginTop: "4px", opacity: salvandoEdicao ? 0.7 : 1 }}
              >
                {salvandoEdicao ? "Salvando..." : "Salvar alterações"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}