import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { Badge } from "../components/ui/Badge";
import { implantacoesApi } from "../services/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function slaRelativo(impl) {
  if (impl.status === "concluida" || impl.status === "cancelada") {
    return { label: fmtDate(impl.sla_limite), level: "done" };
  }
  if (!impl.sla_limite) return null;
  const diff = new Date(impl.sla_limite) - Date.now();
  if (diff < 0) {
    const h = Math.ceil(Math.abs(diff) / 3600000);
    const d = Math.floor(h / 24);
    return { label: d >= 1 ? `Vencido ${d}d` : `Vencido ${h}h`, level: "expired" };
  }
  const totalH = Math.floor(diff / 3600000);
  const d = Math.floor(totalH / 24);
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

// ── Subcomponents ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, onClick }) {
  const palettes = {
    orange: { wrap: "border-orange-100 bg-orange-50", val: "text-orange-600",  sub: "text-orange-400"  },
    red:    { wrap: "border-red-100   bg-red-50",     val: "text-red-600",    sub: "text-red-400"    },
    blue:   { wrap: "border-blue-100  bg-blue-50",    val: "text-blue-600",   sub: "text-blue-400"   },
    green:  { wrap: "border-green-100 bg-green-50",   val: "text-green-600",  sub: "text-green-400"  },
    gray:   { wrap: "border-gray-100  bg-gray-50",    val: "text-gray-500",   sub: "text-gray-400"   },
  };
  const p = palettes[accent] || palettes.gray;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 flex flex-col gap-0.5 ${p.wrap} ${onClick ? "cursor-pointer hover:shadow-sm transition-shadow" : ""}`}
    >
      <span className={`text-2xl font-bold leading-none ${p.val}`}>{value}</span>
      <span className={`text-xs font-semibold mt-1 ${p.val}`}>{label}</span>
      {sub && <span className={`text-[10px] ${p.sub}`}>{sub}</span>}
    </div>
  );
}

function PrioridadePill({ prioridade }) {
  const cfg = {
    baixa:   "bg-gray-100 text-gray-500",
    alta:    "bg-orange-100 text-orange-700",
    critica: "bg-red-100 text-red-700",
  };
  const labels = { baixa: "Baixa", alta: "Alta", critica: "Crítica" };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg[prioridade] || "bg-gray-100 text-gray-500"}`}>
      {labels[prioridade] || prioridade}
    </span>
  );
}

function ProgressBar({ value, status }) {
  const color =
    status === "concluida" ? "bg-green-500" :
    status === "cancelada" ? "bg-gray-300"  :
    value >= 80            ? "bg-blue-500"  :
    value >= 40            ? "bg-orange-400": "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs w-8 text-right shrink-0 font-medium ${value > 0 ? "text-gray-700" : "text-gray-300"}`}>
        {value}%
      </span>
    </div>
  );
}

function ContextBanner({ filterSla, filterHighlight, count, onClear }) {
  if (filterSla === "atrasada") return (
    <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
      <span className="text-lg shrink-0 mt-0.5">🚨</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-red-800">
          {count} implantaç{count !== 1 ? "ões" : "ão"} com SLA vencido
        </p>
        <p className="text-xs text-red-600 mt-0.5">
          Revise os prazos, atualize o status ou negocie nova data com o cliente — ação imediata necessária.
        </p>
      </div>
      <button onClick={onClear} className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap">
        Limpar ✕
      </button>
    </div>
  );
  if (filterSla === "critico") return (
    <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
      <span className="text-lg shrink-0 mt-0.5">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-800">
          {count} implantaç{count !== 1 ? "ões" : "ão"} em risco de SLA
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Menos de 3 dias para vencimento — priorize essas implantações hoje.
        </p>
      </div>
      <button onClick={onClear} className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap">
        Limpar ✕
      </button>
    </div>
  );
  if (filterHighlight === "tarefas") return (
    <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
      <span className="text-lg shrink-0 mt-0.5">📋</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-orange-800">Tarefas com prazo vencido detectadas</p>
        <p className="text-xs text-orange-700 mt-0.5">
          As implantações com SLA mais crítico foram listadas primeiro. Abra cada uma para identificar quais tarefas estão atrasadas e atribuir responsáveis.
        </p>
      </div>
      <button onClick={onClear} className="shrink-0 text-xs font-semibold text-orange-700 hover:text-orange-900 px-2.5 py-1.5 rounded-lg hover:bg-orange-100 transition-colors whitespace-nowrap">
        Fechar ✕
      </button>
    </div>
  );
  return null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "",             label: "Todas"        },
  { key: "em_andamento", label: "Em Andamento" },
  { key: "pausada",      label: "Pausadas"     },
  { key: "concluida",    label: "Concluídas"   },
  { key: "cancelada",    label: "Canceladas"   },
];

