import axios from "axios";

const TOKEN_KEY = "crm_token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem("crm_user");
      window.location.href = "/login";
      return Promise.reject(new Error("Sessão expirada. Faça login novamente."));
    }
    const detail = err.response?.data?.detail;
    let msg;
    if (Array.isArray(detail)) {
      msg = detail
        .map((e) => {
          const field = e.loc?.slice(-1)[0] ?? "campo";
          return `${field}: ${e.msg}`;
        })
        .join(" | ");
    } else {
      msg = typeof detail === "string" ? detail : err.message || "Erro desconhecido";
    }
    return Promise.reject(new Error(msg));
  }
);

// ── Solicitações (formulário público + triagem) ───────────────────────────────
export const solicitacoesApi = {
  listar: (params) => api.get("/solicitacoes/", { params }),
  stats: () => api.get("/solicitacoes/stats"),
  obter: (id) => api.get(`/solicitacoes/${id}`),
  criar: (payload) => api.post("/solicitacoes/", payload),
  uploadCertificado: (id, file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/solicitacoes/${id}/certificado`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  atualizar: (id, payload) => api.put(`/solicitacoes/${id}`, payload),
  triar: (id) => api.post(`/solicitacoes/${id}/triar`),
  aprovar: (id, data) => api.post(`/solicitacoes/${id}/aprovar`, data),
  recusar:  (id, data) => api.post(`/solicitacoes/${id}/recusar`, data),
  cancelar: (id, data) => api.post(`/solicitacoes/${id}/cancelar`, data),
  reenviarEmail: (id) => api.post(`/solicitacoes/${id}/reenviar-email`),
  // Revisão pública pelo cliente
  obterRevisao: (token) => api.get(`/solicitacoes/revisao/${token}`),
  submitRevisao: (token, payload) => api.put(`/solicitacoes/revisao/${token}`, payload),
  uploadCertRevisao: (token, file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/solicitacoes/revisao/${token}/certificado`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Implantações ─────────────────────────────────────────────────────────────
export const implantacoesApi = {
  listar: (params) => api.get("/implantacoes/", { params }),
  stats: () => api.get("/implantacoes/stats"),
  obter: (id) => api.get(`/implantacoes/${id}`),
  atualizar: (id, data) => api.patch(`/implantacoes/${id}`, data),
  adicionarComentario: (id, data) => api.post(`/implantacoes/${id}/comentarios`, data),
  atualizarChecklist: (itemId, data) => api.patch(`/implantacoes/checklist/${itemId}`, data),
  criarChecklist: (implId, data) => api.post(`/implantacoes/${implId}/checklist`, data),
  deletarChecklist: (itemId) => api.delete(`/implantacoes/checklist/${itemId}`),
  atualizarEtapa: (implId, etapaId, data) => api.patch(`/implantacoes/${implId}/etapas/${etapaId}`, data),
};

// ── Clientes ─────────────────────────────────────────────────────────────────
export const clientesApi = {
  listar: () => api.get("/clientes/"),
  obter: (id) => api.get(`/clientes/${id}`),
  buscarPorCnpj: (cnpj) => api.get("/clientes/buscar-cnpj", { params: { cnpj } }),
  buscarPorEmail: (email) => api.get("/clientes/buscar-email", { params: { email } }),
  atualizar: (id, data) => api.patch(`/clientes/${id}`, data),
  gerarBase: (id, ambiente) => api.get(`/clientes/${id}/gerar-base`, { params: { ambiente }, responseType: "blob" }),
  infoCertificado: (id) => api.get(`/clientes/${id}/certificado/info`),
  baixarCertificado: (id) => api.get(`/clientes/${id}/certificado`, { responseType: "blob" }),
};

// ── Templates ─────────────────────────────────────────────────────────────────
export const templatesApi = {
  listar: (params) => api.get("/templates/", { params }),
  obter: (id) => api.get(`/templates/${id}`),
  criar: (data) => api.post("/templates/", data),
  atualizar: (id, data) => api.patch(`/templates/${id}`, data),
  deletar: (id) => api.delete(`/templates/${id}`),
  adicionarEtapa: (templateId, data) => api.post(`/templates/${templateId}/etapas`, data),
  atualizarEtapa: (etapaId, data) => api.patch(`/templates/etapas/${etapaId}`, data),
  deletarEtapa: (etapaId) => api.delete(`/templates/etapas/${etapaId}`),
  adicionarTarefa: (etapaId, data) => api.post(`/templates/etapas/${etapaId}/tarefas`, data),
  atualizarTarefa: (tarefaId, data) => api.patch(`/templates/tarefas/${tarefaId}`, data),
  deletarTarefa: (tarefaId) => api.delete(`/templates/tarefas/${tarefaId}`),
  // POP geral do template
  uploadPopTemplate: (templateId, file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/templates/${templateId}/pop`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deletarPopTemplate: (templateId) => api.delete(`/templates/${templateId}/pop`),
  visualizarPopTemplate: (templateId) => api.get(`/templates/${templateId}/pop`, { responseType: "blob" }),
  // POP (PDF de referência por tarefa)
  uploadPop: (tarefaId, file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/templates/tarefas/${tarefaId}/pop`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deletarPop: (tarefaId) => api.delete(`/templates/tarefas/${tarefaId}/pop`),
  visualizarPop: (tarefaId) => api.get(`/templates/tarefas/${tarefaId}/pop`, { responseType: "blob" }),
};

// ── Instalações ───────────────────────────────────────────────────────────────
export const instalacaosApi = {
  listar: (params) => api.get("/instalacoes/", { params }),
  stats: () => api.get("/instalacoes/stats"),
  tipos: () => api.get("/instalacoes/tipos"),
  obter: (id) => api.get(`/instalacoes/${id}`),
  criar: (data) => api.post("/instalacoes/", data),
  atualizar: (id, data) => api.patch(`/instalacoes/${id}`, data),
  deletar: (id) => api.delete(`/instalacoes/${id}`),
  atualizarItem: (instId, itemId, data) => api.patch(`/instalacoes/${instId}/checklist/${itemId}`, data),
  adicionarItem: (instId, data) => api.post(`/instalacoes/${instId}/checklist`, data),
  deletarItem: (instId, itemId) => api.delete(`/instalacoes/${instId}/checklist/${itemId}`),
  adicionarComentario: (instId, data) => api.post(`/instalacoes/${instId}/comentarios`, data),
  iniciar: (instId) => api.post(`/instalacoes/${instId}/iniciar`),
  finalizar: (instId, data) => api.post(`/instalacoes/${instId}/finalizar`, data),
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  kpis: () => api.get("/dashboard/kpis"),
};

// ── Configurações ─────────────────────────────────────────────────────────────
export const configuracoesApi = {
  infoBase: () => api.get("/configuracoes/base-zerada/info"),
  uploadBase: (file, versao = "") => {
    const form = new FormData();
    form.append("file", file);
    form.append("versao", versao);
    return api.post("/configuracoes/base-zerada", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getEmail: () => api.get("/configuracoes/email"),
  saveEmail: (data) => api.put("/configuracoes/email", data),
  testarEmail: (data) => api.post("/configuracoes/email/testar", data),
  // Integração ERP
  getErp: () => api.get("/configuracoes/erp"),
  saveErp: (data) => api.put("/configuracoes/erp", data),
  testarErp: (data) => api.post("/configuracoes/erp/testar", data),
  erpClientes: (cnpj = "") => api.get("/configuracoes/erp/clientes", { params: cnpj ? { cnpj } : {} }),
  erpResolveCliente: (data) => api.post("/configuracoes/erp/clientes/resolve", data),
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, senha) => api.post("/auth/login", { email, senha }),
  me: () => api.get("/auth/me"),
  registro: (data) => api.post("/auth/registro", data),
  definirSenha: (token, senha) => api.post(`/auth/definir-senha/${token}`, { senha }),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/auth/me/avatar", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

// ── Usuários ──────────────────────────────────────────────────────────────────
export const usuariosApi = {
  listar: () => api.get("/usuarios/"),
  obter: (id) => api.get(`/usuarios/${id}`),
  criar: (data) => api.post("/usuarios/", data),
  atualizar: (id, data) => api.patch(`/usuarios/${id}`, data),
  deletar: (id) => api.delete(`/usuarios/${id}`),
  aprovar: (id, data) => api.post(`/usuarios/${id}/aprovar`, data),
  reenviarSenha: (id) => api.post(`/usuarios/${id}/reenviar-senha`),
  pendentesCount: () => api.get("/usuarios/pendentes/count"),
};

// ── Grupos de Permissão ───────────────────────────────────────────────────────
export const gruposApi = {
  listar: () => api.get("/grupos-permissao/"),
  obter: (id) => api.get(`/grupos-permissao/${id}`),
  criar: (data) => api.post("/grupos-permissao/", data),
  atualizar: (id, data) => api.patch(`/grupos-permissao/${id}`, data),
  deletar: (id) => api.delete(`/grupos-permissao/${id}`),
};

// ── BD Restore ───────────────────────────────────────────────────────────────
export const bdRestoreApi = {
  analisar: (formData) =>
    api.post("/bd-restore/analisar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    }),
  gerar: (sessionId, ambiente) =>
    api.post(
      "/bd-restore/gerar",
      { session_id: sessionId, ambiente },
      { responseType: "blob", timeout: 120_000 },
    ),
};

export default api;
