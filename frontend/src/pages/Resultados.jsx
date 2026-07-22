import { useState, useEffect, lazy, Suspense, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { usePresentationMode } from "../contexts/PresentationContext";
import { Layout } from "../components/layout/Layout";
import { resultadosApi } from "../services/api";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

// Leaflet carregado somente quando o usuário abre a aba Mapa.
// Se o chunk não existir (build novo, cache antigo), recarrega a página automaticamente.
const MapaTab = lazy(() =>
  import("./ResultadosMapaTab").catch(() => {
    window.location.reload();
    return new Promise(() => {});
  })
);

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  orange: "#F56316", indigo: "#6366f1", green: "#10b981",
  blue: "#3b82f6", amber: "#f59e0b", red: "#ef4444",
  purple: "#8b5cf6", teal: "#14b8a6", pink: "#ec4899",
};
const CHART_COLORS = [C.orange, C.indigo, C.green, C.blue, C.amber, C.purple, C.teal, C.pink];

const STATUS_MAP_COLOR = {
  concluida:   "#10b981",
  em_andamento: "#3b82f6",
  pausada:     "#f59e0b",
  cancelada:   "#6b7280",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = C.orange, icon, loading }) {
  if (loading) return <Skeleton className="h-28" />;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-black text-gray-900 leading-none">{value ?? "—"}</p>
        {sub != null && (
          <p className={`text-xs mt-1 font-medium ${typeof sub === "string" && sub.startsWith("+") ? "text-green-600" : "text-gray-400"}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tooltip customizado ───────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-xl p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Chart Card wrapper ────────────────────────────────────────────────────────
function ChartCard({ title, children, loading, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <p className="text-sm font-bold text-gray-700 mb-4">{title}</p>
      {loading ? <Skeleton className="h-52" /> : children}
    </div>
  );
}

// ── Período options ───────────────────────────────────────────────────────────
const PERIODOS = [
  { value: "30"  },
  { value: "90"  },
  { value: "180" },
  { value: "365" },
];

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
  "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
  "RO","RR","RS","SC","SE","SP","TO",
];

// ═══════════════════════════════════════════════════════════════════════════════
// ABA 1 — VISÃO GERAL
// ═══════════════════════════════════════════════════════════════════════════════
function AbaVisaoGeral({ filtros }) {
  const { t } = useTranslation("resultados");
  const [kpis,      setKpis]      = useState(null);
  const [evolucao,  setEvolucao]  = useState([]);
  const [consultor, setConsultor] = useState([]);
  const [produtos,  setProdutos]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      resultadosApi.visaoGeral({ periodo_dias: filtros.periodo, estado: filtros.estado }),
      resultadosApi.evolucao({ periodo_dias: filtros.periodo, estado: filtros.estado }),
      resultadosApi.porConsultor({ periodo_dias: filtros.periodo }),
      resultadosApi.produtos({ periodo_dias: filtros.periodo }),
    ])
      .then(([k, e, c, p]) => {
        setKpis(k.data);
        setEvolucao(e.data);
        setConsultor(c.data.slice(0, 8));
        setProdutos(p.data.slice(0, 6));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtros.periodo, filtros.estado]);

  const crescStr = kpis
    ? t("visaoGeral.kpis.crescimentoSub", { value: `${kpis.crescimento_mensal >= 0 ? "+" : ""}${kpis.crescimento_mensal}` })
    : null;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard loading={loading} label={t("visaoGeral.kpis.totalClientes")}
          value={kpis?.total_clientes}
          color={C.indigo}
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        <KpiCard loading={loading} label={t("visaoGeral.kpis.implantacoesConcluidas")}
          value={kpis?.implantacoes_concluidas}
          color={C.green}
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        <KpiCard loading={loading} label={t("visaoGeral.kpis.emAndamento")}
          value={kpis?.implantacoes_andamento}
          color={C.blue}
          icon="M13 10V3L4 14h7v7l9-11h-7z" />
        <KpiCard loading={loading} label={t("visaoGeral.kpis.taxaConclusao")}
          value={kpis ? `${kpis.taxa_conclusao}%` : null}
          color={C.orange}
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        <KpiCard loading={loading} label={t("visaoGeral.kpis.instalacoesConcluidas")}
          value={kpis?.instalacoes_concluidas}
          color={C.teal}
          icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
        <KpiCard loading={loading} label={t("visaoGeral.kpis.instalacoesPendentes")}
          value={kpis?.instalacoes_pendentes}
          color={C.amber}
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        <KpiCard loading={loading} label={t("visaoGeral.kpis.implantacoesPausadas")}
          value={kpis?.implantacoes_pausadas}
          color={C.purple}
          icon="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        <KpiCard loading={loading} label={t("visaoGeral.kpis.crescimentoMensal")}
          value={kpis ? `${kpis.crescimento_mensal >= 0 ? "+" : ""}${kpis.crescimento_mensal}%` : null}
          sub={crescStr}
          color={kpis?.crescimento_mensal >= 0 ? C.green : C.red}
          icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </div>

      {/* Gráficos linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t("visaoGeral.charts.novosPorMes")} loading={loading}>
          <p className="text-[10px] text-gray-400 -mt-2 mb-3">{t("visaoGeral.charts.novosPorMesDesc")}</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
              <Tooltip content={<ChartTip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="implantacoes" name={t("visaoGeral.charts.seriesImplantacoes")} stroke={C.indigo} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="instalacoes"  name={t("visaoGeral.charts.seriesInstalacoes")}  stroke={C.orange} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("visaoGeral.charts.concluidasPorMes")} loading={loading}>
          <p className="text-[10px] text-gray-400 -mt-2 mb-3">{t("visaoGeral.charts.concluidasPorMesDesc")}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
              <Tooltip content={<ChartTip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="impl_concluidas" name={t("visaoGeral.charts.seriesImplantacoes")} stackId="a" fill={C.indigo} />
              <Bar dataKey="inst_concluidas" name={t("visaoGeral.charts.seriesInstalacoes")}  stackId="a" fill={C.teal} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Gráficos linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t("visaoGeral.charts.produtosMaisImplantados")} loading={loading}>
          {/* height=270 + cy="47%" garante margem >= 32px no topo e na base para todos os labels */}
          <ResponsiveContainer width="100%" height={270}>
            <PieChart>
              <Pie
                data={produtos} dataKey="total" nameKey="produto"
                cx="50%" cy="47%" outerRadius={70}
                label={({ cx, cy, midAngle, outerRadius, percent }) => {
                  if (percent < 0.04) return null;
                  const R = Math.PI / 180;
                  const r = outerRadius + 24;
                  const x = cx + r * Math.cos(-midAngle * R);
                  const y = cy + r * Math.sin(-midAngle * R);
                  return (
                    <text x={x} y={y} fill="#374151" fontSize={11} fontWeight={700}
                      textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
                labelLine={{ stroke: "#d1d5db", strokeWidth: 1 }}>
                {produtos.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
              <Legend iconType="circle" iconSize={8}
                formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("visaoGeral.charts.implantacoesPorConsultor")} loading={loading}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={consultor} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="consultor" width={90} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="total"      name={t("visaoGeral.charts.seriesTotal")}      fill={C.indigo} radius={[0,3,3,0]} />
              <Bar dataKey="concluidas" name={t("visaoGeral.charts.seriesConcluidas")} fill={C.green}  radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// MapaTab (aba 2) é lazy-loaded via React.lazy — Leaflet só carrega ao abrir a aba

// ═══════════════════════════════════════════════════════════════════════════════
// ABA 3 — EQUIPE
// ═══════════════════════════════════════════════════════════════════════════════
function AbaEquipe({ filtros }) {
  const { t } = useTranslation("resultados");
  const [equipe,  setEquipe]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    resultadosApi.equipe({ periodo_dias: filtros.periodo })
      .then(r => setEquipe(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtros.periodo]);

  const medalhas = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : equipe.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-sm text-gray-400">{t("equipe.empty")}</p>
        </div>
      ) : (
        <>
          {/* Leaderboard */}
          <div className="grid grid-cols-1 gap-3">
            {equipe.map((m, idx) => (
              <div key={m.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow ${idx === 0 ? "border-amber-200 bg-amber-50/30" : "border-gray-100"}`}>
                <span className="text-2xl w-8 text-center shrink-0">{medalhas[idx] || `#${idx + 1}`}</span>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {(m.nome || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{m.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[120px]">
                      <div className="h-1.5 rounded-full bg-orange-500 transition-all"
                        style={{ width: `${m.taxa_conclusao}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-400">{t("equipe.conclusion", { value: m.taxa_conclusao })}</span>
                  </div>
                  {(m.como_colaborador > 0) && (
                    <div className="flex items-center gap-2 mt-1">
                      {m.como_principal > 0 && (
                        <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                          {t("equipe.principal", { count: m.como_principal })}
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">
                        {t("equipe.colaborador", { count: m.como_colaborador })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 shrink-0">
                  {[
                    { label: t("equipe.stats.total"), value: m.total,      color: "text-gray-700" },
                    { label: t("equipe.stats.concluidas"), value: m.concluidas, color: "text-green-600" },
                    { label: t("equipe.stats.tempoMedio"), value: m.tempo_medio_min ? `${m.tempo_medio_min}min` : "—", color: "text-indigo-600" },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          <ChartCard title={t("equipe.chartTitle")} loading={false}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={equipe} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total"      name={t("equipe.seriesTotal")}      fill={C.indigo} radius={[0,3,3,0]} />
                <Bar dataKey="concluidas" name={t("equipe.seriesConcluidas")} fill={C.green}  radius={[0,3,3,0]} />
                <Bar dataKey="em_execucao" name={t("equipe.seriesEmExecucao")} fill={C.orange} radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA 4 — PRODUTOS
// ═══════════════════════════════════════════════════════════════════════════════
function AbaProdutos({ filtros }) {
  const { t } = useTranslation("resultados");
  const [produtos, setProdutos] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    resultadosApi.produtos({ periodo_dias: filtros.periodo })
      .then(r => setProdutos(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtros.periodo]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t("produtos.volumePorProduto")} loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={produtos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="produto" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total"      name={t("produtos.seriesTotal")}      radius={[4,4,0,0]}>
                {produtos.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("produtos.taxaConclusaoPorProduto")} loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={produtos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="produto" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="taxa_conclusao" name={t("produtos.seriesTaxa")} fill={C.green} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? <Skeleton className="h-40 m-4" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">{t("produtos.table.produto")}</th>
                  <th className="text-right px-4 py-3">{t("produtos.table.total")}</th>
                  <th className="text-right px-4 py-3">{t("produtos.table.concluidas")}</th>
                  <th className="text-right px-4 py-3">{t("produtos.table.taxa")}</th>
                  <th className="text-right px-4 py-3">{t("produtos.table.tempoMedio")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {produtos.map((p, i) => (
                  <tr key={p.produto} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="font-medium text-gray-800">{p.produto}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-700">{p.total}</td>
                    <td className="px-4 py-3.5 text-right text-green-600 font-semibold">{p.concluidas}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.taxa_conclusao >= 80 ? "bg-green-50 text-green-700" : p.taxa_conclusao >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                        {p.taxa_conclusao}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-gray-500">
                      {p.tempo_medio_min ? `${p.tempo_medio_min} min` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA 5 — REGIÕES
// ═══════════════════════════════════════════════════════════════════════════════
function TaxaBadge({ taxa }) {
  const cor = taxa >= 80 ? "bg-green-100 text-green-700" : taxa >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
  return <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${cor}`}>{taxa}%</span>;
}

function AbaRegioes({ filtros }) {
  const { t } = useTranslation("resultados");
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    resultadosApi.porEstado({ periodo_dias: filtros.periodo })
      .then(r => setEstados(r.data.filter(e => e.estado && e.estado !== "N/A")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtros.periodo, filtros.estado]);

  const top10 = estados.slice(0, 10);
  const maxTotal = Math.max(...estados.map(e => e.total ?? 0), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t("regioes.clientesPorEstado")} loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="estado" width={36} tick={{ fontSize: 11, fontWeight: 600 }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="clientes" name={t("regioes.seriesClientes")} radius={[0,4,4,0]}>
                {top10.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("regioes.volumeConclusoes")} loading={loading}>
          <p className="text-[10px] text-gray-400 -mt-2 mb-3">{t("regioes.volumeConclusoesDesc")}</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="estado" width={36} tick={{ fontSize: 11, fontWeight: 600 }} />
              <Tooltip content={<ChartTip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total"      name={t("regioes.seriesTotalAtivas")} fill={C.indigo} radius={[0,3,3,0]} opacity={0.4} />
              <Bar dataKey="concluidas" name={t("regioes.seriesConcluidas")}     fill={C.green}  radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tabela ranking */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-700">{t("regioes.rankingTitle")}</p>
          <p className="text-[11px] text-gray-400">{t("regioes.rankingSubtitle")}</p>
        </div>
        {loading ? <Skeleton className="h-40 m-4" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">{t("regioes.table.estado")}</th>
                  <th className="text-right px-4 py-3">{t("regioes.table.clientes")}</th>
                  <th className="text-right px-4 py-3">{t("regioes.table.implantacoes")}</th>
                  <th className="text-right px-4 py-3">{t("regioes.table.instalacoes")}</th>
                  <th className="text-right px-4 py-3">{t("regioes.table.concluidas")}</th>
                  <th className="text-right px-4 py-3">{t("regioes.table.taxa")}</th>
                  <th className="px-5 py-3 w-40">{t("regioes.table.participacao")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {estados.map((e, i) => (
                  <tr key={e.estado} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 w-5">{i + 1}.</span>
                        <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-xs">{e.estado}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{e.clientes}</td>
                    <td className="px-4 py-3 text-right text-indigo-600 font-medium">{e.implantacoes}</td>
                    <td className="px-4 py-3 text-right text-orange-500 font-medium">{e.instalacoes}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-bold">{e.concluidas}</td>
                    <td className="px-4 py-3 text-right">
                      {e.total > 0 ? <TaxaBadge taxa={e.taxa_conclusao} /> : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-orange-500 transition-all"
                            style={{ width: `${Math.round((e.total ?? 0) / maxTotal * 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-400 w-8 text-right">
                          {Math.round((e.total ?? 0) / maxTotal * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: "visao-geral", labelKey: "visaoGeral", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "mapa",        labelKey: "mapa",       icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "equipe",      labelKey: "equipe",     icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "produtos",    labelKey: "produtos",   icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { key: "regioes",     labelKey: "regioes",    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
];

// ── HUD flutuante do modo apresentação ────────────────────────────────────────
function PresentationHUD({ activeTab, onChangeTab, filtros, onExit }) {
  const { t: tr } = useTranslation("resultados");
  const [escVisible, setEscVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setEscVisible(false), 3000);
    return () => clearTimeout(id);
  }, []);

  const tabIdx       = TABS.findIndex(t => t.key === activeTab);
  const prevTab      = TABS[(tabIdx - 1 + TABS.length) % TABS.length];
  const nextTab      = TABS[(tabIdx + 1) % TABS.length];
  const periodoValido = PERIODOS.some(p => p.value === filtros.periodo);
  const periodoLabel = periodoValido ? tr(`periods.${filtros.periodo}`) : "";
  const filtroTexto  = `${periodoLabel}${filtros.estado ? ` · ${filtros.estado}` : tr("presentationHud.allBrazil")}`;

  return createPortal(
    <>
      {/* Badge filtro + botão Sair — canto superior direito */}
      <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2">
        <div className="bg-black/50 text-white/90 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm font-medium pointer-events-none select-none">
          {filtroTexto}
        </div>
        <button onClick={onExit}
          className="bg-black/50 text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors font-medium">
          {tr("presentationHud.exit")}
        </button>
      </div>

      {/* Dica ESC — fade após 3s */}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-black/50 text-white/70 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none select-none transition-opacity duration-700"
        style={{ opacity: escVisible ? 1 : 0 }}
      >
        {tr("presentationHud.navigateHint")}
      </div>

      {/* HUD de navegação — rodapé centralizado */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-2xl select-none">
        <button onClick={() => onChangeTab(prevTab.key)}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="max-w-[90px] truncate">{tr(`tabs.${prevTab.labelKey}`)}</span>
        </button>

        <div className="h-4 w-px bg-white/20 shrink-0" />

        <div className="flex items-center gap-1.5">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => onChangeTab(tab.key)} title={tr(`tabs.${tab.labelKey}`)}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{ width: tab.key === activeTab ? "20px" : "6px", background: tab.key === activeTab ? "#f97316" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>

        <div className="h-4 w-px bg-white/20 shrink-0" />

        <span className="text-xs font-semibold text-orange-300 min-w-[80px] text-center">
          {tr(`tabs.${TABS[tabIdx].labelKey}`)}
        </span>

        <span className="text-[11px] text-white/40 tabular-nums shrink-0">
          {tabIdx + 1} / {TABS.length}
        </span>

        <div className="h-4 w-px bg-white/20 shrink-0" />

        <button onClick={() => onChangeTab(nextTab.key)}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
          <span className="max-w-[90px] truncate">{tr(`tabs.${nextTab.labelKey}`)}</span>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>,
    document.body
  );
}

export default function Resultados() {
  const { t } = useTranslation("resultados");
  const { setOn: setPresentationCtx } = usePresentationMode();
  const [activeTab,        setActiveTab]        = useState("visao-geral");
  const [filtros,          setFiltros]          = useState({ periodo: "365", estado: "" });
  const [filtersOpen,      setFiltersOpen]      = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [tabVisible,       setTabVisible]       = useState(true);
  const fadeRef     = useRef(null);
  const activeTabRef = useRef(activeTab);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  function setFiltro(key, val) {
    setFiltros(prev => ({ ...prev, [key]: val }));
  }

  const changeTab = useCallback((key) => {
    if (fadeRef.current) clearTimeout(fadeRef.current);
    setTabVisible(false);
    fadeRef.current = setTimeout(() => {
      setActiveTab(key);
      setTabVisible(true);
    }, 110);
  }, []);

  function togglePresentation() {
    if (!presentationMode) {
      setPresentationMode(true);
      setPresentationCtx(true);
      document.documentElement.requestFullscreen().catch(() => {
        setPresentationMode(false);
        setPresentationCtx(false);
      });
    } else {
      setPresentationMode(false);
      setPresentationCtx(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  }

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) {
        setPresentationMode(false);
        setPresentationCtx(false);
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [setPresentationCtx]);

  useEffect(() => {
    if (!presentationMode) return;
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      const idx = TABS.findIndex(t => t.key === activeTabRef.current);
      if (e.key === "ArrowRight") { e.preventDefault(); changeTab(TABS[(idx + 1) % TABS.length].key); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); changeTab(TABS[(idx - 1 + TABS.length) % TABS.length].key); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presentationMode, changeTab]);

  return (
    <Layout>
      {/* Header — oculto em modo apresentação */}
      {!presentationMode && <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t("header.title")}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t("header.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${filtersOpen ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {t("header.filters")}
            {(filtros.periodo !== "365" || filtros.estado) && (
              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
            )}
          </button>
          <button
            onClick={togglePresentation}
            title={presentationMode ? t("header.presentationExit") : t("header.presentationEnter")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all bg-white text-gray-600 border-gray-200 hover:border-orange-300"
          >
            {presentationMode ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M9 15v4.5M9 15H4.5M15 15h4.5M15 15v4.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
            {presentationMode ? t("header.presentationMinimize") : t("header.presentation")}
          </button>
        </div>
      </div>}

      {/* Filtros globais */}
      {!presentationMode && filtersOpen && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t("filtersPanel.period")}</label>
            <select value={filtros.periodo} onChange={e => setFiltro("periodo", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400 transition text-gray-700">
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{t(`periods.${p.value}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t("filtersPanel.state")}</label>
            <select value={filtros.estado} onChange={e => setFiltro("estado", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400 transition text-gray-700">
              <option value="">{t("filtersPanel.allStates")}</option>
              {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFiltros({ periodo: "365", estado: "" }); setFiltersOpen(false); }}
              className="w-full text-sm text-gray-400 hover:text-red-500 transition-colors py-2 text-center border border-gray-200 rounded-xl hover:border-red-200">
              {t("header.clearFilters")}
            </button>
          </div>
        </div>
      )}

      {/* Tabs — ocultas em modo apresentação */}
      {!presentationMode && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
        <div className="flex items-center gap-1 px-3 pt-2 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => changeTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap mb-1 ${
                activeTab === tab.key
                  ? "bg-orange-50 text-orange-600"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                {tab.icon.split(" M").map((path, i) => (
                  <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? path : `M${path}`} />
                ))}
              </svg>
              {t(`tabs.${tab.labelKey}`)}
            </button>
          ))}
        </div>
      </div>}

      {/* Conteúdo da aba com fade */}
      <div
        style={{ opacity: tabVisible ? 1 : 0, transition: "opacity 0.11s ease" }}
        className={presentationMode && activeTab !== "mapa" ? "p-6 pb-24" : ""}
      >
        {activeTab === "visao-geral" && <AbaVisaoGeral filtros={filtros} />}
        {activeTab === "mapa"        && (
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" /></div>}>
            <MapaTab filtros={filtros} onFiltroChange={setFiltro} presentationMode={presentationMode} />
          </Suspense>
        )}
        {activeTab === "equipe"      && <AbaEquipe       filtros={filtros} />}
        {activeTab === "produtos"    && <AbaProdutos     filtros={filtros} />}
        {activeTab === "regioes"     && <AbaRegioes      filtros={filtros} />}
      </div>

      {/* HUD de apresentação */}
      {presentationMode && (
        <PresentationHUD
          activeTab={activeTab}
          onChangeTab={changeTab}
          filtros={filtros}
          onExit={togglePresentation}
        />
      )}
    </Layout>
  );
}
