import { useState, useEffect, lazy, Suspense } from "react";
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
  { value: "30",  label: "Últimos 30 dias" },
  { value: "90",  label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último ano" },
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
  const [kpis,      setKpis]      = useState(null);
  const [evolucao,  setEvolucao]  = useState([]);
  const [consultor, setConsultor] = useState([]);
  const [produtos,  setProdutos]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      resultadosApi.visaoGeral({ periodo_dias: filtros.periodo, estado: filtros.estado }),
      resultadosApi.evolucao({ meses: 12 }),
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
    ? `${kpis.crescimento_mensal >= 0 ? "+" : ""}${kpis.crescimento_mensal}% vs mês anterior`
    : null;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard loading={loading} label="Total de Clientes"
          value={kpis?.total_clientes}
          color={C.indigo}
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        <KpiCard loading={loading} label="Implantações Concluídas"
          value={kpis?.implantacoes_concluidas}
          color={C.green}
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        <KpiCard loading={loading} label="Em Andamento"
          value={kpis?.implantacoes_andamento}
          color={C.blue}
          icon="M13 10V3L4 14h7v7l9-11h-7z" />
        <KpiCard loading={loading} label="Taxa de Conclusão"
          value={kpis ? `${kpis.taxa_conclusao}%` : null}
          color={C.orange}
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        <KpiCard loading={loading} label="Instalações Concluídas"
          value={kpis?.instalacoes_concluidas}
          color={C.teal}
          icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
        <KpiCard loading={loading} label="Instalações Pendentes"
          value={kpis?.instalacoes_pendentes}
          color={C.amber}
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        <KpiCard loading={loading} label="Implantações Pausadas"
          value={kpis?.implantacoes_pausadas}
          color={C.purple}
          icon="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        <KpiCard loading={loading} label="Crescimento Mensal"
          value={kpis ? `${kpis.crescimento_mensal >= 0 ? "+" : ""}${kpis.crescimento_mensal}%` : null}
          sub={crescStr}
          color={kpis?.crescimento_mensal >= 0 ? C.green : C.red}
          icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </div>

      {/* Gráficos linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Evolução Mensal" loading={loading}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="implantacoes" name="Implantações" stroke={C.indigo} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="instalacoes"  name="Instalações"  stroke={C.orange} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="concluidas"   name="Concluídas"   stroke={C.green}  strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Implantações por Consultor" loading={loading}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={consultor} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="consultor" width={90} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="total"      name="Total"      fill={C.indigo} radius={[0,3,3,0]} />
              <Bar dataKey="concluidas" name="Concluídas" fill={C.green}  radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Gráficos linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Produtos Mais Implantados" loading={loading}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={produtos} dataKey="total" nameKey="produto" cx="50%" cy="50%"
                outerRadius={80} label={({ produto, percent }) => `${produto} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}>
                {produtos.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Concluídas por Mês" loading={loading}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="concluidas" name="Concluídas" fill={C.green} radius={[4,4,0,0]} />
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
          <p className="text-sm text-gray-400">Nenhum dado de equipe no período selecionado.</p>
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
                    <span className="text-[11px] text-gray-400">{m.taxa_conclusao}% conclusão</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 shrink-0">
                  {[
                    { label: "Total", value: m.total,      color: "text-gray-700" },
                    { label: "Concluídas", value: m.concluidas, color: "text-green-600" },
                    { label: "Tempo médio", value: m.tempo_medio_min ? `${m.tempo_medio_min}min` : "—", color: "text-indigo-600" },
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
          <ChartCard title="Instalações por Técnico" loading={false}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={equipe} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total"      name="Total"      fill={C.indigo} radius={[0,3,3,0]} />
                <Bar dataKey="concluidas" name="Concluídas" fill={C.green}  radius={[0,3,3,0]} />
                <Bar dataKey="em_execucao" name="Em execução" fill={C.orange} radius={[0,3,3,0]} />
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
        <ChartCard title="Volume por Produto" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={produtos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="produto" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total"      name="Total"      radius={[4,4,0,0]}>
                {produtos.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Taxa de Conclusão por Produto" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={produtos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="produto" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="taxa_conclusao" name="Taxa (%)" fill={C.green} radius={[4,4,0,0]} />
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
                  <th className="text-left px-5 py-3">Produto</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Concluídas</th>
                  <th className="text-right px-4 py-3">Taxa</th>
                  <th className="text-right px-4 py-3">Tempo médio</th>
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
function AbaRegioes({ filtros }) {
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    resultadosApi.porEstado({ periodo_dias: filtros.periodo })
      .then(r => setEstados(r.data.filter(e => e.estado && e.estado !== "N/A")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtros.periodo]);

  const top10 = estados.slice(0, 10);
  const maxClientes = Math.max(...estados.map(e => e.clientes), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Clientes por Estado (Top 10)" loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="estado" width={36} tick={{ fontSize: 11, fontWeight: 600 }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="clientes" name="Clientes" radius={[0,4,4,0]}>
                {top10.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Implantações + Instalações por Estado (Top 10)" loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="estado" width={36} tick={{ fontSize: 11, fontWeight: 600 }} />
              <Tooltip content={<ChartTip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="implantacoes" name="Implantações" fill={C.indigo}  radius={[0,3,3,0]} />
              <Bar dataKey="instalacoes"  name="Instalações"  fill={C.orange}  radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tabela ranking */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-700">Ranking completo por estado</p>
        </div>
        {loading ? <Skeleton className="h-40 m-4" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Clientes</th>
                  <th className="text-right px-4 py-3">Implantações</th>
                  <th className="text-right px-4 py-3">Instalações</th>
                  <th className="text-right px-4 py-3">Concluídas</th>
                  <th className="px-5 py-3 w-40">Participação</th>
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
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{e.concluidas}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-orange-500 transition-all"
                            style={{ width: `${Math.round(e.clientes / maxClientes * 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-400 w-8 text-right">
                          {Math.round(e.clientes / maxClientes * 100)}%
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
  { key: "visao-geral", label: "Visão Geral",  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "mapa",        label: "Mapa",          icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "equipe",      label: "Equipe",        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "produtos",    label: "Produtos",      icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { key: "regioes",     label: "Regiões",       icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
];

export default function Resultados() {
  const [activeTab,   setActiveTab]   = useState("visao-geral");
  const [filtros,     setFiltros]     = useState({ periodo: "365", estado: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fullscreen,  setFullscreen]  = useState(false);

  function setFiltro(key, val) {
    setFiltros(prev => ({ ...prev, [key]: val }));
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  useEffect(() => {
    function onFsChange() { setFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Resultados</h1>
          <p className="text-sm text-gray-400 mt-0.5">Centro de inteligência operacional</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${filtersOpen ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filtros
            {(filtros.periodo !== "365" || filtros.estado) && (
              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? "Sair da tela cheia" : "Apresentação — tela cheia"}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all bg-white text-gray-600 border-gray-200 hover:border-orange-300"
          >
            {fullscreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M9 15v4.5M9 15H4.5M15 15h4.5M15 15v4.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
            {fullscreen ? "Minimizar" : "Apresentação"}
          </button>
        </div>
      </div>

      {/* Filtros globais */}
      {filtersOpen && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Período</label>
            <select value={filtros.periodo} onChange={e => setFiltro("periodo", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400 transition text-gray-700">
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Estado</label>
            <select value={filtros.estado} onChange={e => setFiltro("estado", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400 transition text-gray-700">
              <option value="">Todos os estados</option>
              {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFiltros({ periodo: "365", estado: "" }); setFiltersOpen(false); }}
              className="w-full text-sm text-gray-400 hover:text-red-500 transition-colors py-2 text-center border border-gray-200 rounded-xl hover:border-red-200">
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
        <div className="flex items-center gap-1 px-3 pt-2 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap mb-1 ${
                activeTab === t.key
                  ? "bg-orange-50 text-orange-600"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                {t.icon.split(" M").map((path, i) => (
                  <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? path : `M${path}`} />
                ))}
              </svg>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da aba */}
      {activeTab === "visao-geral" && <AbaVisaoGeral filtros={filtros} />}
      {activeTab === "mapa"        && (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" /></div>}>
          <MapaTab filtros={filtros} onFiltroChange={setFiltro} />
        </Suspense>
      )}
      {activeTab === "equipe"      && <AbaEquipe       filtros={filtros} />}
      {activeTab === "produtos"    && <AbaProdutos     filtros={filtros} />}
      {activeTab === "regioes"     && <AbaRegioes      filtros={filtros} />}
    </Layout>
  );
}
