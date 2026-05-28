import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { templatesApi } from "../services/api";

// ── Ícones inline ─────────────────────────────────────────────────────────────
const IconTemplate = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const IconChevron = ({ open }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
    <path d="M19 9l-7 7-7-7" />
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);
const IconLayers = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

// ── Menu de ações (3 pontos) ─────────────────────────────────────────────────
function ActionsMenu({ onEdit, onDelete, deleting, isInstalacao }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handle(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-36 text-sm">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <IconEdit /> Editar
          </button>
          {!isInstalacao && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
              disabled={deleting}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <IconTrash /> {deleting ? "Excluindo..." : "Excluir"}
            </button>
          )}
          {isInstalacao && (
            <span className="block px-3 py-2 text-[11px] text-gray-400 italic">Gerenciar em Configurações</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card de template ──────────────────────────────────────────────────────────
function TemplateCard({ t, isInstalacao, onDeleted }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggle() {
    if (!expanded && !detail) {
      setLoading(true);
      try {
        const { data } = await templatesApi.obter(t.id);
        setDetail(data);
      } catch { /* */ } finally { setLoading(false); }
    }
    setExpanded((v) => !v);
  }

  async function handleDelete() {
    if (!confirm(`Excluir "${t.nome}"? Não é possível desfazer.`)) return;
    setDeleting(true);
    try {
      await templatesApi.deletar(t.id);
      onDeleted(t.id);
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  const totalTarefas = detail?.etapas?.reduce((a, e) => a + (e.tarefas?.length ?? 0), 0) ?? null;
  const accentColor  = detail?.etapas?.[0]?.cor || "#6366f1";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${t.ativo ? "border-gray-100" : "border-gray-200 opacity-60"}`}>

      {/* Barra de cor superior */}
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      {/* Cabeçalho do card */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={toggle}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: `${accentColor}18` }}>
              <span style={{ color: accentColor }}><IconTemplate /></span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 text-sm truncate">{t.nome}</p>
                {!t.ativo && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold shrink-0">Inativo</span>
                )}
                {t.tipo && !isInstalacao && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold shrink-0 border border-blue-100">{t.tipo}</span>
                )}
                {isInstalacao && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold shrink-0 border border-emerald-100">Instalação</span>
                )}
              </div>
              {t.descricao && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{t.descricao}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={toggle} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <IconChevron open={expanded} />
            </button>
            <ActionsMenu
              onEdit={() => navigate(`/admin/templates/${t.id}`)}
              onDelete={handleDelete}
              deleting={deleting}
              isInstalacao={isInstalacao}
            />
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-3 mt-3 ml-11">
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <IconLayers />{detail ? `${detail.etapas?.length ?? 0} etapa${detail.etapas?.length !== 1 ? "s" : ""}` : `${t.sla_total_dias}d SLA`}
          </span>
          {totalTarefas !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <IconCheck />{totalTarefas} tarefa{totalTarefas !== 1 ? "s" : ""}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <IconClock />{t.sla_total_dias}d SLA
          </span>
        </div>
      </div>

      {/* Detalhe expandido */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            </div>
          ) : detail ? (
            <div className="space-y-0">
              {(!detail.etapas || detail.etapas.length === 0) && (
                <p className="text-xs text-gray-400 italic py-2">Nenhuma etapa cadastrada.</p>
              )}
              {detail.etapas?.map((etapa, idx) => (
                <div key={etapa.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="text-[10px] font-bold text-gray-400 w-4 text-right">{idx + 1}</span>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.cor || "#6366f1" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{etapa.nome}</span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{etapa.sla_dias}d</span>
                    </div>
                    {etapa.tarefas?.filter(ta => !ta.parent_id).length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {etapa.tarefas.filter(ta => !ta.parent_id).map((ta) => (
                          <li key={ta.id} className="flex items-start gap-1.5 text-xs text-gray-500">
                            <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0 mt-1.5" />
                            <span>{ta.titulo}</span>
                            {ta.obrigatoria && <span className="text-orange-400 font-bold shrink-0">*</span>}
                            {ta.subitens?.length > 0 && (
                              <span className="text-gray-400 shrink-0">({ta.subitens.length})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 pt-0.5">{etapa.tarefas?.filter(ta => !ta.parent_id).length ?? 0} itens</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Erro ao carregar detalhes.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="h-1 bg-gray-200" />
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
        <div className="flex gap-3 mt-3 ml-11">
          <div className="h-3 bg-gray-100 rounded w-16" />
          <div className="h-3 bg-gray-100 rounded w-12" />
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Templates() {
  const navigate  = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("implantacao");
  const [search, setSearch]       = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await templatesApi.listar();
      setTemplates(data);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isInstalacao = (t) => t.tipo?.startsWith("instalacao_");
  const implantacaoTemplates = templates.filter((t) => !isInstalacao(t));
  const instalacaoTemplates  = templates.filter((t) => isInstalacao(t));
  const base     = tab === "implantacao" ? implantacaoTemplates : instalacaoTemplates;
  const filtered = search.trim()
    ? base.filter((t) => t.nome.toLowerCase().includes(search.toLowerCase()) || t.descricao?.toLowerCase().includes(search.toLowerCase()))
    : base;

  return (
    <Layout>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipelines e checklists reutilizáveis para implantação e instalação.</p>
        </div>
        <button
          onClick={() => navigate("/admin/templates/novo")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v16m8-8H4" />
          </svg>
          Novo Template
        </button>
      </div>

      {/* Toolbar: tabs + busca */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl px-2 py-1.5 shadow-sm">
          {[
            { key: "implantacao", label: "Implantação", count: implantacaoTemplates.length },
            { key: "instalacao",  label: "Instalação",  count: instalacaoTemplates.length },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => { setTab(item.key); setSearch(""); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === item.key ? "bg-orange-50 text-orange-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {item.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                tab === item.key ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"
              }`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <IconSearch />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar template..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 bg-white shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Contador */}
        {!loading && (
          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} template{filtered.length !== 1 ? "s" : ""}
            {search && ` para "${search}"`}
          </span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
            <IconTemplate />
          </div>
          <p className="text-sm font-semibold text-gray-700">
            {search ? `Nenhum template encontrado para "${search}"` : "Nenhum template cadastrado"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {search ? "Tente outros termos." : "Crie o primeiro template para começar."}
          </p>
          {!search && (
            <button
              onClick={() => navigate("/admin/templates/novo")}
              className="mt-5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              Criar template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              isInstalacao={isInstalacao(t)}
              onDeleted={(id) => setTemplates((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
