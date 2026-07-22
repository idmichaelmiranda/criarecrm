import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { solicitacoesInstaladorApi } from "../services/api";
import { fmtDateTime, timeAgoFromUTC, parseUTC } from "../utils/dateUtils";

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

function ResponsavelCell({ sol, size }) {
  if (!sol.responsavelNome) return <span className="text-gray-300 text-sm">—</span>;
  return (
    <div className="flex items-center gap-2">
      <Avatar nome={sol.responsavelNome} avatarUrl={sol.responsavelAvatarUrl} size={size} />
      <span className="text-sm text-gray-600 truncate max-w-[120px]">{sol.responsavelNome}</span>
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
                  <th className="px-4 py-3 w-52" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agrupar ? visiveis.map((grupo) => {
                  const sol = grupo.ultima;
                  const aberto = expandidos.has(grupo.cnpj);
                  const temAnteriores = grupo.anteriores.length > 0;
                  return (
                    <Fragment key={grupo.cnpj}>
                      <tr
                        onClick={() => temAnteriores && toggleExpandido(grupo.cnpj)}
                        className={`hover:bg-gray-50/60 transition-colors ${temAnteriores ? "cursor-pointer" : ""}`}
                      >
                        <td className={`p-0 ${STATUS_STYLE[sol.status]?.accent || STATUS_STYLE.expirada.accent}`} style={{ width: "4px", minWidth: "4px" }} />
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 transition-transform ${aberto ? "rotate-90" : ""} ${temAnteriores ? "" : "invisible"}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                            <ClienteCell sol={sol} navigate={navigate} />
                          </div>
                        </td>
                        <td className="px-4 py-4 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap" title={fmtDateTime(sol.criadoEm)}>
                          {timeAgoFromUTC(sol.criadoEm)}
                        </td>
                        <td className="px-4 py-4 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap">
                          {decisaoDe(sol) ? (
                            <span title={timeAgoFromUTC(decisaoDe(sol))}>{fmtDateTime(decisaoDe(sol))}</span>
                          ) : (
                            <span>{fmtDateTime(sol.expiraEm)}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 hidden md:table-cell">
                          <ResponsavelCell sol={sol} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={sol.status} />
                            {temAnteriores && (
                              <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap">
                                {t("group.previousCount", { count: grupo.anteriores.length })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4" />
                      </tr>
                      {aberto && grupo.anteriores.map((prev) => (
                        <tr key={prev.id} className="bg-gray-50/60">
                          <td className="p-0" style={{ width: "4px", minWidth: "4px" }} />
                          <td className="pl-14 pr-5 py-2.5">
                            <span className="text-xs text-gray-400 italic">{t("table.previousAttempt")}</span>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap" title={fmtDateTime(prev.criadoEm)}>
                            {timeAgoFromUTC(prev.criadoEm)}
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap">
                            {decisaoDe(prev) ? fmtDateTime(decisaoDe(prev)) : fmtDateTime(prev.expiraEm)}
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <ResponsavelCell sol={prev} size="w-5 h-5" />
                          </td>
                          <td className="px-4 py-2.5"><StatusBadge status={prev.status} /></td>
                          <td className="px-4 py-2.5" />
                        </tr>
                      ))}
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
                          <span title={fmtDateTime(sol.expiraEm)}>{t("table.expiresPrefix", { time: timeAgoFromUTC(sol.expiraEm) })}</span>
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
                      <td className="px-4 py-4">
                        {isPendente && (
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
    </Layout>
  );
}
