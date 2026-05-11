// Axios é a biblioteca que faz as chamadas HTTP para o backend
import axios, { AxiosError } from "axios";

// Instância configurada do Axios para o AgendaFlow
// Toda chamada à API usa essa instância — nunca axios direto
// withCredentials envia o cookie HttpOnly de sessão automaticamente em toda requisição
const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de resposta
// Executa após CADA resposta — ou falha — do backend
api.interceptors.response.use(
  // Resposta bem-sucedida: apenas repassa
  (response) => response,

  // Tratamento de erros
  async (error: AxiosError) => {
    const config = error.config as typeof error.config & { _retry?: boolean };

    // 401 — cookie expirado ou inválido: limpa estado local e redireciona para login
    if (error.response?.status === 401) {
      localStorage.removeItem("agendaflow_usuario");
      localStorage.removeItem("agendaflow_tenant");
      // Evita loop: só redireciona se não estiver já na página de login
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    // Retry automático em erro de rede ou timeout (sem resposta do servidor)
    // Limite: 1 tentativa por requisição via flag _retry
    const isTimeoutOuRede =
      error.code === "ECONNABORTED" ||
      error.message === "Network Error" ||
      !error.response;

    if (isTimeoutOuRede && !config?._retry && config) {
      config._retry = true;
      // Aguarda 1 segundo antes de tentar novamente
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return api(config);
    }

    // Enriquece o erro com mensagem amigável para exibição na UI
    if (isTimeoutOuRede) {
      return Promise.reject(
        Object.assign(new Error(), error, {
          friendlyMessage:
            "O servidor está demorando para responder. Verifique sua conexão e tente novamente.",
        })
      );
    }

    return Promise.reject(error);
  }
);

export default api;
