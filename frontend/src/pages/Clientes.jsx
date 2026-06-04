import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { LoadingSpinner, EmptyState } from "../components/ui/LoadingSpinner";
import { useClientes } from "../hooks/useClientes";
import { fmtDate } from "../utils/dateUtils";

// ── Paleta de cores para avatares ─────────────────────────────────────────────
const PALETTE = [
  ["bg-orange-500",  "text-white"],
  ["bg-violet-500",  "text-white"],
  ["bg-blue-500",    "text-white"],
  ["bg-teal-500",    "text-white"],
  ["bg-pink-500",    "text-white"],
  ["bg-indigo-500",  "text-white"],
  ["bg-emerald-500", "text-white"],
  ["bg-rose-500",    "text-white"],
];
function avatarColor(name) {
  return PALETTE[(name?.charCodeAt(0) || 0) % PALETTE.length];
}

function formatCnpj(cnpj) {
  if (!cnpj) return cnpj;
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function isStubEmail(email) {
  return !email || email.includes("@erp.local") || email.startsWith("erp_");
}

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Componentes base ──────────────────────────────────────────────────────────
function Avatar({ name }) {
  const [bg, fg] = avatarColor(name);
  return (
    <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center shrink-0 shadow-sm`}>
      <span className={`font-bold text-sm ${fg}`}>{(name || "?").charAt(0).toUpperCase()}</span>
    </div>
  );
}

function SortIcon({ active, dir }) {
  return (
    <svg className={`inline w-3 h-3 ml-1 transition-colors ${active ? "text-orange-500" : "text-gray-300"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      {dir === "asc" && active
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />}
    </svg>
  );
}

const REGIME_CFG = {
  "1": { label: "Simples Nacional", cls: "bg-green-50  text-green-700  border-green-200",  dot: "bg-green-500"  },
  "2": { label: "Lucro Presumido",  cls: "bg-blue-50   text-blue-700   border-blue-200",   dot: "bg-blue-500"   },
  "3": { label: "Lucro Real",       cls: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
};

function RegimeBadge({ regime }) {
  const cfg = REGIME_CFG[String(regime)];
  if (!cfg) return <span className="text-gray-300 text-sm">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }) {
  const colors = {
    orange:  { bg: "bg-orange-50",  icon: "bg-orange-100 text-orange-600",  val: "text-orange-600"  },
    green:   { bg: "bg-green-50",   icon: "bg-green-100  text-green-600",   val: "text-green-600"   },
    gray:    { bg: "bg-gray-50",    icon: "bg-gray-100   text-gray-500",    val: "text-gray-600"    },
    violet:  { bg: "bg-violet-50",  icon: "bg-violet-100 text-violet-600",  val: "text-violet-600"  },
    blue:    { bg: "bg-blue-50",    icon: "bg-blue-100   text-blue-600",    val: "text-blue-600"    },
  };
  const c = colors[color] || colors.gray;
  return (
    <div className={`${c.bg} rounded-2xl border border-white px-4 py-3.5 flex items-center gap-3 shadow-sm`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-bold leading-none ${c.val}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Linha de cliente ──────────────────────────────────────────────────────────
function ClienteRow({ c, onClick }) {
  const [copying, setCopying] = useState(false);

  const cidade    = c.endereco?.cidade ? toTitleCase(c.endereco.cidade) : null;
  const estado    = c.endereco?.estado?.toUpperCase() || null;
  const local     = cidade && estado ? `${cidade} / ${estado}` : cidade || estado || null;
  const regime    = c.dados_contabeis?.regime_tributario || null;
  const fantasia  = c.nome_fantasia && c.nome_fantasia !== c.razao_social ? c.nome_fantasia : null;
  const ativo     = c.ativo !== false;
  const email     = isStubEmail(c.email) ? null : c.email;

  function handleCopyCnpj(e) {
    e.stopPropagation();
    navigator.clipboard?.writeText(c.cnpj || "");
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  }

  return (
    <tr
      onClick={onClick}
      className={`transition-colors cursor-pointer group ${
        ativo ? "hover:bg-orange-50/40" : "bg-gray-50/30 hover:bg-gray-100/50"
      }`}
    >
      {/* Avatar */}
      <td className="pl-5 pr-3 py-3.5">
        <Avatar name={c.razao_social} />
      </td>

      {/* Empresa */}
      <td className="px-4 py-3.5 max-w-xs">
        <p className={`font-semibold text-sm leading-tight ${ativo ? "text-gray-900" : "text-gray-400"}`}>
          {c.razao_social}
        </p>
        {fantasia && <p className="text-xs text-gray-400 mt-0.5 truncate">{fantasia}</p>}
        {!fantasia && email && <p className="text-xs text-gray-400 mt-0.5 truncate">{email}</p>}
      </td>

      {/* CNPJ */}
      <td className="px-4 py-3.5 whitespace-nowrap hidden sm:table-cell">
        <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
          {formatCnpj(c.cnpj)}
        </span>
      </td>

      {/* Cidade / UF */}
      <td className="px-4 py-3.5 whitespace-nowrap hidden md:table-cell">
        {local
          ? <span className="text-sm text-gray-600">{local}</span>
          : <span className="text-gray-300 text-sm">—</span>}
      </td>

      {/* Regime */}
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <RegimeBadge regime={regime} />
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        {ativo ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Ativo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inativo
          </span>
        )}
      </td>

      {/* Atualizado */}
      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-400 hidden sm:table-cell">
        {fmtDate(c.updated_at)}
      </td>

      {/* Hover actions + chevron */}
      <td className="pl-3 pr-4 py-3.5">
        <div className="flex items-center justify-end gap-1">
          {/* Copiar CNPJ */}
          <button
            onClick={handleCopyCnpj}
            title="Copiar CNPJ"
            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            {copying ? (
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Ver detalhes */}
          <button
            onClick={onClick}
            title="Ver detalhes"
            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg hover:bg-orange-50 text-gray-300 hover:text-orange-500"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "todos",   label: "Todos"   },
  { key: "ativos",  label: "Ativos"  },
  { key: "inativos",label: "Inativos"},
];

export default function Clientes() {
  const { clientes, loading, error, refetch } = useClientes();
  const navigate = useNavigate();

  const [search,    setSearch]    = useState("");
  const [tab,       setTab]       = useState("todos");
  const [sortField, setSortField] = useState("updated");
  const [sortDir,   setSortDir]   = useState("desc");

  function toggleSort(field) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "name" ? "asc" : "desc"); }
  }

  // ativo=true/1/null = ativo; ativo=false/0 = inativo
  const isAtivo = (c) => c.ativo !== false && c.ativo !== 0;

  // ── 1. Aplica busca em todos os clientes ───────────────────────────────────
  const qDigits = search.replace(/\D/g, "");
  const bySearch = clientes.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const cnpjDigits = (c.cnpj || "").replace(/\D/g, "");
    return (
      (c.razao_social || "").toLowerCase().includes(q) ||
      (c.nome_fantasia || "").toLowerCase().includes(q) ||
      (qDigits && cnpjDigits.includes(qDigits))
    );
  });

  // ── 2. Contagens para badges das tabs (baseadas só na busca) ───────────────
  const totalCount   = bySearch.length;
  const ativosCount  = bySearch.filter(isAtivo).length;
  const inativosCount= totalCount - ativosCount;

  // ── 3. Aplica tab sobre resultado da busca ─────────────────────────────────
  const filtered = bySearch.filter((c) => {
    if (tab === "ativos")   return isAtivo(c);
    if (tab === "inativos") return !isAtivo(c);
    return true;
  });

  // ── 4. Stats dinâmicos (refletem busca + tab) ──────────────────────────────
  const total    = filtered.length;
  const ativos   = filtered.filter(isAtivo).length;
  const inativos = total - ativos;
  const simples  = filtered.filter((c) => String(c.dados_contabeis?.regime_tributario) === "1").length;
  const presumido= filtered.filter((c) => String(c.dados_contabeis?.regime_tributario) === "2").length;
  const real     = filtered.filter((c) => String(c.dados_contabeis?.regime_tributario) === "3").length;

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "name") {
      const cmp = a.razao_social.localeCompare(b.razao_social, "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    }
    const cmp = new Date(a.updated_at) - new Date(b.updated_at);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Carregando…" : `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""} cadastrado${clientes.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Busca */}
          <div className="relative">
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ ou e-mail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 py-2 w-72 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 bg-white"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Nova Solicitação */}
          <button
            onClick={() => window.open("/solicitar", "_blank")}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors whitespace-nowrap shadow-sm shadow-orange-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          <StatCard
            color="orange"
            value={total}
            label="Total"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            color="green"
            value={ativos}
            label="Ativos"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            color="gray"
            value={inativos}
            label="Inativos"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            }
          />
          <StatCard
            color="green"
            value={simples}
            label="Simples Nacional"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            }
          />
          <StatCard
            color="blue"
            value={presumido + real}
            label="Lucro Pres./Real"
            sub={`${presumido} presumido · ${real} real`}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Tabela card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Carregando clientes..." />
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={refetch} className="text-xs text-orange-600 mt-2 hover:underline">Tentar novamente</button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-gray-100">
              <div className="flex gap-0">
                {TABS.map((t) => {
                  const count = t.key === "todos" ? totalCount : t.key === "ativos" ? ativosCount : inativosCount;
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                        active ? "text-orange-600" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {t.label}
                      {count > 0 && (
                        <span className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          active
                            ? "bg-orange-100 text-orange-600"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {count}
                        </span>
                      )}
                      {active && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-t-full" />
                      )}
                    </button>
                  );
                })}
              </div>
              {search && (
                <p className="text-xs text-gray-400 pb-2">
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para "{search}"
                </p>
              )}
            </div>

            {sorted.length === 0 ? (
              <EmptyState
                icon="🏢"
                title={search ? "Nenhum resultado encontrado" : "Nenhum cliente nesta categoria"}
                description={
                  search
                    ? "Tente outro termo de busca."
                    : "Clientes são criados automaticamente ao aprovar uma solicitação."
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                        <th className="pl-5 pr-3 py-3 w-14" />
                        <th className="px-4 py-3">
                          <button onClick={() => toggleSort("name")} className="hover:text-gray-600 transition-colors flex items-center gap-1">
                            Empresa <SortIcon active={sortField === "name"} dir={sortDir} />
                          </button>
                        </th>
                        <th className="px-4 py-3 hidden sm:table-cell">CNPJ</th>
                        <th className="px-4 py-3 hidden md:table-cell">Cidade / UF</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Regime</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 hidden sm:table-cell">
                          <button onClick={() => toggleSort("updated")} className="hover:text-gray-600 transition-colors flex items-center gap-1">
                            Atualizado <SortIcon active={sortField === "updated"} dir={sortDir} />
                          </button>
                        </th>
                        <th className="pl-3 pr-4 py-3 w-20" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sorted.map((c) => (
                        <ClienteRow
                          key={c.id}
                          c={c}
                          onClick={() => navigate(`/admin/clientes/${c.id}`)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer summary */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Mostrando <span className="font-semibold text-gray-600">{sorted.length}</span> de{" "}
                    <span className="font-semibold text-gray-600">{clientes.length}</span> clientes
                    {tab !== "todos" && (
                      <span className="ml-1">
                        · filtro: <span className="font-medium text-orange-500">{TABS.find((t) => t.key === tab)?.label}</span>
                        <button onClick={() => setTab("todos")} className="ml-1 text-gray-400 hover:text-gray-600 transition-colors">(limpar)</button>
                      </span>
                    )}
                    {search && (
                      <span className="ml-1">
                        · busca: <span className="font-medium text-orange-500">"{search}"</span>
                        <button onClick={() => setSearch("")} className="ml-1 text-gray-400 hover:text-gray-600 transition-colors">(limpar)</button>
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {simples > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-green-400" />{simples} Simples
                      </span>
                    )}
                    {presumido > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />{presumido} Presumido
                      </span>
                    )}
                    {real > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-violet-400" />{real} Real
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
