import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { templatesApi } from "../services/api";

function TemplateCard({ t, tipoLabel, onDeleted, isInstalacao = false }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggle() {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const { data } = await templatesApi.obter(t.id);
        setDetail(data);
      } catch {
        //
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded((v) => !v);
  }

  async function handleDelete() {
    if (!confirm(`Excluir o template "${t.nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await templatesApi.deletar(t.id);
      onDeleted(t.id);
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  const totalTarefas = detail?.etapas?.reduce((acc, e) => acc + (e.tarefas?.length ?? 0), 0) ?? null;

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${t.ativo ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4">
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={toggle}
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 truncate">{t.nome}</p>
              {!t.ativo && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium shrink-0">Inativo</span>
              )}
              {t.tipo && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium shrink-0">
                  {tipoLabel || t.tipo}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              SLA total: {t.sla_total_dias} dias
              {detail && ` · ${detail.etapas?.length ?? 0} etapas · ${totalTarefas} tarefas`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(`/admin/templates/${t.id}`)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            Editar
          </button>
          {isInstalacao ? (
            <span className="text-[11px] text-gray-400 italic px-2">
              Gerenciar em Configurações
            </span>
          ) : (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
            >
              {deleting ? "..." : "Excluir"}
            </button>
          )}
          <button
            onClick={toggle}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-6 py-4">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            </div>
          ) : detail ? (
            <div>
              {detail.descricao && (
                <p className="text-sm text-gray-500 mb-4">{detail.descricao}</p>
              )}
              <div className="space-y-0">
                {detail.etapas?.map((etapa) => (
                  <div key={etapa.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                    <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: etapa.cor || "#6366f1" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{etapa.nome}</span>
                        <span className="text-xs text-gray-400">SLA: {etapa.sla_dias}d</span>
                      </div>
                      {etapa.tarefas?.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {etapa.tarefas.map((ta) => (
                            <li key={ta.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                              <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                              {ta.titulo}
                              {ta.obrigatoria && <span className="text-orange-400 font-bold">*</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{etapa.tarefas?.length ?? 0} tarefas</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Erro ao carregar detalhes.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("implantacao");

  const load = useCallback(async () => {
    try {
      const { data } = await templatesApi.listar();
      setTemplates(data);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isInstalacao = (t) => t.tipo?.startsWith("instalacao_");
  const implantacaoTemplates = templates.filter((t) => !isInstalacao(t));
  const instalacaoTemplates  = templates.filter((t) => isInstalacao(t));
  const visibleTemplates = tab === "implantacao" ? implantacaoTemplates : instalacaoTemplates;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Checklists e pipelines reutilizáveis.</p>
        </div>
        <button
          onClick={() => navigate("/admin/templates/novo")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm w-fit">
        {[
          { key: "implantacao", label: "Implantação", count: implantacaoTemplates.length },
          { key: "instalacao",  label: "Instalação",  count: instalacaoTemplates.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? "bg-orange-50 text-orange-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
              tab === t.key ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        </div>
      ) : visibleTemplates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <p className="text-sm font-medium text-gray-700">Nenhum template encontrado</p>
          <button
            onClick={() => navigate("/admin/templates/novo")}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
          >
            Criar template
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              tipoLabel={isInstalacao(t) ? "Instalação" : undefined}
              isInstalacao={isInstalacao(t)}
              onDeleted={(id) => setTemplates((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
