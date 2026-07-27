import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { Badge, PrioridadeBadge } from "../components/ui/Badge";
import { solicitacoesApi, usuariosApi, instalacaosApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { BANCOS_BR } from "../data/bancos";
import { fmtDateTime } from "../utils/dateUtils";
import {
  slaRelativo, SLA_PILL, SECOES_CORRECAO_KEYS,
  Field, Section, AprovarModal, RecusarModal, CancelarModal, EditModal, RespPicker,
} from "./Triagem";

// ── Stepper de estágio ───────────────────────────────────────────────────────

function StatusStepper({ status, t, dates = [], lang }) {
  if (status === "cancelada") return null; // estado terminal já coberto pelo banner cinza
  const idx = status === "nova" ? 0 : (status === "aprovada" || status === "recusada") ? 2 : 1;
  const isRefused = status === "recusada";
  const labels = [t("stepper.received"), t("stepper.inReview"), isRefused ? t("stepper.refused") : t("stepper.approved")];

  function nodeClasses(i) {
    if (i === 2 && i === idx) return isRefused ? "bg-red-500 text-white" : "bg-emerald-500 text-white";
    if (i < idx) return "bg-emerald-500 text-white";
    if (i === idx) return "bg-amber-400 text-white animate-pulse";
    return "bg-white/10 text-slate-500";
  }

  // Data curta abaixo do step (só pra etapas já alcançadas) + tooltip com data/hora completa
  function stepDate(i) {
    const iso = dates[i];
    if (!iso || i > idx) return null;
    const d = new Date(iso);
    return {
      short: d.toLocaleDateString(lang, { day: "2-digit", month: "2-digit" }),
      full: d.toLocaleString(lang, { dateStyle: "short", timeStyle: "short" }),
    };
  }

  return (
    <div className="mt-4">
      {/* Círculos + linha conectora — altura fixa; nunca se desloca por causa do texto abaixo */}
      <div className="flex items-center">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex items-center flex-1 ${i === 2 ? "justify-center" : ""}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${nodeClasses(i)}`}>
              {i < idx || (i === idx && i === 2 && !isRefused) ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : i === idx && i === 2 && isRefused ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && <div className={`h-0.5 flex-1 mx-1.5 rounded-full ${i < idx ? "bg-emerald-500" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

      {/* Rótulos + datas — linha separada, altura variável não afeta mais o alinhamento acima */}
      <div className="flex items-start mt-1.5">
        {[0, 1, 2].map((i) => {
          const dt = stepDate(i);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <span className={`text-[10px] font-medium whitespace-nowrap ${i <= idx ? "text-slate-300" : "text-slate-500"}`}>{labels[i]}</span>
              {dt && (
                <span className="text-[9px] text-slate-500 whitespace-nowrap" title={dt.full}>{dt.short}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Produtos Contratados ─────────────────────────────────────────────────────

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/(^|[\s/-])\S/g, (c) => c.toUpperCase());
}

function hexToRgba(hex, alpha) {
  const c = hex && hex.startsWith("#") && hex.length >= 7 ? hex : "#6366f1";
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ProdutosContratadosCard({ sol, isTerminal, onSaved }) {
  const { t } = useTranslation("triagem");
  const [catalogo, setCatalogo] = useState([]);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState([]);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    instalacaosApi.tipos().then(({ data }) => setCatalogo(data.filter((tp) => tp.ativo))).catch(() => {});
  }, []);

  function startEdit() {
    const existing = (sol.produtos_contratados || []).map((p) => ({ ...p }));
    setRows(existing.length > 0 ? existing : [{ tipo: "", nome: "", quantidade: 1 }]);
    setObservacao(sol.observacao_comercial || "");
    setError("");
    setEditing(true);
  }

  function addRow() {
    setRows((r) => [...r, { tipo: "", nome: "", quantidade: 1 }]);
  }
  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }
  function updateRowTipo(idx, tipoValue) {
    const prod = catalogo.find((c) => c.tipo === tipoValue);
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, tipo: tipoValue, nome: prod?.nome || "" } : row)));
  }
  function updateRowQtd(idx, qtd) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, quantidade: qtd } : row)));
  }

  async function handleSave() {
    const valid = rows.filter((r) => r.tipo && Number(r.quantidade) > 0);
    setSaving(true);
    setError("");
    try {
      const { data } = await solicitacoesApi.atualizarProdutosContratados(sol.id, {
        produtos_contratados: valid.map(({ tipo, nome, quantidade }) => ({ tipo, nome, quantidade: Number(quantidade) })),
        observacao_comercial: observacao.trim() || null,
      });
      onSaved(data);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const produtos = sol.produtos_contratados || [];

  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-xs font-semibold text-gray-700">{t("contractedProducts.title")}</span>
        </div>
        {!isTerminal && !editing && (
          <button onClick={startEdit} className="text-xs font-semibold text-orange-600 hover:text-orange-700">
            {produtos.length > 0 ? t("contractedProducts.edit") : t("contractedProducts.add")}
          </button>
        )}
      </div>

      {!editing ? (
        produtos.length > 0 || sol.observacao_comercial ? (
          <div className="space-y-2">
            {produtos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {produtos.map((p, i) => {
                  const hex = catalogo.find((c) => c.tipo === p.tipo)?.cor || "#6366f1";
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                      style={{ backgroundColor: hexToRgba(hex, 0.08), color: hex, borderColor: hexToRgba(hex, 0.3) }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                      <span className="font-semibold">{p.quantidade}×</span> {toTitleCase(p.nome)}
                    </span>
                  );
                })}
              </div>
            )}
            {sol.observacao_comercial && (
              <p className="text-xs text-gray-600 italic leading-relaxed border-t border-gray-100 pt-2">"{sol.observacao_comercial}"</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">{t("contractedProducts.empty")}</p>
        )
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-3">
          <div>
            <div className="hidden sm:flex items-center gap-2 px-1 mb-1.5">
              <span className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{t("contractedProducts.columnProduct")}</span>
              <span className="w-[92px] text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-center shrink-0">{t("contractedProducts.columnQty")}</span>
              <span className="w-7 shrink-0" />
            </div>
            <div className="space-y-1.5">
              {rows.map((row, i) => {
                const hex = catalogo.find((c) => c.tipo === row.tipo)?.cor || "#9ca3af";
                return (
                  <div key={i} className="group flex items-center gap-2 bg-white rounded-lg border border-gray-200 pl-2.5 pr-1.5 py-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.tipo ? hex : "#d1d5db" }} />
                    <div className="relative flex-1 min-w-0">
                      <select
                        value={row.tipo}
                        onChange={(e) => updateRowTipo(i, e.target.value)}
                        className="w-full appearance-none bg-transparent text-sm text-gray-700 pr-5 py-1.5 focus:outline-none cursor-pointer truncate"
                      >
                        <option value="">{t("contractedProducts.selectProduct")}</option>
                        {catalogo.map((c) => (
                          <option key={c.id} value={c.tipo}>{toTitleCase(c.nome)}</option>
                        ))}
                      </select>
                      <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => updateRowQtd(i, Math.max(1, Number(row.quantidade) - 1))}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                      </button>
                      <span className="w-7 text-center text-sm font-semibold text-gray-700 tabular-nums">{row.quantidade}</span>
                      <button
                        type="button"
                        onClick={() => updateRowQtd(i, Number(row.quantidade) + 1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 opacity-40 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/40 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            {t("contractedProducts.addRow")}
          </button>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("contractedProducts.observationLabel")}</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder={t("contractedProducts.observationPlaceholder")}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-700 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 bg-white hover:bg-gray-50 transition-colors">
              {t("contractedProducts.cancel")}
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {saving ? t("contractedProducts.saving") : t("contractedProducts.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Conversão de dados ───────────────────────────────────────────────────────

function ConversaoDadosCard({ sol, isTerminal, onSaved }) {
  const { t } = useTranslation("triagem");
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (isTerminal || saving) return;
    setSaving(true);
    try {
      const { data } = await solicitacoesApi.atualizarConversaoDados(sol.id, !sol.conversao_dados);
      onSaved(data);
    } catch {
      // Falha de rede não deve travar a tela de triagem — usuário pode tentar de novo.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <button
        type="button"
        onClick={toggle}
        disabled={isTerminal || saving}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
          sol.conversao_dados ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
        } ${isTerminal ? "opacity-70 cursor-default" : ""}`}
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          sol.conversao_dados ? "bg-blue-500" : "bg-gray-300"
        }`}>
          {sol.conversao_dados && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${sol.conversao_dados ? "text-blue-700" : "text-gray-600"}`}>
            {t("dataConversion.title")}
          </p>
          <p className="text-xs text-gray-400">{t("dataConversion.desc")}</p>
        </div>
        {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin shrink-0" />}
      </button>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function TriagemDetalhe() {
  const { t, i18n: i18nInstance } = useTranslation("triagem");
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [sol, setSol]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [modal, setModal]         = useState(null); // "aprovar" | "recusar" | "cancelar" | "editar"
  const [triando, setTriando]     = useState(false);
  const [tab, setTab]             = useState("dados");
  const [showPass, setShowPass]   = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenvioMsg, setReenvioMsg] = useState(null);
  const [usuarios, setUsuarios]   = useState([]);
  const [showRespPicker, setShowRespPicker] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Sequência de navegação Anterior/Próxima — vem da lista (state da rota); se
  // ausente (acesso direto/refresh), cai para a lista completa como fallback.
  const [ids, setIds] = useState(location.state?.ids || null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await solicitacoesApi.obter(id);
      setSol(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setTab("dados"); setHistoryOpen(false); }, [id]);

  useEffect(() => {
    if (location.state?.ids) setIds(location.state.ids);
  }, [location.state]);

  useEffect(() => {
    if (ids) return;
    solicitacoesApi.listar({}).then(({ data }) => setIds(data.map((s) => s.id))).catch(() => {});
  }, [ids]);

  useEffect(() => {
    usuariosApi.listar().then((r) => setUsuarios(r.data.filter((u) => u.ativo !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showRespPicker) return;
    const handler = (e) => { if (!e.target.closest("[data-resp-picker]")) setShowRespPicker(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showRespPicker]);

  const curIndex = ids ? ids.indexOf(Number(id)) : -1;
  const prevId = ids && curIndex > 0 ? ids[curIndex - 1] : null;
  const nextId = ids && curIndex >= 0 && curIndex < ids.length - 1 ? ids[curIndex + 1] : null;

  function goTo(targetId) {
    if (!targetId) return;
    navigate(`/admin/triagem/${targetId}`, { state: { ids } });
  }

  // ── Atalhos de teclado ── ↑/Esc fecha ou volta · ←/→ navega · ignora se modal aberto ou foco em campo de texto
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (modal) {
        if (e.key === "Escape") setModal(null);
        return;
      }
      if (typing) return;
      if (e.key === "Escape") { navigate("/admin/triagem"); }
      else if (e.key === "ArrowLeft" && prevId) { goTo(prevId); }
      else if (e.key === "ArrowRight" && nextId) { goTo(nextId); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, prevId, nextId, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAtribuir(responsavel_id) {
    setAtribuindo(true);
    setShowRespPicker(false);
    try {
      const { data } = await solicitacoesApi.atribuirResponsavel(sol.id, responsavel_id);
      setSol(data);
    } catch {}
    finally { setAtribuindo(false); }
  }

  async function handleTriar() {
    setTriando(true);
    try {
      await solicitacoesApi.triar(sol.id);
      await load();
    } finally {
      setTriando(false);
    }
  }

  async function handleReenviarEmail() {
    setReenviando(true);
    setReenvioMsg(null);
    try {
      await solicitacoesApi.reenviarEmail(sol.id);
      setReenvioMsg({ ok: true, text: t("drawer.resendSuccess") });
    } catch (err) {
      setReenvioMsg({ ok: false, text: err.message || t("drawer.resendError") });
    } finally {
      setReenviando(false);
    }
  }

  if (loading && !sol) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-40">
          <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !sol) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-40 gap-3">
          <p className="text-sm text-red-500">{error || t("drawer.notFound")}</p>
          <button onClick={() => navigate("/admin/triagem")} className="text-xs text-gray-400 hover:underline">
            {t("nav.backToList")}
          </button>
        </div>
      </Layout>
    );
  }

  const canEdit = user?.grupo_nome?.toLowerCase().includes("administra");
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
    { id: "dados", labelKey: "dados" },
    { id: "endereco", labelKey: "endereco" },
    { id: "contabilidade", labelKey: "contabilidade" },
    { id: "bancario", labelKey: "bancario" },
    { id: "regime", labelKey: "regime" },
    { id: "fiscal", labelKey: "fiscal" },
  ];

  const initials = sol.razao_social.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const sla = slaRelativo(sol);
  const hasHistory = (sol.historico_recusas?.length > 0 || sol.motivo_recusa) && sol.status !== "cancelada";

  const AVATAR_BG = {
    nova: "bg-blue-500", em_triagem: "bg-amber-500", aguardando_correcao: "bg-orange-500",
    aprovada: "bg-green-500", recusada: "bg-red-500", cancelada: "bg-gray-400",
  };

  return (
    <Layout>
      {/* ── Breadcrumb + navegação Anterior/Próxima ── */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <button
          onClick={() => navigate("/admin/triagem")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("nav.backToList")}
        </button>

        {ids && curIndex >= 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => goTo(prevId)}
              disabled={!prevId}
              title={t("nav.prev")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              {t("nav.prev")}
            </button>
            <span className="text-xs text-gray-400 tabular-nums">{t("nav.position", { current: curIndex + 1, total: ids.length })}</span>
            <button
              onClick={() => goTo(nextId)}
              disabled={!nextId}
              title={t("nav.next")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t("nav.next")}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        {/* ── Hero header ── */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-5 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg ${AVATAR_BG[sol.status] || "bg-slate-600"}`}>
                {initials || "?"}
              </div>
              <div className="min-w-0">
                <h1 className="text-white font-bold text-lg leading-snug">{sol.razao_social}</h1>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-slate-400 text-xs font-mono">{sol.cnpj}</span>
                  <span className="text-slate-600 text-xs">·</span>
                  <span className="text-slate-400 text-xs">{t("drawer.receivedOn", { date: fmtDateTime(sol.created_at) })}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Badge status={sol.status} />
            <PrioridadeBadge prioridade={sol.prioridade} />
            {sla && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SLA_PILL[sla.level]}`}>
                {sla.label}
              </span>
            )}
          </div>

          <StatusStepper
            status={sol.status}
            t={t}
            lang={i18nInstance.language}
            dates={[sol.created_at, sol.triagem_iniciada_em, sol.status === "recusada" ? null : sol.aprovada_em]}
          />

          {/* ── Responsável da triagem ── */}
          {!isTerminal && (
            <div className="relative mt-4" data-resp-picker>
              <button
                onClick={() => setShowRespPicker((v) => !v)}
                disabled={atribuindo}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors disabled:opacity-50">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${sol.responsavel_triagem_id ? "bg-indigo-500 text-white" : "bg-slate-600 text-slate-300"}`}>
                  {sol.responsavel_triagem_nome
                    ? sol.responsavel_triagem_nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
                    : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  }
                </div>
                <span>{atribuindo ? t("drawer.savingEllipsis") : (sol.responsavel_triagem_nome ? t("drawer.responsibleLabel", { name: sol.responsavel_triagem_nome }) : t("drawer.assignResponsible"))}</span>
                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>

              {showRespPicker && (
                <RespPicker usuarios={usuarios} selectedId={sol.responsavel_triagem_id} onSelect={handleAtribuir} />
              )}
            </div>
          )}
        </div>

        {/* ── Barra de ações ── */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/80 flex-wrap">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            {canTriar && (
              <button onClick={handleTriar} disabled={triando}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
                {triando ? t("drawer.actions.startingTriage") : t("drawer.actions.startTriage")}
              </button>
            )}
            {canAprovarRecusar && (
              <>
                <button onClick={() => setModal("aprovar")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t("drawer.actions.approve")}
                </button>
                <button onClick={() => setModal("recusar")}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors">
                  {t("drawer.actions.refuse")}
                </button>
              </>
            )}
            {canCancelar && (
              <button onClick={() => setModal("cancelar")}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 transition-colors">
                {t("drawer.actions.cancel")}
              </button>
            )}
          </div>
          {canEdit && sol.status !== "aprovada" && (
            <button onClick={() => setModal("editar")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t("drawer.actions.edit")}
            </button>
          )}
        </div>

        {/* ── Produtos contratados (comercial) ── */}
        <ProdutosContratadosCard sol={sol} isTerminal={isTerminal} onSaved={setSol} />

        {/* ── Conversão de dados ── */}
        <ConversaoDadosCard sol={sol} isTerminal={isTerminal} onSaved={setSol} />

        {/* ── Banners de status ── */}
        {sol.status === "aprovada" && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-100 bg-green-50">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-green-800">{t("drawer.banners.approved.title")}</p>
              <p className="text-xs text-green-600">{t("drawer.banners.approved.desc")}</p>
            </div>
            <button onClick={() => navigate("/admin/implantacoes")}
              className="text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
              {t("drawer.banners.approved.link")}
            </button>
          </div>
        )}

        {sol.status === "aguardando_correcao" && (
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">{t("drawer.banners.awaitingCorrection.title")}</p>
                <p className="text-xs text-amber-600 mt-0.5">{t("drawer.banners.awaitingCorrection.desc")}</p>
                {reenvioMsg && (
                  <p className={`text-xs mt-1.5 font-medium ${reenvioMsg.ok ? "text-green-700" : "text-red-600"}`}>
                    {reenvioMsg.text}
                  </p>
                )}
              </div>
              <button onClick={handleReenviarEmail} disabled={reenviando}
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50">
                {reenviando
                  ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                  : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                }
                {reenviando ? t("drawer.banners.awaitingCorrection.resending") : t("drawer.banners.awaitingCorrection.resend")}
              </button>
            </div>
          </div>
        )}

        {sol.status === "cancelada" && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-100">
            <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-gray-600">{t("drawer.banners.cancelled.title")}</p>
          </div>
        )}

        {/* ── Histórico de recusas (timeline) ── */}
        {hasHistory && (
          <div className="border-b border-gray-100">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-full flex items-center gap-2.5 px-5 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700 flex-1 text-left">{t("drawer.history.title")}</span>
              {sol.historico_recusas?.length > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
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
                        (k) => SECOES_CORRECAO_KEYS.includes(k) ? t(`correctionSections.${k}`) : k
                      );
                      return (
                        <div key={idx} className="relative flex gap-3 pb-3 last:pb-0">
                          <div className="w-7 h-7 rounded-full bg-red-100 border-2 border-white flex items-center justify-center shrink-0 text-xs font-bold text-red-600 z-10 shadow-sm">
                            {num}
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-3 shadow-sm mt-0.5">
                            <div className="flex items-center justify-between mb-1.5">
                              {entry.usuario && (
                                <span className="text-xs font-semibold text-gray-600">{entry.usuario}</span>
                              )}
                              <span className="text-[11px] text-gray-400 tabular-nums ml-auto">
                                {new Date(entry.data).toLocaleString(i18nInstance.language, { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed mb-2">{entry.motivo}</p>
                            {secaoLabels.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {secaoLabels.map((l) => (
                                  <span key={l} className="text-xs bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full font-medium">
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
        <div className="border-b border-gray-100 overflow-x-auto bg-white">
          <div className="flex min-w-max px-5">
            {TABS.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                  tab === tb.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
                }`}
              >
                {t(`drawer.tabs.${tb.labelKey}`)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Conteúdo das tabs ── */}
        <div className="px-6 py-5 bg-gray-50/30">
          <div className="max-w-4xl">
            {tab === "dados" && (
              <>
                <Section title={t("drawer.sections.empresa")}>
                  <Field label={t("drawer.fields.razaoSocial")} value={sol.razao_social} />
                  <Field label={t("drawer.fields.nomeFantasia")} value={sol.nome_fantasia} />
                  <Field label={t("drawer.fields.cnpj")} value={sol.cnpj} mono />
                  <Field label={t("drawer.fields.ie")} value={sol.ie} mono />
                  <Field label={t("drawer.fields.email")} value={sol.email} />
                  <Field label={t("drawer.fields.responsavel")} value={sol.responsavel} />
                  <Field label={t("drawer.fields.telFixo")} value={sol.telefone_fixo} mono />
                  <Field label={t("drawer.fields.celular")} value={sol.telefone_celular} mono />
                </Section>

                <Section title={t("drawer.sections.pagamentos")}>
                  <div className="col-span-2 flex flex-wrap gap-1.5">
                    {Object.entries({
                      dinheiro:        t("drawer.paymentLabels.dinheiro"),
                      cheque:          t("drawer.paymentLabels.cheque"),
                      cartao_pos:      t("drawer.paymentLabels.cartaoPos"),
                      pagamento_prazo: t("drawer.paymentLabels.prazo"),
                      pix:             t("drawer.paymentLabels.pix"),
                      cartao_tef:      t("drawer.paymentLabels.cartaoTef"),
                    }).map(([key, label]) =>
                      p[key] ? (
                        <span key={key} className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          {label}
                        </span>
                      ) : null
                    )}
                    {p.integradora && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {t("drawer.tefPrefix", { name: p.integradora })}
                      </span>
                    )}
                  </div>
                </Section>
              </>
            )}

            {tab === "endereco" && (
              <Section title={t("drawer.sections.endereco")}>
                <Field label={t("drawer.fields.cep")} value={e.cep} mono />
                <Field label={t("drawer.fields.endereco")} value={e.endereco} />
                <Field label={t("drawer.fields.numero")} value={e.numero} />
                <Field label={t("drawer.fields.bairro")} value={e.bairro} />
                <Field label={t("drawer.fields.cidade")} value={e.cidade} />
                <Field label={t("drawer.fields.estado")} value={e.estado} />
              </Section>
            )}

            {tab === "contabilidade" && (
              <>
                <Section title={t("drawer.sections.contador")}>
                  <Field label={t("drawer.fields.nome")} value={ct.nome_contador} />
                  <Field label={t("drawer.fields.cpf")} value={ct.cpf} mono />
                  <Field label={t("drawer.fields.crc")} value={ct.crc} />
                  <Field label={t("drawer.fields.cnpj")} value={ct.cnpj} mono />
                  <Field label={t("drawer.fields.email")} value={ct.email} />
                  <Field label={t("drawer.fields.celular")} value={ct.telefone_celular} mono />
                </Section>
                <Section title={t("drawer.sections.enderecoContador")}>
                  <Field label={t("drawer.fields.cep")} value={ct.cep} mono />
                  <Field label={t("drawer.fields.endereco")} value={ct.endereco} />
                  <Field label={t("drawer.fields.numero")} value={ct.numero} />
                  <Field label={t("drawer.fields.cidadeUf")} value={ct.cidade ? `${ct.cidade} - ${ct.estado}` : null} />
                </Section>
              </>
            )}

            {tab === "bancario" && (
              <Section title={t("drawer.sections.dadosBancarios")}>
                {(() => {
                  const match = b.nome_banco ? BANCOS_BR.find((bk) => bk.nome === b.nome_banco) : null;
                  const cod  = b.codigo_banco || match?.codigo || null;
                  const cnpj = b.cnpj_banco   || match?.cnpj   || null;
                  return (
                    <>
                      <Field label={t("drawer.fields.codBanco")} value={cod} mono />
                      <Field label={t("drawer.fields.banco")} value={b.nome_banco} />
                      <Field label={t("drawer.fields.cnpjBanco")} value={cnpj} mono />
                    </>
                  );
                })()}
                <Field label={t("drawer.fields.tipoConta")} value={b.tipo_conta} />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{t("drawer.fields.agencia")}</p>
                  <p className="text-sm text-gray-800 font-mono">
                    {b.agencia ? `${b.agencia}${b.dv_agencia ? `-${b.dv_agencia}` : ""}` : <span className="text-gray-300">—</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{t("drawer.fields.conta")}</p>
                  <p className="text-sm text-gray-800 font-mono">
                    {b.conta ? `${b.conta}${b.dv_conta ? `-${b.dv_conta}` : ""}` : <span className="text-gray-300">—</span>}
                  </p>
                </div>
              </Section>
            )}

            {tab === "regime" && (
              <Section title={t("drawer.sections.regimeTributario")}>
                <Field label={t("drawer.fields.crt")} value={t(`drawer.regimeLabels.crt.${r.crt}`, { defaultValue: r.crt })} />
                <Field label={t("drawer.fields.regime")} value={t(`drawer.regimeLabels.tributario.${r.regime_tributario}`, { defaultValue: r.regime_tributario })} />
                <Field label={t("drawer.fields.condicaoSt")} value={r.condicao_st} />
                {(r.regime_tributario === "simples_nacional" || r.crt === "1" || r.crt === "2") && (
                  <>
                    <Field label={t("drawer.fields.aliqSimples")} value={r.aliq_simples ? `${r.aliq_simples}%` : null} />
                    <Field label={t("drawer.fields.receitaBruta")} value={r.receita_bruta ? `R$ ${r.receita_bruta}` : null} />
                  </>
                )}
              </Section>
            )}

            {tab === "fiscal" && (
              <>
                <Section title={t("drawer.sections.nfe")}>
                  <Field label={t("drawer.fields.csc")} value={f.csc} mono />
                  <Field label={t("drawer.fields.token")} value={f.token} mono />
                  <Field label={t("drawer.fields.serieNfe")} value={f.serie_nfe} />
                  <Field label={t("drawer.fields.ultimaNfe")} value={f.ultima_nfe_emitida} />
                  <Field label={t("drawer.fields.ultimaSerieNfce")} value={f.ultima_serie_nfce} />
                </Section>

                <Section title={t("drawer.sections.certificadoDigital")}>
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{t("drawer.fields.arquivo")}</p>
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
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{t("drawer.fields.senha")}</p>
                    {f.senha_certificado ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-800">
                          {showPass ? f.senha_certificado : "•".repeat(Math.min(f.senha_certificado.length, 16))}
                        </span>
                        <button onClick={() => setShowPass((v) => !v)} className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors">
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
      </div>

      {modal === "aprovar" && (
        <AprovarModal sol={sol} onClose={() => setModal(null)} onApproved={() => { setModal(null); load(); }} />
      )}
      {modal === "recusar" && (
        <RecusarModal sol={sol} onClose={() => setModal(null)} onRefused={() => { setModal(null); load(); }} />
      )}
      {modal === "cancelar" && (
        <CancelarModal sol={sol} onClose={() => setModal(null)} onCancelled={() => { setModal(null); load(); }} />
      )}
      {modal === "editar" && (
        <EditModal sol={sol} onClose={() => setModal(null)} onSaved={(updated) => { setModal(null); setSol(updated); }} />
      )}
    </Layout>
  );
}
