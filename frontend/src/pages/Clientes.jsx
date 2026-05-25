import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { LoadingSpinner, EmptyState } from "../components/ui/LoadingSpinner";
import { useClientes } from "../hooks/useClientes";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "#253261", "#1e40af", "#6d28d9", "#0f766e",
  "#b45309", "#c2410c", "#be185d", "#1d4ed8",
];

function avatarBg(name) {
  return AVATAR_PALETTE[(name?.charCodeAt(0) || 0) % AVATAR_PALETTE.length];
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

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name }) {
  return (
    <div
      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold select-none"
      style={{ background: avatarBg(name) }}
    >
      {name?.charAt(0).toUpperCase() || "?"}
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
  "1": { label: "Simples Nacional", cls: "bg-green-50  text-green-700  border-green-200"  },
  "2": { label: "Lucro Presumido",  cls: "bg-blue-50   text-blue-700   border-blue-200"   },
  "3": { label: "Lucro Real",       cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

function RegimeBadge({ regime }) {
  const cfg = REGIME_CFG[regime];
  if (!cfg) return <span className="text-gray-300 text-sm">—</span>;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Clientes() {
  const { clientes, loading, error, refetch } = useClientes();
  const navigate = useNavigate();

  const [search, setSearch]       = useState("");
  const [sortField, setSortField] = useState("updated");
  const [sortDir, setSortDir]     = useState("desc");

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  }

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.razao_social.toLowerCase().includes(q) ||
      c.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
      c.email.toLowerCase().includes(q)
    );
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading
              ? "Carregando…"
              : `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""} cadastrado${clientes.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
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

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Carregando clientes..." />
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={refetch} className="text-xs text-orange-600 mt-2 hover:underline">
              Tentar novamente
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="🏢"
            title={search ? "Nenhum resultado encontrado" : "Nenhum cliente cadastrado"}
            description={
              search
                ? "Tente outro termo de busca."
                : "Clientes são criados automaticamente ao aprovar uma solicitação."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-100 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="pl-5 pr-3 py-3 w-14" />
                  <th className="px-4 py-3">
                    <button onClick={() => toggleSort("name")} className="hover:text-gray-600 transition-colors flex items-center gap-1">
                      Empresa
                      <SortIcon active={sortField === "name"} dir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Cidade / UF</th>
                  <th className="px-4 py-3">Regime</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <button onClick={() => toggleSort("updated")} className="hover:text-gray-600 transition-colors flex items-center gap-1">
                      Atualizado
                      <SortIcon active={sortField === "updated"} dir={sortDir} />
                    </button>
                  </th>
                  <th className="pl-3 pr-5 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((c) => {
                  const cidade = c.endereco?.cidade ? toTitleCase(c.endereco.cidade) : null;
                  const estado = c.endereco?.estado?.toUpperCase() || null;
                  const local  = cidade && estado ? `${cidade} / ${estado}` : cidade || estado || null;
                  const regime = c.dados_contabeis?.regime_tributario || null;
                  const fantasia = c.nome_fantasia && c.nome_fantasia !== c.razao_social ? c.nome_fantasia : null;
                  const ativo = c.ativo !== false;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/admin/clientes/${c.id}`)}
                      className={`transition-colors cursor-pointer group border-b border-gray-100 last:border-0 ${
                        ativo ? "hover:bg-orange-50/40" : "bg-gray-50/40 hover:bg-gray-100/50"
                      }`}
                    >
                      {/* Avatar circular */}
                      <td className="pl-5 pr-3 py-4">
                        <Avatar name={c.razao_social} />
                      </td>

                      {/* Empresa — só nome + fantasia, sem CNPJ */}
                      <td className="px-4 py-4 max-w-xs">
                        <p className={`font-semibold leading-tight ${ativo ? "text-gray-900" : "text-gray-500"}`}>
                          {c.razao_social}
                        </p>
                        {fantasia && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{fantasia}</p>
                        )}
                      </td>

                      {/* CNPJ — coluna dedicada em mono */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                          {formatCnpj(c.cnpj)}
                        </span>
                      </td>

                      {/* Cidade / UF — title case */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {local
                          ? <span className="text-sm text-gray-600">{local}</span>
                          : <span className="text-gray-300 text-sm">—</span>}
                      </td>

                      {/* Regime */}
                      <td className="px-4 py-4">
                        <RegimeBadge regime={regime} />
                      </td>

                      {/* Ativo / Inativo */}
                      <td className="px-4 py-4">
                        {ativo ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Atualizado */}
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-400">
                        {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                      </td>

                      {/* Chevron */}
                      <td className="pl-3 pr-5 py-4 text-right">
                        <svg className="w-4 h-4 text-gray-200 group-hover:text-orange-400 transition-colors inline"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {search && filtered.length > 0 && (
              <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-400">
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para "{search}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