const SLA_FILTERS = [
  { key: "",         label: "Qualquer SLA" },
  { key: "atrasada", label: "🔴 Atrasadas" },
  { key: "critico",  label: "🟡 Crítico"   },
  { key: "ok",       label: "🟢 No Prazo"  },
];

const PRIORIDADE_FILTERS = [
  { key: "",        label: "Qualquer Prioridade" },
  { key: "critica", label: "Crítica"             },
  { key: "alta",    label: "Alta"                },
  { key: "normal",  label: "Normal"              },
  { key: "baixa",   label: "Baixa"               },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Implantacoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]  = useState("");

  const filterStatus     = searchParams.get("status")     || "";
  const filterSla        = searchParams.get("sla_status") || "";
  const filterPrioridade = searchParams.get("prioridade") || "";
  const filterHighlight  = searchParams.get("highlight")  || "";

  function setParam(key, value) {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p, { replace: true });
  }

  // Load all — filter client-side so KPIs and badges are always accurate
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await implantacoesApi.listar({});
      setItems(data);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpiEmAndamento = items.filter((i) => i.status === "em_andamento").length;
  const kpiSlaVencido  = items.filter((i) => i.sla_status === "atrasada").length;
  const kpiConversao   = items.filter((i) => i.conversao_dados).length;
  const kpiConcluidas  = items.filter((i) => i.status === "concluida").length;

  // ── Tab counts ─────────────────────────────────────────────────────────────
  const tabCount = (key) =>
    key === "" ? items.length : items.filter((i) => i.status === key).length;

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = items.filter((i) => {
    if (filterStatus     && i.status      !== filterStatus)     return false;
    if (filterSla        && i.sla_status  !== filterSla)        return false;
    if (filterPrioridade && i.prioridade  !== filterPrioridade) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !i.nome.toLowerCase().includes(q) &&
        !i.codigo.toLowerCase().includes(q) &&
        !(i.cliente_nome || "").toLowerCase().includes(q) &&
        !(i.cliente_cnpj || "").includes(q)
      ) return false;
    }
    return true;
  });

  const hasActiveFilters = filterStatus || filterSla || filterPrioridade;

  // When arriving from dashboard "Tarefas Vencidas", sort overdue items first
  const displayList = filterHighlight === "tarefas"
    ? [...filtered].sort((a, b) => {
        const order = { atrasada: 0, critico: 1, em_risco: 2 };
        return (order[a.sla_status] ?? 9) - (order[b.sla_status] ?? 9);
      })
    : filtered;

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Implantações</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {filtered.length !== items.length
            ? `${filtered.length} de ${items.length} implantações`
            : `${items.length} implantaç${items.length !== 1 ? "ões" : "ão"}`}
        </p>
      </div>

      {/* Context banner (when arriving from dashboard with a filter/highlight) */}
      {(filterSla === "atrasada" || filterSla === "critico" || filterHighlight === "tarefas") && (
        <div className="mb-4">
          <ContextBanner
            filterSla={filterSla}
            filterHighlight={filterHighlight}
            count={filtered.length}
            onClear={() => {
              const p = new URLSearchParams(searchParams);
              p.delete("sla_status");
              p.delete("highlight");
              setSearchParams(p, { replace: true });
            }}
          />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard
          label="Em Andamento"
          value={kpiEmAndamento}
          accent="orange"
          onClick={() => setParam("status", filterStatus === "em_andamento" ? "" : "em_andamento")}
        />
        <KpiCard
          label="SLA Vencido"
          value={kpiSlaVencido}
          sub={kpiSlaVencido > 0 ? "requer atenção" : "tudo no prazo"}
          accent={kpiSlaVencido > 0 ? "red" : "gray"}
          onClick={kpiSlaVencido > 0 ? () => setParam("sla_status", filterSla === "atrasada" ? "" : "atrasada") : undefined}
        />
        <KpiCard
          label="Com Conversão"
          value={kpiConversao}
          sub="de dados"
          accent={kpiConversao > 0 ? "blue" : "gray"}
        />
        <KpiCard
          label="Concluídas"
          value={kpiConcluidas}
          accent="green"
          onClick={() => setParam("status", filterStatus === "concluida" ? "" : "concluida")}
        />
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {STATUS_TABS.map((t) => {
            const cnt = tabCount(t.key);
            return (
              <button
                key={t.key}
                onClick={() => setParam("status", t.key)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  filterStatus === t.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  filterStatus === t.key
                    ? "bg-orange-100 text-orange-600"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterSla}
            onChange={(e) => setParam("sla_status", e.target.value)}
            className={`text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition ${
              filterSla ? "border-orange-400 text-orange-700 bg-orange-50" : "border-gray-200 text-gray-600 bg-white"
            }`}
          >
            {SLA_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>

          <select
            value={filterPrioridade}
            onChange={(e) => setParam("prioridade", e.target.value)}
            className={`text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition ${
              filterPrioridade ? "border-orange-400 text-orange-700 bg-orange-50" : "border-gray-200 text-gray-600 bg-white"
            }`}
          >
            {PRIORIDADE_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar empresa, código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition bg-white"
            />
          </div>

          {(hasActiveFilters || search) && (
            <button
              onClick={() => { setSearchParams({}); setSearch(""); }}
              className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
            >
              Limpar ✕
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">⚙️</p>
            <p className="text-sm font-medium text-gray-700">Nenhuma implantação encontrada</p>
            <p className="text-xs text-gray-400 mt-1">
              {search || hasActiveFilters
                ? "Tente ajustar os filtros."
                : "As implantações são criadas ao aprovar uma solicitação na Triagem."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="p-0 w-1" />
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 min-w-[150px]">Progresso</th>
                  <th className="px-6 py-3">Consultor</th>
                  <th className="px-6 py-3">SLA</th>
                  <th className="px-2 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayList.map((impl) => {
                  const sla = slaRelativo(impl);
                  const isAtrasada = impl.sla_status === "atrasada";
                  const isCritico  = impl.sla_status === "critico";

                  const stripeColor =
                    sla?.level === "expired" ? "bg-red-500" :
                    sla?.level === "urgent"  ? "bg-amber-500" :
                    sla?.level === "warning" ? "bg-yellow-400" :
                    sla?.level === "ok"      ? "bg-green-400" :
                    "bg-gray-200";

                  return (
                    <tr
                      key={impl.id}
                      onClick={() => navigate(`/admin/implantacoes/${impl.id}`)}
                      className={`cursor-pointer group transition-colors ${
                        isAtrasada ? "bg-red-50/50 hover:bg-red-50/80" :
                        isCritico  ? "bg-amber-50/40 hover:bg-amber-50/70" :
                        "hover:bg-orange-50/40"
                      }`}
                    >
                      {/* Urgency stripe — always visible, colored by SLA level */}
                      <td className={`p-0 ${stripeColor}`} style={{ width: "4px", minWidth: "4px" }}></td>

                      {/* Cliente — código + nome + cnpj + tags */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {impl.codigo}
                          </span>
                          {impl.prioridade !== "normal" && (
                            <PrioridadePill prioridade={impl.prioridade} />
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 leading-tight">{impl.cliente_nome}</p>
                        <p className="text-xs font-mono text-gray-400 mt-0.5">{impl.cliente_cnpj}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {isAtrasada && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse shrink-0" />
                              SLA VENCIDO
                            </span>
                          )}
                          {isCritico && !isAtrasada && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-white">
                              ⚠ EM RISCO
                            </span>
                          )}
                          {(impl.tarefas_vencidas ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                              <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {impl.tarefas_vencidas} tarefa{impl.tarefas_vencidas > 1 ? "s" : ""} vencida{impl.tarefas_vencidas > 1 ? "s" : ""}
                            </span>
                          )}
                          {impl.conversao_dados && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h7" />
                              </svg>
                              Conversão de dados
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <Badge status={impl.status} />
                      </td>

                      {/* Progresso */}
                      <td className="px-6 py-4 min-w-[150px]">
                        <ProgressBar value={impl.progresso} status={impl.status} />
                      </td>

                      {/* Consultor */}
                      <td className="px-6 py-4 text-gray-600 text-sm whitespace-nowrap">
                        {impl.consultor || <span className="text-gray-300">—</span>}
                      </td>

                      {/* SLA */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sla ? (
                          sla.level === "done" ? (
                            <span className="text-xs text-gray-400">{sla.label}</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-semibold border ${SLA_PILL[sla.level]}`}>
                              {sla.level === "expired" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                              )}
                              {sla.label}
                            </span>
                          )
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Chevron */}
                      <td className="px-3 py-4">
                        <svg className="w-4 h-4 text-gray-200 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
