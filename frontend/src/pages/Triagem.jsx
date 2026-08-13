import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { Badge, PrioridadeBadge } from "../components/ui/Badge";
import { solicitacoesApi, templatesApi, clientesApi, usuariosApi } from "../services/api";
import { BANCOS_BR } from "../data/bancos";
import { fmtDate, parseUTC } from "../utils/dateUtils";
import { maskPhone, maskCnpj, maskCpf } from "../hooks/useCnpj";
import i18n from "../i18n";

export const TERMINAL_STATUSES = ["aprovada", "recusada", "cancelada"];

export function slaRelativo(sol) {
  if (TERMINAL_STATUSES.includes(sol.status)) return null;
  if (!sol.sla_limite) return null;

  const isCliente = sol.status === "aguardando_correcao";
  const diff = parseUTC(sol.sla_limite) - Date.now();

  if (diff < 0) {
    if (isCliente) return { label: i18n.t("triagem:sla.linkExpired"), level: "expired", isCliente: true };
    const h = Math.ceil(Math.abs(diff) / 3600000);
    const d = Math.floor(h / 24);
    return {
      label: d >= 1 ? i18n.t("triagem:sla.overdueDays", { count: d }) : i18n.t("triagem:sla.overdueHours", { count: h }),
      level: "expired",
    };
  }

  const totalH = Math.floor(diff / 3600000);
  const d = Math.ceil(totalH / 24); // ceil: 6d23h ainda conta como 7 dias restantes

  if (isCliente) {
    if (totalH < 24) return { label: i18n.t("triagem:sla.clientToday"),    level: "urgent",  isCliente: true };
    if (d === 1)     return { label: i18n.t("triagem:sla.clientTomorrow"), level: "warning", isCliente: true };
    return           { label: i18n.t("triagem:sla.clientDays", { count: d }), level: "ok",   isCliente: true };
  }

  if (totalH < 24) return { label: i18n.t("triagem:sla.dueToday"), level: "urgent" };
  if (d === 1)     return { label: i18n.t("triagem:sla.tomorrow"), level: "warning" };
  return           { label: i18n.t("triagem:sla.daysLeft", { count: d }), level: "ok" };
}

export const SLA_PILL = {
  expired: "text-red-600   bg-red-50   border-red-200",
  urgent:  "text-amber-700 bg-amber-50 border-amber-200",
  warning: "text-yellow-700 bg-yellow-50 border-yellow-200",
  ok:      "text-green-700 bg-green-50 border-green-100",
};

export const STATUS_ACCENT = {
  nova:                "bg-blue-400",
  em_triagem:          "bg-amber-400",
  aguardando_correcao: "bg-orange-400",
  aprovada:            "bg-green-500",
  recusada:            "bg-red-400",
  cancelada:           "bg-gray-300",
};

// ── Primitives ────────────────────────────────────────────────────────────────

export function Field({ label, value, mono = false, actions }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className={`text-sm text-gray-800 break-words ${mono ? "font-mono text-xs" : ""}`}>
          {value || <span className="text-gray-300">—</span>}
        </p>
        {value && actions}
      </div>
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-2 mb-3 border-b border-gray-100">
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
}

// ── Approval Modal ────────────────────────────────────────────────────────────

