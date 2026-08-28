import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { solicitacoesInstaladorApi } from "../services/api";
import { fmtDateTime, timeAgoFromUTC, timeUntilUTC, parseUTC } from "../utils/dateUtils";

const POLL_MS = 5000;
const PAGE_SIZE = 20;

const STATUS_HISTORICO = [
  { value: "", labelKey: "all" },
  { value: "aprovada", labelKey: "aprovada" },
  { value: "recusada", labelKey: "recusada" },
  { value: "expirada", labelKey: "expirada" },
  { value: "cancelada", labelKey: "cancelada" },
];

function formatCnpj(digits) {
  if (!digits || digits.length !== 14) return digits || "—";
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function Avatar({ nome, avatarUrl, size = "w-6 h-6" }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={nome} className={`${size} rounded-full object-cover shrink-0`} />;
  }
  const initials = (nome || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = [
    "bg-violet-100 text-violet-600",
    "bg-blue-100 text-blue-600",
    "bg-teal-100 text-teal-600",
    "bg-orange-100 text-orange-600",
    "bg-pink-100 text-pink-600",
  ];
  const color = colors[(nome || "").charCodeAt(0) % colors.length];
  return (
    <div className={`${size} rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

const STATUS_STYLE = {
  pendente: { badge: "bg-amber-50 text-amber-700 border-amber-200", accent: "bg-amber-400" },
  aprovada: { badge: "bg-green-50 text-green-700 border-green-200", accent: "bg-green-500" },
  recusada: { badge: "bg-red-50 text-red-700 border-red-200", accent: "bg-red-500" },
  expirada: { badge: "bg-gray-100 text-gray-500 border-gray-200", accent: "bg-gray-300" },
  cancelada: { badge: "bg-gray-100 text-gray-500 border-gray-200", accent: "bg-gray-300" },
};

function StatusBadge({ status }) {
  const { t } = useTranslation("assistenteCriare");
  const style = STATUS_STYLE[status] || STATUS_STYLE.expirada;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${style.badge}`}>
      {status === "pendente" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />}
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

function decisaoDe(sol) {
  return sol.aprovadoEm || sol.recusadoEm || sol.canceladoEm || null;
}

// Célula de identidade do cliente — só nome + CNPJ. Dado de máquina NÃO mora aqui:
// pertence à tentativa específica que pediu a instalação (ver MaquinaChip), não ao
// cliente como um todo, então fica na sua própria coluna.
function ClienteCell({ sol, navigate }) {
  const { t } = useTranslation("assistenteCriare");
  return (
    <div className="min-w-0">
      {sol.clienteId ? (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/clientes/${sol.clienteId}`); }}
          className="text-sm font-semibold text-gray-900 hover:text-orange-600 hover:underline text-left truncate block"
        >
          {sol.clienteNome}
        </button>
      ) : (
        <p className="text-sm font-semibold text-gray-400 italic truncate">{t("clientCell.noRecord")}</p>
      )}
      <p className="text-xs text-gray-400 mt-0.5 font-mono">{formatCnpj(sol.cnpj)}</p>
    </div>
  );
}

// ── Máquina que pediu a instalação ──────────────────────────────────────────────
// Cada solicitação carrega seu próprio snapshot (best-effort via WMI no instalador,
// qualquer campo pode faltar) — a avaliação abaixo transforma os números crus num
// veredito direto, pra quem aprova não precisar saber interpretar GB/SSD sozinho.
const DISCO_LIVRE_BAIXO_PCT = 15;

function avaliarMaquina(info) {
  if (!info) return { nivel: "unknown" };
  const temAlgumDado = info.windows?.versao || info.processador || info.memoriaRamGb || (info.disco?.tipo && info.disco.tipo !== "desconhecido");
  if (!temAlgumDado) return { nivel: "unknown" };

  const disco = info.disco || {};
  let pctLivre = null;
  if (disco.espacoTotalGb && disco.espacoLivreGb != null) {
    pctLivre = (disco.espacoLivreGb / disco.espacoTotalGb) * 100;
  }
  if (pctLivre != null && pctLivre < DISCO_LIVRE_BAIXO_PCT) {
    return { nivel: "warning", pctLivre };
  }
  return { nivel: "ok", pctLivre };
}

function MaquinaChip({ info }) {
  const { t } = useTranslation("assistenteCriare");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const avaliacao = avaliarMaquina(info);
  if (avaliacao.nivel === "unknown") {
    return <span className="text-xs text-gray-300">{t("machine.noData")}</span>;
  }

  function toggleOpen(e) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 300) });
    }
    setOpen((v) => !v);
  }

  const isWarning = avaliacao.nivel === "warning";
  const dotColor = isWarning ? "bg-amber-400" : "bg-green-500";
  const label = isWarning
    ? t("machine.warningLabel", { pct: Math.round(avaliacao.pctLivre) })
    : [info.windows?.versao, info.disco?.tipo && info.disco.tipo !== "desconhecido" ? info.disco.tipo : null]
        .filter(Boolean).join(" · ") || t("machine.hasDataGeneric");

  const disco = info.disco || {};
  const temUso = disco.espacoTotalGb && disco.espacoLivreGb != null;
  const pctUsado = temUso ? Math.round(((disco.espacoTotalGb - disco.espacoLivreGb) / disco.espacoTotalGb) * 100) : null;

  return (
    <>
      <button ref={btnRef} onClick={toggleOpen}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors max-w-[170px]">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="truncate">{label}</span>
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div ref={panelRef} className="fixed z-50 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 p-4"
            style={{ top: pos.top, left: pos.left }}>
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
              <span className="text-sm font-bold text-gray-900">
                {isWarning ? t("machine.verdictWarning") : t("machine.verdictOk")}
              </span>
            </div>
            <dl className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400 shrink-0">{t("machine.fields.os")}</dt>
                <dd className="text-gray-700 text-right">
                  {info.windows?.versao || "—"}
                  {info.windows?.build && <span className="text-gray-400"> · build {info.windows.build}</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400 shrink-0">{t("machine.fields.processor")}</dt>
                <dd className="text-gray-700 text-right truncate max-w-[170px]" title={info.processador || ""}>{info.processador || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400 shrink-0">{t("machine.fields.cores")}</dt>
                <dd className="text-gray-700">{info.nucleos ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400 shrink-0">{t("machine.fields.ram")}</dt>
                <dd className="text-gray-700">{info.memoriaRamGb ? `${info.memoriaRamGb} GB` : "—"}</dd>
              </div>
              <div>
                <div className="flex justify-between gap-3 mb-1">
                  <dt className="text-gray-400 shrink-0">{t("machine.fields.storage")}</dt>
                  <dd className="text-gray-700">{disco.tipo && disco.tipo !== "desconhecido" ? disco.tipo : "—"}</dd>
                </div>
                {temUso ? (
                  <>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${isWarning ? "bg-amber-400" : "bg-gray-400"}`} style={{ width: `${pctUsado}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {t("machine.storageUsage", { free: Math.round(disco.espacoLivreGb), total: Math.round(disco.espacoTotalGb) })}
                    </p>
                  </>
                ) : disco.espacoLivreGb != null ? (
                  <p className="text-[11px] text-gray-400 mt-1">{t("machine.diskFree", { count: Math.round(disco.espacoLivreGb) })}</p>
                ) : null}
              </div>
            </dl>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function ResponsavelCell({ sol, size }) {
  if (!sol.responsavelNome) return <span className="text-gray-300 text-sm">—</span>;
  return (
    <div className="flex items-center gap-2">
      <Avatar nome={sol.responsavelNome} avatarUrl={sol.responsavelAvatarUrl} size={size} />
      <span className="text-sm text-gray-600 truncate max-w-[120px]">{sol.responsavelNome}</span>
    </div>
  );
}

const ETAPA_TRACK_POLL_MS = 3000;

function EtapaRow({ etapa }) {
  const isDone = etapa.status === "concluida";
  const isFailed = etapa.status === "falhou";
  const isActive = etapa.status === "em_andamento";
  const dotColor = isFailed ? "bg-red-500" : isDone ? "bg-green-500" : isActive ? "bg-orange-400 animate-pulse" : "bg-gray-300";
  const horaFim = etapa.concluidoEm ? parseUTC(etapa.concluidoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <li className="flex gap-3">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${dotColor}`} />
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold truncate ${isFailed ? "text-red-600" : "text-gray-800"}`}>{etapa.nome}</span>
          {horaFim && <span className="text-[11px] text-gray-400 shrink-0">{horaFim}</span>}
        </div>
        {isActive && (
          <div className="mt-1.5">
            {etapa.percentual != null && (
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, etapa.percentual))}%` }} />
              </div>
            )}
            {etapa.mensagem && <p className="text-xs text-gray-500 mt-1 truncate" title={etapa.mensagem}>{etapa.mensagem}</p>}
          </div>
        )}
        {isFailed && etapa.mensagem && <p className="text-xs text-red-500 mt-1 truncate" title={etapa.mensagem}>{etapa.mensagem}</p>}
      </div>
    </li>
  );
}

