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
      const isLoginAttempt = err.config?.url?.includes("/auth/login");
      if (!isLoginAttempt) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem("crm_user");
        window.location.href = "/login";
        return Promise.reject(new Error("Sessão expirada. Faça login novamente."));
      }
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

// ── CNPJ (fallback de busca — proxy no backend por causa de CORS na ReceitaWS) ─
export const cnpjApi = {
  receitaWs: (cnpj) => api.get(`/cnpj/${cnpj}/receita-ws`),
};

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
  atribuirResponsavel: (id, responsavel_id) => api.post(`/solicitacoes/${id}/atribuir`, { responsavel_id }),
  atualizarProdutosContratados: (id, payload) => api.put(`/solicitacoes/${id}/produtos-contratados`, payload),
  atualizarConversaoDados: (id, conversao_dados) => api.put(`/solicitacoes/${id}/conversao-dados`, { conversao_dados }),
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
  criarSubitem: (implId, itemId, data) => api.post(`/implantacoes/${implId}/checklist/${itemId}/subitens`, data),
  atualizarEtapa: (implId, etapaId, data) => api.patch(`/implantacoes/${implId}/etapas/${etapaId}`, data),
  criarEtapa: (implId, data) => api.post(`/implantacoes/${implId}/etapas`, data),
  deletarEtapa: (implId, etapaId) => api.delete(`/implantacoes/${implId}/etapas/${etapaId}`),
  reordenarEtapas: (implId, ordens) => api.post(`/implantacoes/${implId}/etapas/reordenar`, { ordens }),
  reordenarChecklist: (implId, ordens) => api.post(`/implantacoes/${implId}/checklist/reordenar`, { ordens }),
  registrarGoLive: (implId, data_go_live = null) => api.post(`/implantacoes/${implId}/go-live`, data_go_live ? { data_go_live } : {}),
  removerGoLive: (implId) => api.delete(`/implantacoes/${implId}/go-live`),
};

// ── Clientes ─────────────────────────────────────────────────────────────────
export const clientesApi = {
  listar: () => api.get("/clientes/"),
  obter: (id) => api.get(`/clientes/${id}`),
  buscarPorCnpj: (cnpj) => api.get("/clientes/buscar-cnpj", { params: { cnpj } }),
  buscarPorEmail: (email) => api.get("/clientes/buscar-email", { params: { email } }),
  atualizar: (id, data) => api.patch(`/clientes/${id}`, data),
  gerarBase: (id, ambiente) => api.get(`/clientes/${id}/gerar-base`, { params: { ambiente }, responseType: "blob" }),
  gerarChaveApi: (id) => api.post(`/clientes/${id}/gerar-chave-api`),
  infoCertificado: (id) => api.get(`/clientes/${id}/certificado/info`),
  baixarCertificado: (id) => api.get(`/clientes/${id}/certificado`, { responseType: "blob" }),
};

// ── Assistente Criare (solicitações de instalação) ─────────────────────────────
export const solicitacoesInstaladorApi = {
  listar: (params) => api.get("/solicitacoes-instalador/", { params }),
  aprovar: (id) => api.post(`/solicitacoes-instalador/${id}/aprovar`),
  recusar: (id) => api.post(`/solicitacoes-instalador/${id}/recusar`),
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
  adicionarSubTarefa: (tarefaId, data) => api.post(`/templates/tarefas/${tarefaId}/subitens`, data),
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
  pausar: (instId, motivo = null) => api.post(`/instalacoes/${instId}/pausar`, { motivo }),
  retomar: (instId) => api.post(`/instalacoes/${instId}/retomar`),
  finalizar: (instId, data) => api.post(`/instalacoes/${instId}/finalizar`, data),
  editarAntes: (instId, data) => api.put(`/instalacoes/${instId}/editar`, data),
  uploadAnexo: (instId, file, uploadedBy = "Admin") => {
    const form = new FormData();
    form.append("file", file);
    form.append("uploaded_by", uploadedBy);
    return api.post(`/instalacoes/${instId}/anexos`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deletarAnexo: (instId, anexoId) => api.delete(`/instalacoes/${instId}/anexos/${anexoId}`),
  downloadAnexo: (instId, anexoId) =>
    api.get(`/instalacoes/${instId}/anexos/${anexoId}/download`, { responseType: "blob" }),
  adicionarResponsavel: (instId, payload) => api.post(`/instalacoes/${instId}/responsaveis`, payload),
  removerResponsavel: (instId, usuarioId) => api.delete(`/instalacoes/${instId}/responsaveis/${usuarioId}`),
};

// ── Notificações ─────────────────────────────────────────────────────────────
export const notificacoesApi = {
  listar: () => api.get("/notificacoes/"),
  naoLidasCount: () => api.get("/notificacoes/nao-lidas-count"),
  marcarLida: (id) => api.patch(`/notificacoes/${id}/lida`),
  marcarTodasLidas: () => api.patch("/notificacoes/lidas-todas"),
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
  testarEmail: (data) => api.post("/configuracoes/email/testar", data, { timeout: 30000 }),
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
  logout: () => api.post("/auth/logout"),
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
  senhaDia: () => api.get("/usuarios/senha-dia"),
  alterarSenha: (data) => api.post("/usuarios/me/alterar-senha", data),
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
      { responseType: "blob", timeout: 600_000 },
    ),
};

// ── Resultados ────────────────────────────────────────────────────────────────
export const resultadosApi = {
  visaoGeral:    (params) => api.get("/resultados/visao-geral",    { params }),
  evolucao:      (params) => api.get("/resultados/evolucao-mensal", { params }),
  equipe:        (params) => api.get("/resultados/equipe",         { params }),
  produtos:      (params) => api.get("/resultados/produtos",       { params }),
  porEstado:     (params) => api.get("/resultados/por-estado",     { params }),
  clientesMapa:  (params) => api.get("/resultados/clientes-mapa",  { params }),
  porConsultor:  (params) => api.get("/resultados/por-consultor",  { params }),
};

export default api;