export function AprovarModal({ sol, onClose, onApproved }) {
  const { t } = useTranslation("triagem");
  const [templates, setTemplates]               = useState([]);
  const [templateDetails, setTemplateDetails]   = useState({}); // id → full template with etapas
  const [form, setForm]                         = useState({
    template_ids: [], consultor: "", prioridade: "normal", sla_dias: 30, observacoes: "",
    conversao_dados: sol.conversao_dados || false,
  });
  // step: "form" | "confirmar_cliente"
  const [step, setStep]                         = useState("form");
  const [clienteExistente, setClienteExistente] = useState(null);
  const [checking, setChecking]                 = useState(false);
  const [saving, setSaving]                     = useState(false);
  const [error, setError]                       = useState("");

  useEffect(() => {
    templatesApi.listar().then(async ({ data }) => {
      // Exclui templates de produtos de instalação (tipo = "instalacao_*")
      const implantacaoTemplates = data.filter((tpl) => !tpl.tipo?.startsWith("instalacao_"));
      setTemplates(implantacaoTemplates);
      // Pre-fetch full details for stage preview
      const details = await Promise.all(
        implantacaoTemplates.map((tpl) => templatesApi.obter(tpl.id).then((r) => r.data).catch(() => tpl))
      );
      const map = {};
      details.forEach((tpl) => { map[tpl.id] = tpl; });
      setTemplateDetails(map);
    });
  }, []);

  function toggleTemplate(id) {
    setForm((f) => ({
      ...f,
      template_ids: f.template_ids.includes(id)
        ? f.template_ids.filter((x) => x !== id)
        : [...f.template_ids, id],
    }));
  }

  // 1 chip por módulo selecionado = 1 coluna por produto no Kanban
  function getMergedStages() {
    return form.template_ids.map((id) => {
      const tpl = templateDetails[id];
      const cor = tpl?.etapas?.[0]?.cor || "#6366f1";
      return { nome: tpl?.nome || `Módulo ${id}`, cor };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.template_ids.length === 0) { setError(t("approveModal.errorNoModule")); return; }

    // Verifica se o CNPJ já está cadastrado na base de clientes
    setChecking(true);
    setError("");
    try {
      const { data: cliente } = await clientesApi.buscarPorCnpj(sol.cnpj);
      // CNPJ encontrado → pede confirmação antes de prosseguir
      setClienteExistente(cliente);
      setStep("confirmar_cliente");
    } catch {
      // 404 = CNPJ livre → aprovação direta
      await submeterAprovacao();
    } finally {
      setChecking(false);
    }
  }

  async function submeterAprovacao() {
    setSaving(true);
    setError("");
    try {
      const { data: impl } = await solicitacoesApi.aprovar(sol.id, {
        template_ids: form.template_ids.map(Number),
        consultor: form.consultor,
        prioridade: form.prioridade,
        sla_dias: parseInt(form.sla_dias),
        observacoes: form.observacoes,
        conversao_dados: form.conversao_dados,
      });
      onApproved(impl);
    } catch (err) {
      setError(err.message);
      setStep("form");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400";
  const mergedStages = getMergedStages();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: "90vh" }}>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">{t("approveModal.title")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sol.razao_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Passo 1: layout dois painéis ── */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

            {/* Corpo: dois painéis — coluna em mobile, lado a lado em md+ */}
            <div className="flex flex-col md:flex-row flex-1 min-h-0 md:divide-x divide-gray-100 overflow-y-auto md:overflow-hidden">

              {/* Painel esquerdo: módulos */}
              <div className="flex flex-col md:w-[42%] shrink-0 min-h-[240px] md:min-h-0 border-b md:border-b-0 divide-gray-100">
                <div className="px-5 pt-4 pb-2 shrink-0">
                  <p className="text-xs font-semibold text-gray-500">
                    {t("approveModal.modulesTitle")}
                    <span className="ml-1.5 font-normal text-gray-400">
                      {t("approveModal.modulesSelectedCount", { count: form.template_ids.length })}
                    </span>
                  </p>
                </div>

                {/* Lista de módulos com scroll */}
                <div className="overflow-y-auto flex-1 px-5 pb-3 space-y-1.5">
                  {templates.length === 0 && (
                    <p className="text-xs text-gray-400 py-4 text-center">{t("approveModal.loadingModules")}</p>
                  )}
                  {templates.map((tpl) => {
                    const checked = form.template_ids.includes(tpl.id);
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => toggleTemplate(tpl.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                          checked ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-[16px] h-[16px] rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "bg-indigo-500 border-indigo-500" : "border-gray-300"
                        }`}>
                          {checked && (
                            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-xs font-semibold flex-1 truncate ${checked ? "text-indigo-700" : "text-gray-700"}`}>
                          {tpl.nome}
                        </span>
                        {tpl.sla_total_dias > 0 && (
                          <span className="text-[10px] text-gray-400 shrink-0">{t("approveModal.slaDaysSuffix", { count: tpl.sla_total_dias })}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Preview das colunas do Kanban */}
                <div className="px-5 pb-4 shrink-0">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                      {t("approveModal.kanbanColumnsTitle")}
                    </p>
                    {mergedStages.length === 0 ? (
                      <p className="text-[11px] text-gray-400">{t("approveModal.noModuleSelected")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {mergedStages.map((s, i) => {
                          const hex = s.cor && s.cor.startsWith("#") && s.cor.length >= 7 ? s.cor : "#6366f1";
                          const r = parseInt(hex.slice(1, 3), 16);
                          const g = parseInt(hex.slice(3, 5), 16);
                          const b = parseInt(hex.slice(5, 7), 16);
                          return (
                            <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border"
                              style={{ backgroundColor: `rgba(${r},${g},${b},0.10)`, color: hex, borderColor: `rgba(${r},${g},${b},0.30)` }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                              {s.nome}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Painel direito: configuração */}
              <div className="flex-1 md:overflow-y-auto px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("approveModal.consultorLabel")}</label>
                    <input type="text" value={form.consultor} onChange={(e) => setForm((f) => ({ ...f, consultor: e.target.value }))} placeholder={t("approveModal.consultorPlaceholder")} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("approveModal.slaDaysLabel")}</label>
                    <input type="number" min={1} max={365} value={form.sla_dias} onChange={(e) => setForm((f) => ({ ...f, sla_dias: e.target.value }))} className={inp} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("approveModal.priorityLabel")}</label>
                  <div className="flex gap-2">
                    {["baixa", "normal", "alta", "critica"].map((p) => (
                      <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, prioridade: p }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.prioridade === p ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        {t(`priority.${p}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, conversao_dados: !f.conversao_dados }))}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    form.conversao_dados ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    form.conversao_dados ? "bg-blue-500" : "bg-gray-300"
                  }`}>
                    {form.conversao_dados && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${form.conversao_dados ? "text-blue-700" : "text-gray-600"}`}>
                      {t("approveModal.dataConversionTitle")}
                    </p>
                    <p className="text-xs text-gray-400">{t("approveModal.dataConversionDesc")}</p>
                  </div>
                </button>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("approveModal.notesLabel")}</label>
                  <textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder={t("approveModal.notesPlaceholder")} className={`${inp} resize-none`} />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            </div>

            {/* Rodapé fixo */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                {t("approveModal.cancel")}
              </button>
              <button type="submit" disabled={checking || saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {checking ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("approveModal.checking")}</>
                ) : saving ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("approveModal.approving")}</>
                ) : t("approveModal.confirmButton")}
              </button>
            </div>
          </form>
        )}

        {/* ── Passo 2: cliente já existe, pede confirmação ── */}
        {step === "confirmar_cliente" && clienteExistente && (
          <div className="px-6 py-5 space-y-4">
            {/* Alerta */}
            <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">{t("approveModal.cnpjExistsTitle")}</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  {t("approveModal.cnpjExistsDesc")}
                </p>
              </div>
            </div>

            {/* Card do cliente existente */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{t("approveModal.existingClientLabel")}</p>
                <p className="text-sm font-semibold text-gray-900">{clienteExistente.razao_social}</p>
                {clienteExistente.nome_fantasia && (
                  <p className="text-xs text-gray-500">{clienteExistente.nome_fantasia}</p>
                )}
              </div>
              <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{t("approveModal.cnpjLabel")}</p>
                  <p className="text-xs font-mono text-gray-700">{clienteExistente.cnpj}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{t("approveModal.emailLabel")}</p>
                  <p className="text-xs text-gray-700 truncate">{clienteExistente.email}</p>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setStep("form"); setError(""); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                {t("approveModal.back")}
              </button>
              <button type="button" onClick={submeterAprovacao} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("approveModal.approving")}</>
                ) : t("approveModal.useExistingClient")}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Refusal Modal ─────────────────────────────────────────────────────────────

export const SECOES_CORRECAO_KEYS = [
  "empresa", "contato", "endereco", "contabilidade", "banco",
  "regime", "pagamento", "fiscal", "certificado", "adquirentes",
];

export function RecusarModal({ sol, onClose, onRefused }) {
  const { t } = useTranslation("triagem");
  const [motivo, setMotivo]               = useState("");
  const [camposSelecionados, setCampos]   = useState([]);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");

  function toggleSecao(key) {
    setCampos((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!motivo.trim()) { setError(t("refuseModal.errorReasonRequired")); return; }
    if (camposSelecionados.length === 0) { setError(t("refuseModal.errorSectionsRequired")); return; }
    setSaving(true);
    setError("");
    try {
      await solicitacoesApi.recusar(sol.id, { motivo, campos_correcao: camposSelecionados });
      onRefused();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">{t("refuseModal.title")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sol.razao_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("refuseModal.reasonLabel")}</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder={t("refuseModal.reasonPlaceholder")}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              {t("refuseModal.sectionsLabel")}
              <span className="text-gray-400 font-normal ml-1">{t("refuseModal.sectionsHint")}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SECOES_CORRECAO_KEYS.map((key) => {
                const checked = camposSelecionados.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSecao(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                      checked
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                      checked ? "bg-red-500 border-red-500" : "border-gray-300"
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {t(`correctionSections.${key}`)}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              {t("refuseModal.back")}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
              {saving ? t("refuseModal.sending") : t("refuseModal.confirmButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Cancel Modal ──────────────────────────────────────────────────────────────

export function CancelarModal({ sol, onClose, onCancelled }) {
  const { t } = useTranslation("triagem");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await solicitacoesApi.cancelar(sol.id, { motivo: motivo.trim() || null });
      onCancelled();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{t("cancelModal.title")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sol.razao_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              {t("cancelModal.warningPart1")} <strong>{t("cancelModal.warningStrong")}</strong>{t("cancelModal.warningPart2")}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("cancelModal.reasonLabel")}</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder={t("cancelModal.reasonPlaceholder")}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              {t("cancelModal.back")}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {saving ? t("cancelModal.cancelling") : t("cancelModal.confirmButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Bank Selector (plain-state variant for EditModal) ─────────────────────────

function BankSelectorEdit({ form, set, inp }) {
  const { t } = useTranslation("triagem");
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  const nome   = form.nome_banco   || "";
  const codigo = form.codigo_banco || "";
  const cnpj   = form.cnpj_banco   || "";

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = BANCOS_BR
    .filter((b) => {
      const q = query.toLowerCase();
      return b.nome.toLowerCase().includes(q) || b.codigo.includes(q);
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  function select(banco) {
    set("nome_banco",   banco.nome);
    set("cnpj_banco",   banco.cnpj);
    set("codigo_banco", banco.codigo);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    set("nome_banco",   "");
    set("cnpj_banco",   "");
    set("codigo_banco", "");
    setQuery("");
    setOpen(true);
  }

  if (nome && !open) {
    return (
      <div className="col-span-2 flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
        <span className="w-12 h-10 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-bold font-mono shrink-0 shadow-sm">
          {codigo || "—"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{nome}</p>
          {cnpj && <p className="text-xs text-gray-500 mt-0.5 font-mono">{cnpj}</p>}
        </div>
        <button type="button" onClick={clear}
          className="text-xs text-gray-600 hover:text-gray-800 px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors shrink-0 font-medium">
          {t("editModal.bank.change")}
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-2 relative" ref={ref}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.bank.label")}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t("editModal.bank.searchPlaceholder")}
          autoComplete="off"
          className={`${inp} pr-9`}
        />
        <svg className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((b) => (
            <button key={b.codigo} type="button" onMouseDown={() => select(b)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left border-b border-gray-50 last:border-b-0">
              <span className="w-8 text-[11px] font-bold font-mono text-blue-600 shrink-0">{b.codigo}</span>
              <span className="text-sm text-gray-700 flex-1 truncate">{b.nome}</span>
              <span className="text-[10px] font-mono text-gray-400 shrink-0">{b.cnpj}</span>
            </button>
          )) : (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">
              {t("editModal.bank.notFound", { query })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

export function EditModal({ sol, onClose, onSaved }) {
  const { t } = useTranslation("triagem");
  const [tab, setTab] = useState("empresa");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [certFile, setCertFile] = useState(null);

  const currentCertName = sol.certificado_path
    ? sol.certificado_path.replace(/\\/g, "/").split("/").pop()
    : null;

  const ct = sol.contabilidade || {};
  const e  = sol.endereco || {};
  const dc = sol.dados_contabeis || {};
  const df = sol.dados_fiscais || {};
  const fp = sol.formas_pagamento || {};
  const db = sol.dados_bancarios || {};

  const [form, setForm] = useState({
    razao_social: sol.razao_social || "",
    nome_fantasia: sol.nome_fantasia || "",
    cnpj: sol.cnpj || "",
    ie: sol.ie || "",
    email: sol.email || "",
    responsavel: sol.responsavel || "",
    telefone_fixo: sol.telefone_fixo || "",
    telefone_celular: sol.telefone_celular || "",
    cep: e.cep || "", endereco: e.endereco || "", numero: e.numero || "",
    bairro: e.bairro || "", cidade: e.cidade || "", estado: e.estado || "",
    nome_contador: ct.nome_contador || "", cpf_contador: ct.cpf || "",
    crc: ct.crc || "", cnpj_contador: ct.cnpj || "",
    email_contador: ct.email || "", tel_fixo_contador: ct.telefone_fixo || "",
    tel_cel_contador: ct.telefone_celular || "",
    cep_contador: ct.cep || "", end_contador: ct.endereco || "",
    num_contador: ct.numero || "", bairro_contador: ct.bairro || "",
    cidade_contador: ct.cidade || "", estado_contador: ct.estado || "",
    crt: dc.crt || "", regime_tributario: dc.regime_tributario || "",
    condicao_st: dc.condicao_st || "", aliq_simples: dc.aliq_simples || "",
    receita_bruta: dc.receita_bruta || "",
    csc: df.csc || "", token: df.token || "", serie_nfe: df.serie_nfe || "",
    ultima_serie_nfce: df.ultima_serie_nfce || "",
    ultima_nfe_emitida: df.ultima_nfe_emitida || "",
    senha_certificado: df.senha_certificado || "",
    fp_dinheiro:        !!fp.dinheiro,
    fp_cheque:          !!fp.cheque,
    fp_cartao_pos:      !!fp.cartao_pos,
    fp_pagamento_prazo: !!fp.pagamento_prazo,
    fp_pix:             !!fp.pix,
    fp_cartao_tef:      !!fp.cartao_tef,
    fp_integradora:     fp.integradora || "",
    // bancário
    nome_banco:   db.nome_banco   || "",
    cnpj_banco:   db.cnpj_banco   || "",
    codigo_banco: db.codigo_banco || "",
    agencia:      db.agencia      || "",
    dv_agencia:   db.dv_agencia   || "",
    conta:        db.conta        || "",
    dv_conta:     db.dv_conta     || "",
    tipo_conta:   db.tipo_conta   || "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400";

  function buildPayload() {
    const isSimples = form.regime_tributario === "1" || form.crt === "1" || form.crt === "2";
    return {
      cliente: {
        razao_social: form.razao_social, nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj, ie: form.ie || null, email: form.email,
        telefone_fixo: form.telefone_fixo || null, telefone_celular: form.telefone_celular,
        responsavel: form.responsavel || null,
      },
      endereco: {
        cep: form.cep, endereco: form.endereco, numero: form.numero,
        bairro: form.bairro, cidade: form.cidade, estado: form.estado.toUpperCase(),
      },
      contabilidade: {
        nome_contador: form.nome_contador, cpf: form.cpf_contador, crc: form.crc || null,
        cnpj: form.cnpj_contador || null, email: form.email_contador || null,
        telefone_fixo: form.tel_fixo_contador || null, telefone_celular: form.tel_cel_contador || null,
        cep: form.cep_contador || null, endereco: form.end_contador || null,
        numero: form.num_contador || null, bairro: form.bairro_contador || null,
        cidade: form.cidade_contador || null,
        estado: form.estado_contador ? form.estado_contador.toUpperCase() : null,
      },
      dados_bancarios: {
        nome_banco:   form.nome_banco   || null,
        cnpj_banco:   form.cnpj_banco   || null,
        codigo_banco: form.codigo_banco || null,
        agencia:      form.agencia      || null,
        dv_agencia:   form.dv_agencia   || null,
        conta:        form.conta        || null,
        dv_conta:     form.dv_conta     || null,
        tipo_conta:   form.tipo_conta   || null,
      },
      dados_contabeis: {
        crt: form.crt || null, regime_tributario: form.regime_tributario || null,
        condicao_st: form.condicao_st || null,
        aliq_simples: isSimples ? (form.aliq_simples || null) : null,
        receita_bruta: isSimples ? (form.receita_bruta || null) : null,
      },
      formas_pagamento: {
        dinheiro:        form.fp_dinheiro,
        cheque:          form.fp_cheque,
        cartao_pos:      form.fp_cartao_pos,
        pagamento_prazo: form.fp_pagamento_prazo,
        pix:             form.fp_pix,
        cartao_tef:      form.fp_cartao_tef,
        integradora:     form.fp_integradora || null,
      },
      dados_fiscais: {
        csc: form.csc || null, token: form.token || null, serie_nfe: form.serie_nfe || null,
        ultima_serie_nfce: form.ultima_serie_nfce || null,
        ultima_nfe_emitida: form.ultima_nfe_emitida || null,
        senha_certificado: form.senha_certificado || null,
      },
    };
  }

  async function handleSave() {
    if (!form.razao_social || !form.cnpj || !form.email || !form.telefone_celular) {
      setError(t("editModal.errorRequiredFields"));
      return;
    }

    // Se o e-mail mudou, verifica se já pertence a outro cliente
    const emailAlterado = form.email.trim().toLowerCase() !== sol.email.trim().toLowerCase();
    if (emailAlterado) {
      try {
        const { data: clienteExistente } = await clientesApi.buscarPorEmail(form.email.trim());
        // Encontrou um cliente com esse e-mail — só é problema se for CNPJ diferente
        if (clienteExistente.cnpj !== form.cnpj) {
          setError(
            t("editModal.errorEmailInUse", { nome: clienteExistente.razao_social, cnpj: clienteExistente.cnpj })
          );
          return;
        }
      } catch {
        // 404 = e-mail livre, pode prosseguir
      }
    }

    setSaving(true);
    setError("");
    try {
      const { data: updated } = await solicitacoesApi.atualizar(sol.id, buildPayload());
      if (certFile) await solicitacoesApi.uploadCertificado(sol.id, certFile);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const EDIT_TABS = [
    { id: "empresa",       labelKey: "empresa"       },
    { id: "endereco",      labelKey: "endereco"      },
    { id: "contabilidade", labelKey: "contabilidade" },
    { id: "bancario",      labelKey: "bancario"      },
    { id: "regime",        labelKey: "regime"        },
    { id: "pagamentos",    labelKey: "pagamentos"    },
    { id: "fiscal",        labelKey: "fiscal"        },
  ];

  const isSimples = form.regime_tributario === "1" || form.crt === "1" || form.crt === "2";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">{t("editModal.title")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sol.razao_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* tabs */}
        <div className="border-b border-gray-100 shrink-0 overflow-x-auto">
          <div className="flex min-w-max px-6">
            {EDIT_TABS.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                  tab === tb.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {t(`editModal.tabs.${tb.labelKey}`)}
              </button>
            ))}
          </div>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {tab === "empresa" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.empresa.razaoSocial")}</label>
                <input value={form.razao_social} onChange={(ev) => set("razao_social", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.empresa.nomeFantasia")}</label>
                <input value={form.nome_fantasia} onChange={(ev) => set("nome_fantasia", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.empresa.cnpj")}</label>
                <input value={form.cnpj} onChange={(ev) => set("cnpj", ev.target.value)} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.empresa.ie")}</label>
                <input value={form.ie} onChange={(ev) => set("ie", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.empresa.email")}</label>
                <input type="email" value={form.email} onChange={(ev) => set("email", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.empresa.responsavel")}</label>
                <input value={form.responsavel} onChange={(ev) => set("responsavel", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.empresa.celular")}</label>
                <input value={form.telefone_celular} maxLength={15} onChange={(ev) => set("telefone_celular", maskPhone(ev.target.value))} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.empresa.telefoneFixo")}</label>
                <input value={form.telefone_fixo} maxLength={15} onChange={(ev) => set("telefone_fixo", maskPhone(ev.target.value))} className={inp} />
              </div>
            </div>
          )}

          {tab === "endereco" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.endereco.cep")}</label>
                <input value={form.cep} onChange={(ev) => set("cep", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.endereco.numero")}</label>
                <input value={form.numero} onChange={(ev) => set("numero", ev.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.endereco.endereco")}</label>
                <input value={form.endereco} onChange={(ev) => set("endereco", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.endereco.bairro")}</label>
                <input value={form.bairro} onChange={(ev) => set("bairro", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.endereco.cidade")}</label>
                <input value={form.cidade} onChange={(ev) => set("cidade", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.endereco.estado")}</label>
                <input value={form.estado} onChange={(ev) => set("estado", ev.target.value)} maxLength={2} className={inp} />
              </div>
            </div>
          )}

          {tab === "contabilidade" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.nomeContador")}</label>
                <input value={form.nome_contador} onChange={(ev) => set("nome_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.cpf")}</label>
                <input value={form.cpf_contador} maxLength={14} onChange={(ev) => set("cpf_contador", maskCpf(ev.target.value))} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.crc")}</label>
                <input value={form.crc} onChange={(ev) => set("crc", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.cnpjEscritorio")}</label>
                <input value={form.cnpj_contador} maxLength={18} onChange={(ev) => set("cnpj_contador", maskCnpj(ev.target.value))} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.email")}</label>
                <input type="email" value={form.email_contador} onChange={(ev) => set("email_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.telFixo")}</label>
                <input value={form.tel_fixo_contador} maxLength={15} onChange={(ev) => set("tel_fixo_contador", maskPhone(ev.target.value))} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.celular")}</label>
                <input value={form.tel_cel_contador} maxLength={15} onChange={(ev) => set("tel_cel_contador", maskPhone(ev.target.value))} className={inp} />
              </div>
              <div className="col-span-2 pt-2 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">{t("editModal.contabilidade.enderecoContadorTitle")}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.cep")}</label>
                <input value={form.cep_contador} onChange={(ev) => set("cep_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.numero")}</label>
                <input value={form.num_contador} onChange={(ev) => set("num_contador", ev.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.endereco")}</label>
                <input value={form.end_contador} onChange={(ev) => set("end_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.bairro")}</label>
                <input value={form.bairro_contador} onChange={(ev) => set("bairro_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.cidade")}</label>
                <input value={form.cidade_contador} onChange={(ev) => set("cidade_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.contabilidade.estado")}</label>
                <input value={form.estado_contador} onChange={(ev) => set("estado_contador", ev.target.value)} maxLength={2} className={inp} />
              </div>
            </div>
          )}

          {tab === "bancario" && (
            <div className="grid grid-cols-2 gap-3">
              <BankSelectorEdit form={form} set={set} inp={inp} />
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.bancario.tipoConta")}</label>
                <select value={form.tipo_conta} onChange={(ev) => set("tipo_conta", ev.target.value)} className={inp}>
                  <option value="">{t("editModal.bancario.selecione")}</option>
                  <option value="corrente">{t("editModal.bancario.contaCorrente")}</option>
                  <option value="poupanca">{t("editModal.bancario.contaPoupanca")}</option>
                  <option value="pagamento">{t("editModal.bancario.contaPagamento")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.bancario.agencia")}</label>
                <div className="flex items-center gap-1.5">
                  <input value={form.agencia} onChange={(ev) => set("agencia", ev.target.value)}
                    placeholder={t("editModal.bancario.agenciaPlaceholder")}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
                  <span className="text-gray-400 font-bold select-none">-</span>
                  <input value={form.dv_agencia} onChange={(ev) => set("dv_agencia", ev.target.value)}
                    placeholder={t("editModal.bancario.dvPlaceholder")}
                    className="w-14 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.bancario.conta")}</label>
                <div className="flex items-center gap-1.5">
                  <input value={form.conta} onChange={(ev) => set("conta", ev.target.value)}
                    placeholder={t("editModal.bancario.contaPlaceholder")}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
                  <span className="text-gray-400 font-bold select-none">-</span>
                  <input value={form.dv_conta} onChange={(ev) => set("dv_conta", ev.target.value)}
                    placeholder={t("editModal.bancario.dvPlaceholder")}
                    className="w-14 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
                </div>
              </div>
            </div>
          )}

          {tab === "regime" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.regime.crt")}</label>
                <select value={form.crt} onChange={(ev) => set("crt", ev.target.value)} className={inp}>
                  <option value="">{t("editModal.regime.selecione")}</option>
                  <option value="1">{t("editModal.regime.crt1")}</option>
                  <option value="2">{t("editModal.regime.crt2")}</option>
                  <option value="3">{t("editModal.regime.crt3")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.regime.regimeTributario")}</label>
                <select value={form.regime_tributario} onChange={(ev) => set("regime_tributario", ev.target.value)} className={inp}>
                  <option value="">{t("editModal.regime.selecione")}</option>
                  <option value="1">{t("editModal.regime.regime1")}</option>
                  <option value="2">{t("editModal.regime.regime2")}</option>
                  <option value="3">{t("editModal.regime.regime3")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.regime.condicaoSt")}</label>
                <select value={form.condicao_st} onChange={(ev) => set("condicao_st", ev.target.value)} className={inp}>
                  <option value="">{t("editModal.regime.selecione")}</option>
                  <option value="1">{t("editModal.regime.condicaoSt1")}</option>
                  <option value="2">{t("editModal.regime.condicaoSt2")}</option>
                </select>
              </div>
              {isSimples && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.regime.aliqSimples")}</label>
                    <input value={form.aliq_simples} onChange={(ev) => set("aliq_simples", ev.target.value)} placeholder={t("editModal.regime.aliqSimplesPlaceholder")} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.regime.receitaBruta")}</label>
                    <input value={form.receita_bruta} onChange={(ev) => set("receita_bruta", ev.target.value)} placeholder={t("editModal.regime.receitaBrutaPlaceholder")} className={inp} />
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "pagamentos" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                {t("editModal.pagamentos.sectionTitle")}
              </p>
              {[
                { key: "fp_dinheiro",        labelKey: "dinheiro" },
                { key: "fp_cheque",          labelKey: "cheque" },
                { key: "fp_cartao_pos",      labelKey: "cartaoPos" },
                { key: "fp_pagamento_prazo", labelKey: "prazo" },
                { key: "fp_pix",             labelKey: "pix" },
                { key: "fp_cartao_tef",      labelKey: "cartaoTef" },
              ].map(({ key, labelKey }) => (
                <label key={key}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:border-orange-200 hover:bg-orange-50/40 transition-all">
                  <input
                    type="checkbox"
                    checked={!!form[key]}
                    onChange={(ev) => set(key, ev.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500 cursor-pointer shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-700">{t(`editModal.pagamentos.${labelKey}`)}</span>
                </label>
              ))}
              {form.fp_cartao_tef && (
                <div className="pt-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.pagamentos.integradoraLabel")}</label>
                  <input
                    value={form.fp_integradora}
                    onChange={(ev) => set("fp_integradora", ev.target.value)}
                    placeholder={t("editModal.pagamentos.integradoraPlaceholder")}
                    className={inp}
                  />
                </div>
              )}
            </div>
          )}

          {tab === "fiscal" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.fiscal.csc")}</label>
                <input value={form.csc} onChange={(ev) => set("csc", ev.target.value)} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.fiscal.token")}</label>
                <input value={form.token} onChange={(ev) => set("token", ev.target.value)} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.fiscal.serieNfe")}</label>
                <input value={form.serie_nfe} onChange={(ev) => set("serie_nfe", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.fiscal.ultimaSerieNfce")}</label>
                <input value={form.ultima_serie_nfce} onChange={(ev) => set("ultima_serie_nfce", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.fiscal.ultimaNfeEmitida")}</label>
                <input value={form.ultima_nfe_emitida} onChange={(ev) => set("ultima_nfe_emitida", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editModal.fiscal.senhaCertificado")}</label>
                <input type="password" value={form.senha_certificado} onChange={(ev) => set("senha_certificado", ev.target.value)} className={inp} />
              </div>

              {/* ── Certificado Digital ── */}
              <div className="col-span-2 pt-3 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  {t("editModal.fiscal.certificadoTitle")}
                </p>

                {/* arquivo atual (sem novo selecionado) */}
                {currentCertName && !certFile && (
                  <div className="flex items-center gap-2.5 p-3 mb-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-mono text-gray-600 flex-1 truncate">{currentCertName}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{t("editModal.fiscal.arquivoAtual")}</span>
                  </div>
                )}

                {/* novo arquivo selecionado */}
                {certFile && (
                  <div className="flex items-center gap-2.5 p-3 mb-3 bg-green-50 border border-green-200 rounded-lg">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-mono text-green-700 flex-1 truncate">{certFile.name}</span>
                    <button type="button" onClick={() => setCertFile(null)}
                      className="text-[10px] text-red-500 hover:text-red-700 font-medium shrink-0 transition-colors">
                      {t("editModal.fiscal.remover")}
                    </button>
                  </div>
                )}

                {/* seletor */}
                <label className="flex items-center gap-3 p-3.5 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all group">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 group-hover:bg-orange-100 transition-colors">
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                      {certFile ? t("editModal.fiscal.trocarNovamente") : currentCertName ? t("editModal.fiscal.substituirCertificado") : t("editModal.fiscal.selecionarCertificado")}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{t("editModal.fiscal.formatoHint")}</p>
                  </div>
                  <input type="file" accept=".pfx,.p12,.cer,.crt" className="hidden"
                    onChange={(ev) => setCertFile(ev.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
          )}

        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              {t("editModal.cancel")}
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: "#F56316" }}>
              {saving ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("editModal.saving")}</>
              ) : t("editModal.saveButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export function RespPicker({ usuarios, selectedId, onSelect }) {
  const { t } = useTranslation("triagem");
  const [busca, setBusca] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtrados = busca.trim()
    ? usuarios.filter(u => u.nome.toLowerCase().includes(busca.toLowerCase()))
    : usuarios;

  return (
    <div className="absolute left-0 top-7 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 min-w-[240px] max-h-72 flex flex-col overflow-hidden">
      {/* campo de busca */}
      <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            ref={inputRef}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder={t("respPicker.searchPlaceholder")}
            className="bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none w-full"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-gray-400 hover:text-gray-600">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* lista */}
      <div className="overflow-y-auto py-1">
        {!busca && (
          <>
            <button
              onClick={() => onSelect(null)}
              className="w-full text-left px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-2 transition-colors">
              <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </span>
              {t("respPicker.noResponsible")}
            </button>
            <div className="border-t border-gray-50 mx-3 mb-0.5" />
          </>
        )}
        {filtrados.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">{t("respPicker.noUserFound")}</p>
        )}
        {filtrados.map(u => (
          <button key={u.id}
            onClick={() => onSelect(u.id)}
            className={`w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 flex items-center gap-2 transition-colors ${selectedId === u.id ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-700"}`}>
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold shrink-0">
              {u.nome.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase()}
            </span>
            <span className="flex-1 truncate">{u.nome}</span>
            {selectedId === u.id && <span className="text-indigo-500 shrink-0">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KPI_ICONS = {
  total:      "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  pending:    "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  triagem:    "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  urgent:     "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  correction: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
};
const KPI_THEME = {
  gray:   { wrap: "border-gray-100",   ico: "bg-gray-50   text-gray-400"   },
  orange: { wrap: "border-orange-100", ico: "bg-orange-50 text-orange-500" },
  blue:   { wrap: "border-blue-100",   ico: "bg-blue-50   text-blue-500"   },
  red:    { wrap: "border-red-100",    ico: "bg-red-50    text-red-500"    },
  yellow: { wrap: "border-yellow-100", ico: "bg-yellow-50 text-yellow-600" },
};

function KpiCard({ label, value, icon, accent = "gray", sub = null }) {
  const th = KPI_THEME[accent] || KPI_THEME.gray;
  return (
    <div className={`bg-white rounded-2xl border ${th.wrap} shadow-sm p-5`}>
      <div className={`w-9 h-9 rounded-xl ${th.ico} flex items-center justify-center mb-3`}>
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={KPI_ICONS[icon]} />
        </svg>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1.5 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ATIVAS_STATUSES   = ["nova", "em_triagem", "aguardando_correcao"];
const HISTORICO_STATUSES = ["aprovada", "recusada", "cancelada"];

const STATUS_TABS = [
  { key: "ativas",    labelKey: "active"  },
  { key: "historico", labelKey: "history" },
  { key: "",          labelKey: "all"     },
];

export default function Triagem() {
  const { t } = useTranslation("triagem");
  const navigate = useNavigate();
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState("ativas");
  const [search, setSearch]             = useState("");
  const [focusedIdx, setFocusedIdx]     = useState(-1);
  const searchRef = useRef(null);

  // Carrega tudo — filtragem client-side permite KPIs sempre corretos
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await solicitacoesApi.listar({});
      setItems(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFocusedIdx(-1); }, [filterStatus, search]);

  // ── Derivados ──────────────────────────────────────────────────────────────
  // "Pendentes" = apenas novas que ainda não tiveram triagem iniciada
  const pendentes           = items.filter((s) => s.status === "nova").length;
  const emTriagem           = items.filter((s) => s.status === "em_triagem").length;
  const aguardandoCorrecao  = items.filter((s) => s.status === "aguardando_correcao").length;
  const canceladas          = items.filter((s) => s.status === "cancelada").length;
  const urgentes  = items.filter((s) => {
    if (s.status === "aguardando_correcao") return false; // prazo do cliente, não da equipe
    const r = slaRelativo(s);
    return r && (r.level === "urgent" || r.level === "expired");
  }).length;

  const countTab = (key) => {
    if (!key) return items.length;
    if (key === "ativas")    return items.filter((s) => ATIVAS_STATUSES.includes(s.status)).length;
    if (key === "historico") return items.filter((s) => HISTORICO_STATUSES.includes(s.status)).length;
    return items.filter((s) => s.status === key).length;
  };

  const filtered = items
    .filter((s) => {
      if (!filterStatus) return true;
      if (filterStatus === "ativas")    return ATIVAS_STATUSES.includes(s.status);
      if (filterStatus === "historico") return HISTORICO_STATUSES.includes(s.status);
      return s.status === filterStatus;
    })
    .filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.razao_social.toLowerCase().includes(q) ||
        s.cnpj.includes(q) ||
        (s.email || "").toLowerCase().includes(q)
      );
    });

  function openRow(s) {
    navigate(`/admin/triagem/${s.id}`, { state: { ids: filtered.map((x) => x.id) } });
  }

  // ── Navegação por teclado: ↑/↓ percorre a lista, Enter abre a linha focada ──
  useEffect(() => {
    function onKey(e) {
      if (document.activeElement === searchRef.current) return;
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && focusedIdx >= 0) {
        openRow(filtered[focusedIdx]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout>
      {/* ── Cabeçalho + busca ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("page.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("page.subtitle")}</p>
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder={t("page.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 bg-white"
          />
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label={t("page.kpi.total")}               value={items.length}       icon="total"      accent="gray"   sub={canceladas > 0 ? t("page.kpi.cancelledSub", { count: canceladas }) : null} />
        <KpiCard label={t("page.kpi.pending")}           value={pendentes}          icon="pending"    accent="orange" />
        <KpiCard label={t("page.kpi.inTriage")}          value={emTriagem}          icon="triagem"    accent="blue"   />
        <KpiCard label={t("page.kpi.awaitingCorrection")}  value={aguardandoCorrecao} icon="correction" accent={aguardandoCorrecao > 0 ? "yellow" : "gray"} />
        <KpiCard label={t("page.kpi.dueIn24h")}        value={urgentes}           icon="urgent"     accent={urgentes > 0 ? "red" : "gray"} />
      </div>

      {/* ── Abas de status ────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map((tb) => {
          const cnt = countTab(tb.key);
          return (
            <button
              key={tb.key}
              onClick={() => setFilterStatus(tb.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                filterStatus === tb.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t(`page.tabs.${tb.labelKey}`)}
              {cnt > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  filterStatus === tb.key
                    ? "bg-orange-100 text-orange-600"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">{t("page.table.emptyTitle")}</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? t("page.table.emptySearchHint") : t("page.table.emptyFilterHint")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-100 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  <th className="p-0 w-1" />
                  <th className="px-5 py-3">{t("page.table.headers.company")}</th>
                  <th className="px-4 py-3">{t("page.table.headers.cnpj")}</th>
                  <th className="px-4 py-3">{t("page.table.headers.status")}</th>
                  <th className="px-4 py-3">{t("page.table.headers.responsible")}</th>
                  <th className="px-4 py-3">{t("page.table.headers.sla")}</th>
                  <th className="px-4 py-3">{t("page.table.headers.received")}</th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s, i) => {
                  const sla = slaRelativo(s);
                  const isAlta = s.prioridade && s.prioridade !== "normal";
                  const isTerminal = TERMINAL_STATUSES.includes(s.status);
                  // P2: uma única dimensão de cor por linha — o status já vem do Badge;
                  // o único acento de cor extra é reservado para o sinal mais urgente (SLA vencido).
                  const isExpired = !isTerminal && sla?.level === "expired";
                  const rowBg = i === focusedIdx
                    ? "bg-orange-50 ring-1 ring-inset ring-orange-300"
                    : isTerminal
                    ? "bg-gray-50/60 hover:bg-gray-100/60"
                    : "hover:bg-orange-50/40";

                  return (
                    <tr
                      key={s.id}
                      onClick={() => openRow(s)}
                      onMouseEnter={() => setFocusedIdx(i)}
                      className={`transition-colors cursor-pointer group ${rowBg}`}
                    >
                      {/* Acento lateral — só para SLA vencido, o sinal mais urgente da tela */}
                      <td className={`p-0 ${isExpired ? "bg-red-500" : "bg-transparent"}`} style={{ width: "4px", minWidth: "4px" }} />

                      {/* Empresa */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold transition-colors ${isTerminal ? "text-gray-500" : "text-gray-900 group-hover:text-orange-600"}`}>
                            {s.razao_social}
                          </p>
                          {isAlta && !isTerminal && <PrioridadeBadge prioridade={s.prioridade} />}
                          {s.status === "em_triagem" && s.motivo_recusa && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {t("page.table.correctionReceived")}
                            </span>
                          )}
                        </div>
                        {s.nome_fantasia && (
                          <p className="text-xs text-gray-400 mt-0.5">{s.nome_fantasia}</p>
                        )}
                      </td>

                      {/* CNPJ */}
                      <td className={`px-4 py-4 font-mono text-xs ${isTerminal ? "text-gray-300" : "text-gray-400"}`}>
                        {s.cnpj}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <Badge status={s.status} />
                      </td>

                      {/* Responsável */}
                      <td className="px-4 py-4">
                        {s.responsavel_triagem_nome ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                              {s.responsavel_triagem_nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                            </div>
                            <span className="text-xs text-gray-600 truncate max-w-[100px]">{s.responsavel_triagem_nome}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* SLA — oculto para terminais */}
                      <td className="px-4 py-4">
                        {sla ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            sla.isCliente
                              ? sla.level === "expired"
                                ? "text-gray-500 bg-gray-100 border-gray-200"
                                : "text-orange-600 bg-orange-50 border-orange-200"
                              : SLA_PILL[sla.level]
                          }`}>
                            {sla.level === "expired" && !sla.isCliente && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                            )}
                            {sla.isCliente && (
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            )}
                            {sla.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">
                            {isTerminal ? t("page.table.slaClosed") : "—"}
                          </span>
                        )}
                      </td>

                      {/* Recebida */}
                      <td className={`px-4 py-4 text-xs ${isTerminal ? "text-gray-300" : "text-gray-400"}`}>
                        {fmtDate(s.created_at)}
                      </td>

                      {/* Chevron */}
                      <td className="px-4 py-4">
                        <svg className={`w-4 h-4 transition-colors ${isTerminal ? "text-gray-200" : "text-gray-200 group-hover:text-orange-400"}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