function EtapasModal({ sol, onClose }) {
  const { t } = useTranslation("assistenteCriare");
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await solicitacoesInstaladorApi.etapas(sol.id);
      setEtapas(data);
    } catch {
      // silencioso — o próximo poll tenta de novo, igual ao resto da tela
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sol.id]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), ETAPA_TRACK_POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const atual = etapas.find((e) => e.status === "em_andamento");
  const total = atual?.totalEtapas || etapas.at(-1)?.totalEtapas;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">{t("tracking.title")}</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {sol.clienteNome || formatCnpj(sol.cnpj)}
              {atual && total ? ` · ${t("tracking.stepOf", { atual: atual.indiceEtapa + 1, total })}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            </div>
          ) : etapas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">{t("tracking.empty")}</p>
          ) : (
            <ol className="space-y-4">
              {etapas.map((e) => <EtapaRow key={e.indiceEtapa} etapa={e} />)}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssistenteCriare() {
  const { t } = useTranslation("assistenteCriare");
  const navigate = useNavigate();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("pendentes");
  const [search, setSearch]             = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandidos, setExpandidos]     = useState(new Set());
  const [actingId, setActingId]         = useState(null);
  const [toast, setToast]               = useState(null);
  const [trackingSol, setTrackingSol]   = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await solicitacoesInstaladorApi.listar();
      setSolicitacoes(data);
    } catch {
      if (!silent) setToast({ type: "error", text: t("toast.loadError") });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [load]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab, search, statusFiltro]);

  function toggleExpandido(cnpj) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(cnpj)) next.delete(cnpj); else next.add(cnpj);
      return next;
    });
  }

  function tratarErro(err, errorKey) {
    const msg = err.message || "";
    if (msg.includes("não está mais pendente")) {
      setToast({ type: "info", text: t("toast.alreadyAnswered") });
      load(true);
    } else {
      setToast({ type: "error", text: msg || t(`toast.${errorKey}`) });
    }
  }

  async function handleAprovar(sol) {
    setActingId(sol.id);
    try {
      await solicitacoesInstaladorApi.aprovar(sol.id);
      setToast({ type: "success", text: t("toast.approveSuccess", { nome: sol.clienteNome || formatCnpj(sol.cnpj) }) });
      await load(true);
    } catch (err) {
      tratarErro(err, "errorApprove");
    } finally {
      setActingId(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function handleRecusar(sol) {
    setActingId(sol.id);
    try {
      await solicitacoesInstaladorApi.recusar(sol.id);
      setToast({ type: "info", text: t("toast.rejectSuccess", { nome: sol.clienteNome || formatCnpj(sol.cnpj) }) });
      await load(true);
    } catch (err) {
      tratarErro(err, "errorReject");
    } finally {
      setActingId(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  const pendentes = solicitacoes.filter((s) => s.status === "pendente")
    .sort((a, b) => parseUTC(a.expiraEm) - parseUTC(b.expiraEm));
  const historico = solicitacoes.filter((s) => s.status !== "pendente");

  let lista = tab === "pendentes" ? pendentes : historico;
  if (tab === "historico" && statusFiltro) lista = lista.filter((s) => s.status === statusFiltro);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    lista = lista.filter((s) =>
      (s.clienteNome || "").toLowerCase().includes(q) ||
      (qDigits && s.cnpj.includes(qDigits))
    );
  }

  // No histórico sem filtro de status, agrupa por CNPJ: 1 linha resumo (última tentativa)
  // + accordion com as anteriores. Com filtro de status ativo, mostra a lista crua —
  // agrupar ali confundiria "última tentativa" com "tentativa que bateu o filtro".
  const agrupar = tab === "historico" && !statusFiltro;
  let grupos = [];
  if (agrupar) {
    const porCnpj = new Map();
    for (const sol of lista) {
      if (!porCnpj.has(sol.cnpj)) porCnpj.set(sol.cnpj, []);
      porCnpj.get(sol.cnpj).push(sol);
    }
    grupos = Array.from(porCnpj.values())
      .map((tentativas) => {
        const ordenadas = [...tentativas].sort((a, b) => parseUTC(b.criadoEm) - parseUTC(a.criadoEm));
        return { cnpj: ordenadas[0].cnpj, ultima: ordenadas[0], anteriores: ordenadas.slice(1) };
      })
      .sort((a, b) => parseUTC(b.ultima.criadoEm) - parseUTC(a.ultima.criadoEm));
  }

  const itens = agrupar ? grupos : lista;
  const visiveis = itens.slice(0, visibleCount);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("header.title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("header.subtitle")}</p>
        </div>
        {pendentes.length > 0 && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {t("header.pendingBadge", { count: pendentes.length })}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setTab("pendentes")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "pendentes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t("tabs.pending")}
            {pendentes.length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {pendentes.length}
              </span>
            )}
          </button>
          <button onClick={() => setTab("historico")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "historico" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t("tabs.history")}
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search.placeholder")}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 bg-white shadow-sm" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {tab === "historico" && (
          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400">
            {STATUS_HISTORICO.map((s) => <option key={s.value} value={s.value}>{t(`statusHistorico.${s.labelKey}`)}</option>)}
          </select>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {agrupar
            ? `${t("counter.clients", { count: grupos.length })} · ${t("counter.requests", { count: lista.length })}`
            : t("counter.requests", { count: lista.length })}
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : visiveis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {search || statusFiltro
                ? t("empty.noneForFilter")
                : tab === "pendentes" ? t("empty.nonePending") : t("empty.noneHistory")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b-2 border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="p-0 w-1" />
                  <th className="text-left px-5 py-3">{t("table.client")}</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">{t("table.createdAt")}</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">
                    {tab === "pendentes" ? t("table.expiresAt") : t("table.decidedAt")}
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">{t("table.responsible")}</th>
                  <th className="text-left px-4 py-3">{t("table.status")}</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">{t("table.machine")}</th>
                  <th className="px-4 py-3 w-52" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agrupar ? visiveis.map((grupo) => {
                  const aberto = expandidos.has(grupo.cnpj);
                  const temAnteriores = grupo.anteriores.length > 0;
                  const tentativas = [grupo.ultima, ...(aberto ? grupo.anteriores : [])];
                  return (
                    <Fragment key={grupo.cnpj}>
                      {/* Cabeçalho do cliente — só identidade (nome + CNPJ) e o total de
                          tentativas. Nenhum dado de tentativa específica mora aqui: cada
                          tentativa (inclusive a mais recente) é sua própria linha completa
                          logo abaixo, com os mesmos campos de qualquer outra. */}
                      <tr
                        onClick={() => temAnteriores && toggleExpandido(grupo.cnpj)}
                        className={`bg-gray-50/60 ${temAnteriores ? "cursor-pointer hover:bg-gray-100/70" : ""} transition-colors`}
                      >
                        <td className="p-0 bg-gray-200" style={{ width: "4px", minWidth: "4px" }} />
                        <td colSpan={7} className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 w-4 h-4 flex items-center justify-center rounded text-gray-400 transition-transform ${aberto ? "rotate-90" : ""} ${temAnteriores ? "" : "invisible"}`}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                            <ClienteCell sol={grupo.ultima} navigate={navigate} />
                            <span className="ml-auto shrink-0 text-[11px] font-semibold text-gray-400 whitespace-nowrap">
                              {t("group.attemptsCount", { count: 1 + grupo.anteriores.length })}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {tentativas.map((att, i) => {
                        const isLatest = i === 0;
                        return (
                          <tr key={att.id} className={isLatest ? "hover:bg-gray-50/60 transition-colors" : "bg-gray-50/30 hover:bg-gray-50/60 transition-colors"}>
                            <td className={`p-0 ${STATUS_STYLE[att.status]?.accent || STATUS_STYLE.expirada.accent}`} style={{ width: "4px", minWidth: "4px" }} />
                            <td className="pl-12 pr-5 py-3">
                              <span className={`text-xs text-gray-400 ${isLatest ? "" : "italic"}`}>
                                {isLatest ? t("table.latestAttempt") : t("table.previousAttempt")}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap" title={fmtDateTime(att.criadoEm)}>
                              {timeAgoFromUTC(att.criadoEm)}
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap">
                              {decisaoDe(att) ? (
                                <span title={timeAgoFromUTC(decisaoDe(att))}>{fmtDateTime(decisaoDe(att))}</span>
                              ) : (
                                <span>{fmtDateTime(att.expiraEm)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <ResponsavelCell sol={att} size="w-5 h-5" />
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={att.status} /></td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <MaquinaChip info={att.maquinaInfo} />
                            </td>
                            <td className="px-4 py-3">
                              {att.status === "aprovada" && (
                                <div className="flex justify-end">
                                  <button onClick={() => setTrackingSol(att)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-colors">
                                    {t("actions.track")}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                }) : visiveis.map((sol) => {
                  const isPendente = sol.status === "pendente";
                  return (
                    <tr key={sol.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className={`p-0 ${STATUS_STYLE[sol.status]?.accent || STATUS_STYLE.expirada.accent}`} style={{ width: "4px", minWidth: "4px" }} />
                      <td className="px-5 py-4">
                        <ClienteCell sol={sol} navigate={navigate} />
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap" title={fmtDateTime(sol.criadoEm)}>
                        {timeAgoFromUTC(sol.criadoEm)}
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap">
                        {isPendente ? (
                          <span title={fmtDateTime(sol.expiraEm)}>{t("table.expiresPrefix", { time: timeUntilUTC(sol.expiraEm) })}</span>
                        ) : decisaoDe(sol) ? (
                          <span title={timeAgoFromUTC(decisaoDe(sol))}>{fmtDateTime(decisaoDe(sol))}</span>
                        ) : (
                          <span>{fmtDateTime(sol.expiraEm)}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <ResponsavelCell sol={sol} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={sol.status} />
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <MaquinaChip info={sol.maquinaInfo} />
                      </td>
                      <td className="px-4 py-4">
                        {isPendente ? (
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => handleRecusar(sol)} disabled={actingId === sol.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors disabled:opacity-50">
                              {t("actions.reject")}
                            </button>
                            <button onClick={() => handleAprovar(sol)} disabled={actingId === sol.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm">
                              {actingId === sol.id ? t("actions.waiting") : t("actions.approve")}
                            </button>
                          </div>
                        ) : sol.status === "aprovada" && (
                          <div className="flex justify-end">
                            <button onClick={() => setTrackingSol(sol)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-colors">
                              {t("actions.track")}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {visiveis.length < itens.length && (
          <div className="flex justify-center py-4 border-t border-gray-100">
            <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
              {t("loadMore.button", { count: itens.length - visiveis.length })}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium border max-w-sm ${
          toast.type === "success" ? "bg-white border-green-200 text-green-800"
          : toast.type === "error" ? "bg-white border-red-200 text-red-800"
          : "bg-white border-gray-200 text-gray-700"
        }`}>
          {toast.text}
        </div>
      )}

      {trackingSol && <EtapasModal sol={trackingSol} onClose={() => setTrackingSol(null)} />}
    </Layout>
  );
}
