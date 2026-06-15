import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { Badge, PrioridadeBadge } from "../components/ui/Badge";
import { solicitacoesApi, templatesApi, clientesApi, usuariosApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { BANCOS_BR } from "../data/bancos";
import { fmtDate, fmtDateTime, parseUTC } from "../utils/dateUtils";
import { maskPhone, maskCnpj, maskCpf } from "../hooks/useCnpj";

const TERMINAL_STATUSES = ["aprovada", "recusada", "cancelada"];

function slaRelativo(sol) {
  if (TERMINAL_STATUSES.includes(sol.status)) return null;
  if (!sol.sla_limite) return null;

  const isCliente = sol.status === "aguardando_correcao";
  const diff = parseUTC(sol.sla_limite) - Date.now();

  if (diff < 0) {
    if (isCliente) return { label: "Link expirado", level: "expired", isCliente: true };
    const h = Math.ceil(Math.abs(diff) / 3600000);
    const d = Math.floor(h / 24);
    return { label: d >= 1 ? `Vencido ${d}d` : `Vencido ${h}h`, level: "expired" };
  }

  const totalH = Math.floor(diff / 3600000);
  const d = Math.ceil(totalH / 24); // ceil: 6d23h ainda conta como 7 dias restantes

  if (isCliente) {
    if (totalH < 24) return { label: "Cliente: hoje",   level: "urgent",  isCliente: true };
    if (d === 1)     return { label: "Cliente: amanhã", level: "warning", isCliente: true };
    return           { label: `Cliente: ${d}d`,          level: "ok",      isCliente: true };
  }

  if (totalH < 24) return { label: "Vence hoje", level: "urgent" };
  if (d === 1)     return { label: "Amanhã",     level: "warning" };
  return           { label: `${d} dias`,          level: "ok" };
}

const SLA_PILL = {
  expired: "text-red-600   bg-red-50   border-red-200",
  urgent:  "text-amber-700 bg-amber-50 border-amber-200",
  warning: "text-yellow-700 bg-yellow-50 border-yellow-200",
  ok:      "text-green-700 bg-green-50 border-green-100",
};

const STATUS_ACCENT = {
  nova:                "bg-blue-400",
  em_triagem:          "bg-amber-400",
  aguardando_correcao: "bg-orange-400",
  aprovada:            "bg-green-500",
  recusada:            "bg-red-400",
  cancelada:           "bg-gray-300",
};

// ── Primitives ────────────────────────────────────────────────────────────────

function Field({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 break-words ${mono ? "font-mono text-xs" : ""}`}>
        {value || <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

function Section({ title, children }) {
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

function AprovarModal({ sol, onClose, onApproved }) {
  const [templates, setTemplates]               = useState([]);
  const [templateDetails, setTemplateDetails]   = useState({}); // id → full template with etapas
  const [form, setForm]                         = useState({
    template_ids: [], consultor: "", prioridade: "normal", sla_dias: 30, observacoes: "", conversao_dados: false,
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
      const implantacaoTemplates = data.filter((t) => !t.tipo?.startsWith("instalacao_"));
      setTemplates(implantacaoTemplates);
      // Pre-fetch full details for stage preview
      const details = await Promise.all(
        implantacaoTemplates.map((t) => templatesApi.obter(t.id).then((r) => r.data).catch(() => t))
      );
      const map = {};
      details.forEach((t) => { map[t.id] = t; });
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
    if (form.template_ids.length === 0) { setError("Selecione ao menos um módulo."); return; }

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
            <h3 className="font-semibold text-gray-900">Aprovar Solicitação</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sol.razao_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg">
            ✕
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
                    Módulos de Implantação
                    <span className="ml-1.5 font-normal text-gray-400">
                      ({form.template_ids.length} selecionado{form.template_ids.length !== 1 ? "s" : ""})
                    </span>
                  </p>
                </div>

                {/* Lista de módulos com scroll */}
                <div className="overflow-y-auto flex-1 px-5 pb-3 space-y-1.5">
                  {templates.length === 0 && (
                    <p className="text-xs text-gray-400 py-4 text-center">Carregando módulos...</p>
                  )}
                  {templates.map((t) => {
                    const checked = form.template_ids.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTemplate(t.id)}
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
                          {t.nome}
                        </span>
                        {t.sla_total_dias > 0 && (
                          <span className="text-[10px] text-gray-400 shrink-0">{t.sla_total_dias}d</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Preview das colunas do Kanban */}
                <div className="px-5 pb-4 shrink-0">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                      Colunas do Kanban
                    </p>
                    {mergedStages.length === 0 ? (
                      <p className="text-[11px] text-gray-400">Nenhum módulo selecionado</p>
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
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Consultor</label>
                    <input type="text" value={form.consultor} onChange={(e) => setForm((f) => ({ ...f, consultor: e.target.value }))} placeholder="Nome do consultor" className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">SLA (dias)</label>
                    <input type="number" min={1} max={365} value={form.sla_dias} onChange={(e) => setForm((f) => ({ ...f, sla_dias: e.target.value }))} className={inp} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Prioridade</label>
                  <div className="flex gap-2">
                    {["baixa", "normal", "alta", "critica"].map((p) => (
                      <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, prioridade: p }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.prioridade === p ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        {p === "critica" ? "Crítica" : p.charAt(0).toUpperCase() + p.slice(1)}
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
                      Conversão de dados
                    </p>
                    <p className="text-xs text-gray-400">Migração de dados do sistema anterior</p>
                  </div>
                </button>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Observações internas</label>
                  <textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder="Opcional..." className={`${inp} resize-none`} />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            </div>

            {/* Rodapé fixo */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={checking || saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {checking ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Verificando...</>
                ) : saving ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Aprovando...</>
                ) : "Confirmar Aprovação"}
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
                <p className="text-sm font-semibold text-amber-800">CNPJ já cadastrado</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  O CNPJ desta solicitação já pertence a um cliente na base. Deseja atrelar a nova implantação a esse cliente existente?
                </p>
              </div>
            </div>

            {/* Card do cliente existente */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Cliente cadastrado</p>
                <p className="text-sm font-semibold text-gray-900">{clienteExistente.razao_social}</p>
                {clienteExistente.nome_fantasia && (
                  <p className="text-xs text-gray-500">{clienteExistente.nome_fantasia}</p>
                )}
              </div>
              <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">CNPJ</p>
                  <p className="text-xs font-mono text-gray-700">{clienteExistente.cnpj}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">E-mail</p>
                  <p className="text-xs text-gray-700 truncate">{clienteExistente.email}</p>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setStep("form"); setError(""); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Voltar
              </button>
              <button type="button" onClick={submeterAprovacao} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Aprovando...</>
                ) : "Usar cliente existente"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Refusal Modal ─────────────────────────────────────────────────────────────

const SECOES_CORRECAO = [
  { key: "empresa",       label: "Dados da Empresa"       },
  { key: "contato",       label: "Contato"                },
  { key: "endereco",      label: "Endereço"               },
  { key: "contabilidade", label: "Contabilidade"          },
  { key: "banco",         label: "Dados Bancários"        },
  { key: "regime",        label: "Regime Tributário"      },
  { key: "pagamento",     label: "Formas de Pagamento"    },
  { key: "fiscal",        label: "Dados NF-e / NFC-e"     },
  { key: "certificado",   label: "Certificado Digital"    },
  { key: "adquirentes",   label: "Adquirentes"            },
];

function RecusarModal({ sol, onClose, onRefused }) {
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
    if (!motivo.trim()) { setError("Informe o motivo da recusa."); return; }
    if (camposSelecionados.length === 0) { setError("Selecione ao menos uma seção para correção."); return; }
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
            <h3 className="font-semibold text-gray-900">Recusar Solicitação</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sol.razao_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Motivo da recusa *</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Descreva o que precisa ser corrigido..."
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Seções que o cliente deve corrigir *
              <span className="text-gray-400 font-normal ml-1">(apenas estas ficarão editáveis)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SECOES_CORRECAO.map((s) => {
                const checked = camposSelecionados.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSecao(s.key)}
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
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Voltar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
              {saving ? "Enviando..." : "Recusar e Notificar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelarModal({ sol, onClose, onCancelled }) {
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
            <h3 className="font-semibold text-gray-900">Cancelar Solicitação</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sol.razao_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              Cancelar é uma ação <strong>definitiva</strong>. A solicitação não poderá ser retomada. Use apenas quando o cliente desistiu ou a solicitação é inválida.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex: Cliente desistiu, duplicidade..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Voltar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {saving ? "Cancelando..." : "Confirmar Cancelamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Bank Selector (plain-state variant for EditModal) ─────────────────────────

function BankSelectorEdit({ form, set, inp }) {
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
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-2 relative" ref={ref}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Banco</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por nome ou código — ex: Bradesco ou 237"
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
              Nenhum banco encontrado para "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ sol, onClose, onSaved }) {
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
      setError("Razão social, CNPJ, e-mail e celular são obrigatórios.");
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
            `Este e-mail já está cadastrado para o cliente "${clienteExistente.razao_social}" (CNPJ ${clienteExistente.cnpj}). Use um e-mail diferente.`
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
    { id: "empresa",       label: "Empresa"       },
    { id: "endereco",      label: "Endereço"      },
    { id: "contabilidade", label: "Contabilidade" },
    { id: "bancario",      label: "Bancário"      },
    { id: "regime",        label: "Regime"        },
    { id: "pagamentos",    label: "Pagamentos"    },
    { id: "fiscal",        label: "Fiscal"        },
  ];

  const isSimples = form.regime_tributario === "1" || form.crt === "1" || form.crt === "2";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Editar Solicitação</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sol.razao_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg">✕</button>
        </div>

        {/* tabs */}
        <div className="border-b border-gray-100 shrink-0 overflow-x-auto">
          <div className="flex min-w-max px-6">
            {EDIT_TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                  tab === t.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {tab === "empresa" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Razão Social *</label>
                <input value={form.razao_social} onChange={(ev) => set("razao_social", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nome Fantasia</label>
                <input value={form.nome_fantasia} onChange={(ev) => set("nome_fantasia", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CNPJ *</label>
                <input value={form.cnpj} onChange={(ev) => set("cnpj", ev.target.value)} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Inscrição Estadual</label>
                <input value={form.ie} onChange={(ev) => set("ie", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">E-mail *</label>
                <input type="email" value={form.email} onChange={(ev) => set("email", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Responsável</label>
                <input value={form.responsavel} onChange={(ev) => set("responsavel", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Celular *</label>
                <input value={form.telefone_celular} maxLength={15} onChange={(ev) => set("telefone_celular", maskPhone(ev.target.value))} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Telefone Fixo</label>
                <input value={form.telefone_fixo} maxLength={15} onChange={(ev) => set("telefone_fixo", maskPhone(ev.target.value))} className={inp} />
              </div>
            </div>
          )}

          {tab === "endereco" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CEP</label>
                <input value={form.cep} onChange={(ev) => set("cep", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Número</label>
                <input value={form.numero} onChange={(ev) => set("numero", ev.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Endereço</label>
                <input value={form.endereco} onChange={(ev) => set("endereco", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Bairro</label>
                <input value={form.bairro} onChange={(ev) => set("bairro", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Cidade</label>
                <input value={form.cidade} onChange={(ev) => set("cidade", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Estado (UF)</label>
                <input value={form.estado} onChange={(ev) => set("estado", ev.target.value)} maxLength={2} className={inp} />
              </div>
            </div>
          )}

          {tab === "contabilidade" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nome do Contador</label>
                <input value={form.nome_contador} onChange={(ev) => set("nome_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CPF</label>
                <input value={form.cpf_contador} maxLength={14} onChange={(ev) => set("cpf_contador", maskCpf(ev.target.value))} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CRC</label>
                <input value={form.crc} onChange={(ev) => set("crc", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CNPJ do Escritório</label>
                <input value={form.cnpj_contador} maxLength={18} onChange={(ev) => set("cnpj_contador", maskCnpj(ev.target.value))} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">E-mail</label>
                <input type="email" value={form.email_contador} onChange={(ev) => set("email_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tel. Fixo</label>
                <input value={form.tel_fixo_contador} maxLength={15} onChange={(ev) => set("tel_fixo_contador", maskPhone(ev.target.value))} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Celular</label>
                <input value={form.tel_cel_contador} maxLength={15} onChange={(ev) => set("tel_cel_contador", maskPhone(ev.target.value))} className={inp} />
              </div>
              <div className="col-span-2 pt-2 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Endereço do Contador</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CEP</label>
                <input value={form.cep_contador} onChange={(ev) => set("cep_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Número</label>
                <input value={form.num_contador} onChange={(ev) => set("num_contador", ev.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Endereço</label>
                <input value={form.end_contador} onChange={(ev) => set("end_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Bairro</label>
                <input value={form.bairro_contador} onChange={(ev) => set("bairro_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Cidade</label>
                <input value={form.cidade_contador} onChange={(ev) => set("cidade_contador", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Estado (UF)</label>
                <input value={form.estado_contador} onChange={(ev) => set("estado_contador", ev.target.value)} maxLength={2} className={inp} />
              </div>
            </div>
          )}

          {tab === "bancario" && (
            <div className="grid grid-cols-2 gap-3">
              <BankSelectorEdit form={form} set={set} inp={inp} />
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tipo de Conta</label>
                <select value={form.tipo_conta} onChange={(ev) => set("tipo_conta", ev.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Conta Poupança</option>
                  <option value="pagamento">Conta Pagamento</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Agência</label>
                <div className="flex items-center gap-1.5">
                  <input value={form.agencia} onChange={(ev) => set("agencia", ev.target.value)}
                    placeholder="1234"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
                  <span className="text-gray-400 font-bold select-none">-</span>
                  <input value={form.dv_agencia} onChange={(ev) => set("dv_agencia", ev.target.value)}
                    placeholder="DV"
                    className="w-14 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Conta</label>
                <div className="flex items-center gap-1.5">
                  <input value={form.conta} onChange={(ev) => set("conta", ev.target.value)}
                    placeholder="12345"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
                  <span className="text-gray-400 font-bold select-none">-</span>
                  <input value={form.dv_conta} onChange={(ev) => set("dv_conta", ev.target.value)}
                    placeholder="DV"
                    className="w-14 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
                </div>
              </div>
            </div>
          )}

          {tab === "regime" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CRT</label>
                <select value={form.crt} onChange={(ev) => set("crt", ev.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  <option value="1">1 — Simples Nacional</option>
                  <option value="2">2 — Simples Nacional - Excesso sublimite</option>
                  <option value="3">3 — Regime Normal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Regime Tributário</label>
                <select value={form.regime_tributario} onChange={(ev) => set("regime_tributario", ev.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  <option value="1">Simples Nacional</option>
                  <option value="2">Lucro Presumido</option>
                  <option value="3">Lucro Real</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Condição ST</label>
                <select value={form.condicao_st} onChange={(ev) => set("condicao_st", ev.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  <option value="1">Informante Substituto</option>
                  <option value="2">Informante Substituído</option>
                </select>
              </div>
              {isSimples && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Alíq. Simples Nacional (%)</label>
                    <input value={form.aliq_simples} onChange={(ev) => set("aliq_simples", ev.target.value)} placeholder="Ex: 4,00" className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Receita Bruta (R$)</label>
                    <input value={form.receita_bruta} onChange={(ev) => set("receita_bruta", ev.target.value)} placeholder="Ex: 360000,00" className={inp} />
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "pagamentos" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Formas de pagamento aceitas
              </p>
              {[
                { key: "fp_dinheiro",        label: "Dinheiro" },
                { key: "fp_cheque",          label: "Cheque" },
                { key: "fp_cartao_pos",      label: "Cartão-POS (crédito e débito)" },
                { key: "fp_pagamento_prazo", label: "Prazo" },
                { key: "fp_pix",             label: "PIX" },
                { key: "fp_cartao_tef",      label: "Cartão-TEF (crédito e débito)" },
              ].map(({ key, label }) => (
                <label key={key}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:border-orange-200 hover:bg-orange-50/40 transition-all">
                  <input
                    type="checkbox"
                    checked={!!form[key]}
                    onChange={(ev) => set(key, ev.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500 cursor-pointer shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
              {form.fp_cartao_tef && (
                <div className="pt-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Integradora TEF</label>
                  <input
                    value={form.fp_integradora}
                    onChange={(ev) => set("fp_integradora", ev.target.value)}
                    placeholder="Ex: Sitef, Tef Dedicado, PayGo..."
                    className={inp}
                  />
                </div>
              )}
            </div>
          )}

          {tab === "fiscal" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CSC</label>
                <input value={form.csc} onChange={(ev) => set("csc", ev.target.value)} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Token NFCe</label>
                <input value={form.token} onChange={(ev) => set("token", ev.target.value)} className={`${inp} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Série NF-e</label>
                <input value={form.serie_nfe} onChange={(ev) => set("serie_nfe", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Última Série NFCe</label>
                <input value={form.ultima_serie_nfce} onChange={(ev) => set("ultima_serie_nfce", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Última NF-e Emitida</label>
                <input value={form.ultima_nfe_emitida} onChange={(ev) => set("ultima_nfe_emitida", ev.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Senha do Certificado</label>
                <input type="password" value={form.senha_certificado} onChange={(ev) => set("senha_certificado", ev.target.value)} className={inp} />
              </div>

              {/* ── Certificado Digital ── */}
              <div className="col-span-2 pt-3 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Certificado Digital A1
                </p>

                {/* arquivo atual (sem novo selecionado) */}
                {currentCertName && !certFile && (
                  <div className="flex items-center gap-2.5 p-3 mb-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-mono text-gray-600 flex-1 truncate">{currentCertName}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">Arquivo atual</span>
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
                      Remover
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
                      {certFile ? "Trocar novamente" : currentCertName ? "Substituir certificado" : "Selecionar certificado A1"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">.pfx ou .p12</p>
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
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: "#F56316" }}>
              {saving ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Salvando...</>
              ) : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

const CRT_LABEL = {
  "1": "1 — Simples Nacional",
  "2": "2 — Simples Nacional - Excesso de sublimite de receita bruta",
  "3": "3 — Regime Normal",
};
const REGIME_LABEL = {
  "1": "Simples Nacional", "2": "Lucro Presumido", "3": "Lucro Real",
  "simples_nacional": "Simples Nacional", "lucro_presumido": "Lucro Presumido", "lucro_real": "Lucro Real",
};

function RespPicker({ usuarios, selectedId, onSelect }) {
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
            placeholder="Buscar usuário…"
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
              Sem responsável
            </button>
            <div className="border-t border-gray-50 mx-3 mb-0.5" />
          </>
        )}
        {filtrados.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Nenhum usuário encontrado</p>
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

function Drawer({ sol: solProp, onClose, onTriar, onApproved, onRefused, onEdited }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sol, setSol]             = useState(solProp);
  const [modal, setModal]         = useState(null); // "aprovar" | "recusar" | "cancelar" | "editar"
  const [triando, setTriando]     = useState(false);
  const [tab, setTab]             = useState("dados");
  const [showPass, setShowPass]   = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenvioMsg, setReenvioMsg] = useState(null); // { ok: bool, text: str }
  const [usuarios, setUsuarios]   = useState([]);
  const [showRespPicker, setShowRespPicker] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);

  useEffect(() => { setSol(solProp); }, [solProp]);

  useEffect(() => {
    usuariosApi.listar().then(r => setUsuarios(r.data.filter(u => u.ativo !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showRespPicker) return;
    const handler = (e) => {
      if (!e.target.closest("[data-resp-picker]")) setShowRespPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showRespPicker]);

  async function handleAtribuir(responsavel_id) {
    setAtribuindo(true);
    setShowRespPicker(false);
    try {
      const { data } = await solicitacoesApi.atribuirResponsavel(sol.id, responsavel_id);
      setSol(data);
    } catch {}
    finally { setAtribuindo(false); }
  }

  const canEdit = user?.grupo_nome?.toLowerCase().includes("administra");

  async function handleTriar() {
    setTriando(true);
    try {
      await onTriar(sol.id);
    } finally {
      setTriando(false);
    }
  }

  async function handleReenviarEmail() {
    setReenviando(true);
    setReenvioMsg(null);
    try {
      await solicitacoesApi.reenviarEmail(sol.id);
      setReenvioMsg({ ok: true, text: "Email reenviado com sucesso. Prazo renovado por 7 dias." });
    } catch (err) {
      setReenvioMsg({ ok: false, text: err.message || "Falha ao reenviar. Tente novamente." });
    } finally {
      setReenviando(false);
    }
  }

  const canTriar = sol.status === "nova";
  const canAprovarRecusar = ["nova", "em_triagem", "aguardando_correcao"].includes(sol.status);
  const canCancelar = !["aprovada", "cancelada"].includes(sol.status);
  const isTerminal = sol.status === "aprovada" || sol.status === "cancelada";

  const certFile = sol.certificado_path
    ? sol.certificado_path.replace(/\\/g, "/").split("/").pop()
    : null;

  const e = sol.endereco || {};
  const ct = sol.contabilidade || {};
  const b = sol.dados_bancarios || {};
  const r = sol.dados_contabeis || {};
  const p = sol.formas_pagamento || {};
  const f = sol.dados_fiscais || {};
  const TABS = [
    { id: "dados", label: "Dados" },
    { id: "endereco", label: "Endereço" },
    { id: "contabilidade", label: "Contabilidade" },
    { id: "bancario", label: "Bancário" },
    { id: "regime", label: "Regime" },
    { id: "fiscal", label: "Fiscal" },
  ];

  // Initials avatar
  const initials = sol.razao_social.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const sla = slaRelativo(sol);
  const hasHistory = (sol.historico_recusas?.length > 0 || sol.motivo_recusa) && sol.status !== "cancelada";
  const [historyOpen, setHistoryOpen] = useState(false);

  const AVATAR_BG = {
    nova: "bg-blue-500", em_triagem: "bg-amber-500", aguardando_correcao: "bg-orange-500",
    aprovada: "bg-green-500", recusada: "bg-red-500", cancelada: "bg-gray-400",
  };

  return (
    <>
      {/* overlay */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col">

        {/* ── Hero header ── */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg ${AVATAR_BG[sol.status] || "bg-slate-600"}`}>
                {initials || "?"}
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-bold text-base leading-snug">{sol.razao_social}</h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-slate-400 text-[11px] font-mono">{sol.cnpj}</span>
                  <span className="text-slate-600 text-[11px]">·</span>
                  <span className="text-slate-400 text-[11px]">Recebida {fmtDateTime(sol.created_at)}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors shrink-0 text-lg">
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge status={sol.status} />
            <PrioridadeBadge prioridade={sol.prioridade} />
            {sla && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${SLA_PILL[sla.level]}`}>
                {sla.label}
              </span>
            )}
          </div>

          {/* ── Responsável da triagem ── */}
          {!isTerminal && (
            <div className="relative mt-3" data-resp-picker>
              <button
                onClick={() => setShowRespPicker(v => !v)}
                disabled={atribuindo}
                className="flex items-center gap-2 text-[11px] text-slate-300 hover:text-white transition-colors disabled:opacity-50">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${sol.responsavel_triagem_id ? "bg-indigo-500 text-white" : "bg-slate-600 text-slate-300"}`}>
                  {sol.responsavel_triagem_nome
                    ? sol.responsavel_triagem_nome.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase()
                    : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  }
                </div>
                <span>{atribuindo ? "Salvando…" : (sol.responsavel_triagem_nome ? `Responsável: ${sol.responsavel_triagem_nome}` : "Atribuir responsável")}</span>
                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>

              {showRespPicker && (
                <RespPicker
                  usuarios={usuarios}
                  selectedId={sol.responsavel_triagem_id}
                  onSelect={handleAtribuir}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Barra de ações ── */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 shrink-0 bg-gray-50/80">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            {canTriar && (
              <button onClick={handleTriar} disabled={triando}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
                {triando ? "Iniciando..." : "Iniciar Triagem"}
              </button>
            )}
            {canAprovarRecusar && (
              <>
                <button onClick={() => setModal("aprovar")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Aprovar
                </button>
                <button onClick={() => setModal("recusar")}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors">
                  Recusar
                </button>
              </>
            )}
            {canCancelar && (
              <button onClick={() => setModal("cancelar")}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            )}
          </div>
          {canEdit && sol.status !== "aprovada" && (
            <button onClick={() => setModal("editar")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar
            </button>
          )}
        </div>

        {/* ── Banners de status ── */}
        {sol.status === "aprovada" && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-100 bg-green-50 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-green-800">Solicitação aprovada</p>
              <p className="text-[11px] text-green-600">A implantação foi criada automaticamente.</p>
            </div>
            <button onClick={() => navigate("/admin/implantacoes")}
              className="text-[11px] font-semibold text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
              Ver Implantações →
            </button>
          </div>
        )}

        {sol.status === "aguardando_correcao" && (
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">Email de correção enviado</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Aguardando o cliente corrigir e reenviar os dados.</p>
                {reenvioMsg && (
                  <p className={`text-[11px] mt-1.5 font-medium ${reenvioMsg.ok ? "text-green-700" : "text-red-600"}`}>
                    {reenvioMsg.text}
                  </p>
                )}
              </div>
              <button onClick={handleReenviarEmail} disabled={reenviando}
                className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50">
                {reenviando
                  ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                }
                {reenviando ? "Enviando…" : "Reenviar"}
              </button>
            </div>
          </div>
        )}

        {sol.status === "cancelada" && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-100 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-gray-600">Solicitação cancelada.</p>
          </div>
        )}

        {/* ── Histórico de recusas (timeline) ── */}
        {hasHistory && (
          <div className="border-b border-gray-100 shrink-0">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-full flex items-center gap-2.5 px-5 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700 flex-1 text-left">Histórico de Recusas</span>
              {sol.historico_recusas?.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                  {sol.historico_recusas.length}
                </span>
              )}
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${historyOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {historyOpen && (
              <div className="px-5 pb-4 max-h-56 overflow-y-auto">
                {sol.historico_recusas?.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-red-100" />
                    {[...sol.historico_recusas].reverse().map((entry, idx) => {
                      const num = sol.historico_recusas.length - idx;
                      const secaoLabels = (entry.campos || []).map(
                        (k) => SECOES_CORRECAO.find((s) => s.key === k)?.label || k
                      );
                      return (
                        <div key={idx} className="relative flex gap-3 pb-3 last:pb-0">
                          <div className="w-7 h-7 rounded-full bg-red-100 border-2 border-white flex items-center justify-center shrink-0 text-[10px] font-bold text-red-600 z-10 shadow-sm">
                            {num}
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-3 shadow-sm mt-0.5">
                            <div className="flex items-center justify-between mb-1.5">
                              {entry.usuario && (
                                <span className="text-[11px] font-semibold text-gray-600">{entry.usuario}</span>
                              )}
                              <span className="text-[10px] text-gray-400 tabular-nums ml-auto">
                                {new Date(entry.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed mb-2">{entry.motivo}</p>
                            {secaoLabels.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {secaoLabels.map((l) => (
                                  <span key={l} className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full font-medium">
                                    {l}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xs text-gray-700">{sol.motivo_recusa}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="border-b border-gray-100 shrink-0 overflow-x-auto bg-white">
          <div className="flex min-w-max px-5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                  tab === t.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Conteúdo das tabs ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50/30">
          {tab === "dados" && (
            <>
              <Section title="Empresa">
                <Field label="Razão Social" value={sol.razao_social} />
                <Field label="Nome Fantasia" value={sol.nome_fantasia} />
                <Field label="CNPJ" value={sol.cnpj} mono />
                <Field label="Insc. Estadual" value={sol.ie} mono />
                <Field label="E-mail" value={sol.email} />
                <Field label="Responsável" value={sol.responsavel} />
                <Field label="Tel. Fixo" value={sol.telefone_fixo} mono />
                <Field label="Celular" value={sol.telefone_celular} mono />
              </Section>

              <Section title="Pagamentos">
                <div className="col-span-2 flex flex-wrap gap-1.5">
                  {Object.entries({
                    dinheiro:        "Dinheiro",
                    cheque:          "Cheque",
                    cartao_pos:      "Cartão-POS",
                    pagamento_prazo: "Prazo",
                    pix:             "PIX",
                    cartao_tef:      "Cartão-TEF",
                  }).map(([key, label]) =>
                    p[key] ? (
                      <span key={key} className="px-2 py-1 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">
                        {label}
                      </span>
                    ) : null
                  )}
                  {p.integradora && (
                    <span className="px-2 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      TEF: {p.integradora}
                    </span>
                  )}
                </div>
              </Section>
            </>
          )}

          {tab === "endereco" && (
            <Section title="Endereço">
              <Field label="CEP" value={e.cep} mono />
              <Field label="Endereço" value={e.endereco} />
              <Field label="Número" value={e.numero} />
              <Field label="Bairro" value={e.bairro} />
              <Field label="Cidade" value={e.cidade} />
              <Field label="Estado" value={e.estado} />
            </Section>
          )}

          {tab === "contabilidade" && (
            <>
              <Section title="Contador">
                <Field label="Nome" value={ct.nome_contador} />
                <Field label="CPF" value={ct.cpf} mono />
                <Field label="CRC" value={ct.crc} />
                <Field label="CNPJ" value={ct.cnpj} mono />
                <Field label="E-mail" value={ct.email} />
                <Field label="Celular" value={ct.telefone_celular} mono />
              </Section>
              <Section title="Endereço do Contador">
                <Field label="CEP" value={ct.cep} mono />
                <Field label="Endereço" value={ct.endereco} />
                <Field label="Número" value={ct.numero} />
                <Field label="Cidade/UF" value={ct.cidade ? `${ct.cidade} - ${ct.estado}` : null} />
              </Section>
            </>
          )}

          {tab === "bancario" && (
            <Section title="Dados Bancários">
              {(() => {
                const match = b.nome_banco ? BANCOS_BR.find((bk) => bk.nome === b.nome_banco) : null;
                const cod  = b.codigo_banco || match?.codigo || null;
                const cnpj = b.cnpj_banco   || match?.cnpj   || null;
                return (
                  <>
                    <Field label="Cód. Banco"    value={cod}         mono />
                    <Field label="Banco"          value={b.nome_banco}     />
                    <Field label="CNPJ do Banco"  value={cnpj}        mono />
                  </>
                );
              })()}
              <Field label="Tipo de Conta" value={b.tipo_conta} />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Agência</p>
                <p className="text-sm text-gray-800 font-mono">
                  {b.agencia ? `${b.agencia}${b.dv_agencia ? `-${b.dv_agencia}` : ""}` : <span className="text-gray-300">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Conta</p>
                <p className="text-sm text-gray-800 font-mono">
                  {b.conta ? `${b.conta}${b.dv_conta ? `-${b.dv_conta}` : ""}` : <span className="text-gray-300">—</span>}
                </p>
              </div>
            </Section>
          )}

          {tab === "regime" && (
            <Section title="Regime Tributário">
              <Field label="CRT" value={CRT_LABEL[r.crt] || r.crt} />
              <Field label="Regime" value={REGIME_LABEL[r.regime_tributario] || r.regime_tributario} />
              <Field label="Condição ST" value={r.condicao_st} />
              {(r.regime_tributario === "simples_nacional" || r.crt === "1" || r.crt === "2") && (
                <>
                  <Field label="Alíq. Simples Nacional" value={r.aliq_simples ? `${r.aliq_simples}%` : null} />
                  <Field label="Receita Bruta" value={r.receita_bruta ? `R$ ${r.receita_bruta}` : null} />
                </>
              )}
            </Section>
          )}

          {tab === "fiscal" && (
            <>
              <Section title="NFC-e / NF-e">
                <Field label="CSC" value={f.csc} mono />
                <Field label="Token" value={f.token} mono />
                <Field label="Série NF-e" value={f.serie_nfe} />
                <Field label="Última NF-e" value={f.ultima_nfe_emitida} />
                <Field label="Última Série NFC-e" value={f.ultima_serie_nfce} />
              </Section>

              <Section title="Certificado Digital">
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Arquivo</p>
                  {certFile ? (
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-700">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {certFile}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>

                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Senha</p>
                  {f.senha_certificado ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-800">
                        {showPass ? f.senha_certificado : "•".repeat(Math.min(f.senha_certificado.length, 16))}
                      </span>
                      <button
                        onClick={() => setShowPass((v) => !v)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                      >
                        {showPass ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>
              </Section>

            </>
          )}
        </div>
      </div>

      {modal === "aprovar" && (
        <AprovarModal
          sol={sol}
          onClose={() => setModal(null)}
          onApproved={(impl) => { setModal(null); onApproved(impl); }}
        />
      )}
      {modal === "recusar" && (
        <RecusarModal
          sol={sol}
          onClose={() => setModal(null)}
          onRefused={() => { setModal(null); onRefused(); }}
        />
      )}
      {modal === "cancelar" && (
        <CancelarModal
          sol={sol}
          onClose={() => setModal(null)}
          onCancelled={() => { setModal(null); onRefused(); }}
        />
      )}
      {modal === "editar" && (
        <EditModal
          sol={sol}
          onClose={() => setModal(null)}
          onSaved={(updated) => { setModal(null); onEdited(updated); }}
        />
      )}
    </>
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
  { key: "ativas",    label: "Ativas"    },
  { key: "historico", label: "Histórico" },
  { key: "",          label: "Todas"     },
];

export default function Triagem() {
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState("ativas");
  const [selected, setSelected]         = useState(null);
  const [search, setSearch]             = useState("");

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

  async function openDrawer(id) {
    try {
      const { data } = await solicitacoesApi.obter(id);
      setSelected(data);
    } catch { /* ignore */ }
  }

  async function handleTriar(id) {
    await solicitacoesApi.triar(id);
    const { data } = await solicitacoesApi.obter(id);
    setSelected(data);
    load();
  }

  function handleApproved() { setSelected(null); load(); }
  function handleRefused()  { setSelected(null); load(); }
  function handleEdited(updated) { setSelected(updated); load(); }

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

  return (
    <Layout>
      {/* ── Cabeçalho + busca ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Triagem</h1>
          <p className="text-sm text-gray-500 mt-1">Analise e aprove as solicitações recebidas.</p>
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar empresa, CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 bg-white"
          />
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total"               value={items.length}       icon="total"      accent="gray"   sub={canceladas > 0 ? `${canceladas} cancelada${canceladas !== 1 ? "s" : ""}` : null} />
        <KpiCard label="Pendentes"           value={pendentes}          icon="pending"    accent="orange" />
        <KpiCard label="Em Triagem"          value={emTriagem}          icon="triagem"    accent="blue"   />
        <KpiCard label="Aguardando Correção"  value={aguardandoCorrecao} icon="correction" accent={aguardandoCorrecao > 0 ? "yellow" : "gray"} />
        <KpiCard label="Vence em 24h"        value={urgentes}           icon="urgent"     accent={urgentes > 0 ? "red" : "gray"} />
      </div>

      {/* ── Abas de status ────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map((t) => {
          const cnt = countTab(t.key);
          return (
            <button
              key={t.key}
              onClick={() => setFilterStatus(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                filterStatus === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {cnt > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  filterStatus === t.key
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
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm font-medium text-gray-700">Nenhuma solicitação encontrada</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? "Tente outro termo de busca." : "Altere o filtro para ver outras solicitações."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-100 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  <th className="p-0 w-1" />
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Recebida</th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => {
                  const sla = slaRelativo(s);
                  const isAlta = s.prioridade && s.prioridade !== "normal";
                  const isTerminal = TERMINAL_STATUSES.includes(s.status);
                  const accent = STATUS_ACCENT[s.status] || "bg-gray-200";
                  const rowBg = isTerminal
                    ? "bg-gray-50/60 hover:bg-gray-100/60"
                    : sla?.level === "expired"
                    ? "bg-red-50/30 hover:bg-red-50/60"
                    : "hover:bg-orange-50/40";

                  return (
                    <tr
                      key={s.id}
                      onClick={() => openDrawer(s.id)}
                      className={`transition-colors cursor-pointer group ${rowBg}`}
                    >
                      {/* Acento lateral por status */}
                      <td className={`p-0 ${accent}`} style={{ width: "4px", minWidth: "4px" }} />

                      {/* Empresa */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold transition-colors ${isTerminal ? "text-gray-500" : "text-gray-900 group-hover:text-orange-600"}`}>
                            {s.razao_social}
                          </p>
                          {isAlta && !isTerminal && <PrioridadeBadge prioridade={s.prioridade} />}
                          {s.status === "em_triagem" && s.motivo_recusa && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Correção recebida
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

                      {/* SLA — oculto para terminais */}
                      <td className="px-4 py-4">
                        {sla ? (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
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
                            {isTerminal ? "Encerrada" : "—"}
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

      {selected && (
        <Drawer
          sol={selected}
          onClose={() => setSelected(null)}
          onTriar={handleTriar}
          onApproved={handleApproved}
          onRefused={handleRefused}
          onEdited={handleEdited}
        />
      )}
    </Layout>
  );
}
