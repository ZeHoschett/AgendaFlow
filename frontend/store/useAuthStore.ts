import { create } from "zustand";
import api from "@/lib/api";

interface Usuario {
  id: string;
  email: string;
  role: "admin" | "professional" | "client";
  full_name: string;
  tenant: string;
}

interface AuthState {
  usuario: Usuario | null;
  tenantSlug: string | null;
  login: (usuario: Usuario, tenantSlug: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  rehidratar: () => void;
}

const useAuthStore = create<AuthState>((set, get) => ({
  // Começa sempre null — sem ler localStorage no servidor (evita hydration error SSR)
  usuario: null,
  tenantSlug: null,

  login: (usuario, tenantSlug) => {
    // Token não salvo no localStorage — o browser gerencia o cookie HttpOnly
    localStorage.setItem("agendaflow_usuario", JSON.stringify(usuario));
    localStorage.setItem("agendaflow_tenant", tenantSlug);
    set({ usuario, tenantSlug });
  },

  logout: async () => {
    try {
      // Remove o cookie de sessão no servidor
      await api.post("/auth/logout");
    } catch {
      // Prossegue com o logout local mesmo se o servidor falhar
    }
    localStorage.removeItem("agendaflow_usuario");
    localStorage.removeItem("agendaflow_tenant");
    set({ usuario: null, tenantSlug: null });
  },

  isAuthenticated: () => get().usuario !== null,

  // Lê o localStorage e restaura o estado após reload da página.
  // Deve ser chamada uma única vez dentro de useEffect (nunca no corpo do componente).
  rehidratar: () => {
    const tenantSlug = localStorage.getItem("agendaflow_tenant");
    const usuarioRaw = localStorage.getItem("agendaflow_usuario");

    if (!tenantSlug || !usuarioRaw) return;

    try {
      const usuario: Usuario = JSON.parse(usuarioRaw);
      set({ usuario, tenantSlug });
    } catch {
      // Dado corrompido no localStorage — limpa para evitar estado inválido
      localStorage.removeItem("agendaflow_usuario");
      localStorage.removeItem("agendaflow_tenant");
    }
  },
}));

export default useAuthStore;
