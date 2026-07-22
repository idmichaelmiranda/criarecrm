import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { gruposApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSION_LABELS, PERMISSION_MODULES } from "../constants/permissions";

function Modal({ titulo, inicial, onSave, onClose, loading, hasPermission }) {
  const { t } = useTranslation("gruposPermissao");
  const isEdit = !!inicial?.id;
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [permissoes, setPermissoes] = useState(new Set(inicial?.permissoes ?? []));
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [error, setError] = useState("");

  const canEdit = hasPermission(isEdit ? "grupos.edit" : "grupos.create");

  function togglePerm(perm) {
    if (!canEdit) return;
    setPermissoes((prev) => {
      const next = new Set(prev);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
  }

  function toggleModule(perms) {
    if (!canEdit) return;
    const allOn = perms.every((p) => permissoes.has(p));
    setPermissoes((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => (allOn ? next.delete(p) : next.add(p)));
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { setError(t("errors.nameRequired")); return; }
    try {
      await onSave({ nome: nome.trim(), descricao: descricao.trim() || null, permissoes: [...permissoes], ativo });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t("modal.groupName")}</label>
              <input
                value={nome}
                onChange={(e) => { setNome(e.target.value); setError(""); }}
                disabled={!canEdit}
                placeholder={t("modal.groupNamePlaceholder")}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-gray-900 placeholder-gray-400 border border-gray-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:bg-gray-50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t("modal.description")}</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={!canEdit}
                placeholder={t("modal.descriptionPlaceholder")}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-gray-900 placeholder-gray-400 border border-gray-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:bg-gray-50 disabled:opacity-60"
              />
            </div>

            {/* Permissões */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("modal.permissions")}</label>
              <div className="space-y-2">
                {PERMISSION_MODULES.map((mod) => {
                  const allOn  = mod.permissions.every((p) => permissoes.has(p));
                  const someOn = mod.permissions.some((p) => permissoes.has(p));
                  return (
                    <div key={mod.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                      {/* Cabeçalho do módulo */}
                      <button
                        type="button"
                        onClick={() => toggleModule(mod.permissions)}
                        disabled={!canEdit}
                        className="flex items-center gap-2 w-full text-left mb-2.5 disabled:cursor-default"
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-colors ${
                          allOn  ? "bg-orange-500 border-orange-500" :
                          someOn ? "bg-orange-100 border-orange-400" :
                                   "border-gray-300 bg-white"
                        }`}>
                          {allOn && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {someOn && !allOn && <div className="w-2 h-0.5 bg-orange-500 rounded" />}
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{mod.label}</span>
                      </button>

                      {/* Permissões individuais */}
                      <div className="grid grid-cols-2 gap-1.5 ml-6">
                        {mod.permissions.map((perm) => (
                          <button
                            key={perm}
                            type="button"
                            onClick={() => togglePerm(perm)}
                            disabled={!canEdit}
                            className="flex items-center gap-2 text-left py-0.5 disabled:cursor-default"
                          >
                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              permissoes.has(perm) ? "bg-orange-500 border-orange-500" : "border-gray-300 bg-white"
                            }`}>
                              {permissoes.has(perm) && (
                                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{PERMISSION_LABELS[perm]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Toggle ativo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => canEdit && setAtivo((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${ativo ? "bg-orange-500" : "bg-gray-300"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm text-gray-600">{ativo ? t("modal.activeGroup") : t("modal.inactiveGroup")}</span>
            </div>

            {error && (
              <p className="text-xs text-red-600 px-3 py-2 rounded-lg bg-red-50 border border-red-100">{error}</p>
            )}
          </div>

          {canEdit && (
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                {t("modal.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-all"
                style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}
              >
                {loading ? t("modal.saving") : t("modal.save")}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function GruposPermissao() {
  const { t } = useTranslation("gruposPermissao");
  const { hasPermission } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const { data } = await gruposApi.listar();
      setGrupos(data);
    } catch {
      setError(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (modal.item) await gruposApi.atualizar(modal.item.id, payload);
      else await gruposApi.criar(payload);
      setModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await gruposApi.deletar(id);
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      setError(err.message);
      setDeleteConfirm(null);
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("header.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("header.subtitle")}</p>
        </div>
        {hasPermission("grupos.create") && (
          <button
            onClick={() => setModal({ item: null })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t("header.newGroup")}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-20">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {grupos.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:border-gray-200 transition-colors"
            >
              {/* Ícone */}
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{g.nome}</span>
                  {!g.ativo && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">{t("inactive")}</span>
                  )}
                </div>
                {g.descricao && <p className="text-xs text-gray-400 mt-0.5 truncate">{g.descricao}</p>}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-600">
                    {t("permissionCount", { count: g.permissoes?.length ?? 0 })}
                  </span>
                  <span className="text-xs text-gray-400">
                    {t("userCount", { count: g.total_usuarios ?? 0 })}
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-1 shrink-0">
                {hasPermission("grupos.edit") && (
                  <button
                    onClick={() => setModal({ item: g })}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                    title={t("actions.edit")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {hasPermission("grupos.delete") && (
                  <button
                    onClick={() => setDeleteConfirm(g)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title={t("actions.delete")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <Modal
          titulo={modal.item ? t("modal.titleEdit") : t("modal.titleNew")}
          inicial={modal.item}
          onSave={handleSave}
          onClose={() => setModal(null)}
          loading={saving}
          hasPermission={hasPermission}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">{t("deleteConfirm.title")}</h3>
            <p className="text-sm text-gray-500 mb-6">
              {t("deleteConfirm.messageBefore")}<span className="font-semibold text-gray-800">{deleteConfirm.nome}</span>{t("deleteConfirm.messageAfter")}
              {(deleteConfirm.total_usuarios ?? 0) > 0 && (
                <span className="block mt-1 text-amber-600 text-xs font-medium">
                  {t("deleteConfirm.linkedUsersWarning", { count: deleteConfirm.total_usuarios })}
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                {t("deleteConfirm.cancel")}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                {t("deleteConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
