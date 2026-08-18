import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { implantacoesApi, usuariosApi } from "../../services/api";

// Modal de edição de Implantação (status, responsável, consultor, prioridade,
// data prevista, observações, conversão de dados). Compartilhado entre a tela
// de detalhe completo e o painel rápido do Kanban — mesmo formulário, sem
// duplicar campos/validação em dois lugares.
export function EditPanel({ impl, onClose, onSaved }) {
  const { t } = useTranslation("implantacaoDetalhe");
  const [form, setForm] = useState({
    status:        impl.status,
    consultor:     impl.consultor || "",
    prioridade:    impl.prioridade,
    observacoes:   impl.observacoes || "",
    data_prevista: impl.data_prevista || "",
    responsavel_id: impl.responsavel_id ?? "",
    conversao_dados: impl.conversao_dados || false,
  });
  const [usuarios, setUsuarios] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usuariosApi.listar().then(({ data }) => setUsuarios(data.filter((u) => u.ativo))).catch(() => {});
  }, []);

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition";

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.responsavel_id === "") delete payload.responsavel_id;
      else payload.responsavel_id = Number(payload.responsavel_id);
      await implantacoesApi.atualizar(impl.id, payload);
      onSaved();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{t("editPanel.title")}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editPanel.statusLabel")}</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
              <option value="em_andamento">{t("editPanel.status.em_andamento")}</option>
              <option value="pausada">{t("editPanel.status.pausada")}</option>
              <option value="concluida">{t("editPanel.status.concluida")}</option>
              <option value="cancelada">{t("editPanel.status.cancelada")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editPanel.responsibleLabel")}</label>
            <select value={form.responsavel_id} onChange={(e) => setForm((f) => ({ ...f, responsavel_id: e.target.value }))} className={inputCls}>
              <option value="">{t("editPanel.noResponsible")}</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editPanel.consultantLabel")}</label>
            <input type="text" value={form.consultor} onChange={(e) => setForm((f) => ({ ...f, consultor: e.target.value }))} placeholder={t("editPanel.consultantPlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editPanel.expectedDateLabel")}</label>
            <input type="date" value={form.data_prevista} onChange={(e) => setForm((f) => ({ ...f, data_prevista: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editPanel.priorityLabel")}</label>
            <div className="flex gap-2">
              {["baixa", "normal", "alta", "critica"].map((p) => (
                <button key={p} type="button"
                  onClick={() => setForm((f) => ({ ...f, prioridade: p }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    form.prioridade === p ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {t(`editPanel.priority.${p}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("editPanel.notesLabel")}</label>
            <textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder={t("editPanel.notesPlaceholder")} className={`${inputCls} resize-none`} />
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, conversao_dados: !f.conversao_dados }))}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
              form.conversao_dados ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              form.conversao_dados ? "bg-blue-500" : "bg-gray-300"
            }`}>
              {form.conversao_dados && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <p className={`text-xs font-semibold ${form.conversao_dados ? "text-blue-700" : "text-gray-600"}`}>
              {t("editPanel.dataConversionLabel")}
            </p>
          </button>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">{t("common.cancel")}</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
