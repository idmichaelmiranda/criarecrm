import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { instalacaosApi, clientesApi, usuariosApi, templatesApi } from "../services/api";
import { fmtDate, fmtDateTime, fmtDateOnly } from "../utils/dateUtils";

function normalizeTipo(t) {
  return t?.startsWith("instalacao_") ? t : `instalacao_${t}`;
}

const TIPO_LABEL = {
  pdv:          "PDV Adicional",
  coletor:      "Coletor Mobile",
  forca_vendas: "Força de Vendas",
  impressora:   "Impressora",
  outro:        "Outro",
};

const TIPO_COLOR = {
  pdv:          "bg-blue-100 text-blue-700 border-blue-200",
  coletor:      "bg-purple-100 text-purple-700 border-purple-200",
  forca_vendas: "bg-orange-100 text-orange-700 border-orange-200",
  impressora:   "bg-teal-100 text-teal-700 border-teal-200",
  outro:        "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_LABEL = {
  agendada:    "Agendada",
  em_execucao: "Em Execução",
  concluida:   "Concluída",
  cancelada:   "Cancelada",
};

const STATUS_COLOR = {
  agendada:    "bg-blue-100 text-blue-700",
  em_execucao: "bg-orange-100 text-orange-700",
  concluida:   "bg-green-100 text-green-700",
  cancelada:   "bg-gray-100 text-gray-500",
};

const ITEM_STATUS_COLOR = {
  pendente:       "text-gray-400",
  concluido:      "text-green-500",
  nao_aplicavel:  "text-gray-300 line-through",
};

const AVATAR_COLORS = [
  "bg-orange-500", "bg-blue-500", "bg-violet-500", "bg-emerald-500",
  "bg-pink-500",   "bg-teal-500", "bg-amber-500",  "bg-indigo-500",
];

function avatarColor(nome) {
  if (!nome) return AVATAR_COLORS[0];
  return AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(nome) {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function useElapsed(iniciadoEm, finalizadoEm) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!iniciadoEm || finalizadoEm) return;
    const start = new Date(iniciadoEm.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iniciadoEm) ? iniciadoEm : iniciadoEm + "Z").getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iniciadoEm, finalizadoEm]);
  return elapsed;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function formatMinutes(min) {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ""}`.trim();
  return `${m}min`;
}

function fmtBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fileIcon(contentType) {
  if (!contentType) return "📄";
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType === "application/pdf") return "📑";
  if (contentType.includes("spreadsheet") || contentType.includes("excel") || contentType.includes("csv")) return "📊";
  if (contentType.includes("word") || contentType.includes("document")) return "📝";
  if (contentType.includes("zip") || contentType.includes("rar") || contentType.includes("tar")) return "🗜️";
  return "📄";
}

// ── Modal de Finalização ──────────────────────────────────────────────────────

function ModalFinalizar({ elapsed, onConfirm, onClose, saving }) {
  const [obs, setObs] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Concluir Instalação</h2>
          <p className="text-sm text-gray-500 mb-1">Tempo total decorrido</p>
          <p className="text-3xl font-bold text-orange-500 mb-4">{formatDuration(elapsed)}</p>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Observação final (opcional)</label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="Ex: Caixa testado, TEF ativado. Ficou pendente ligar para a Digimaq..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-orange-400 transition resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(obs)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Finalizando…" : "Confirmar Conclusão"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgBar({ value }) {
  const color = value === 100 ? "bg-green-500" : value > 50 ? "bg-blue-500" : value > 0 ? "bg-orange-400" : "bg-gray-200";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div className={`h-2.5 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

// ── Checklist item ────────────────────────────────────────────────────────────

function ChecklistItem({ item, instId, onUpdated, onDeleted, locked }) {
  const [loading, setLoading] = useState(false);
  const [showNota, setShowNota] = useState(false);
  const [notaEdit, setNotaEdit] = useState(item.nota || "");
  const [savingNota, setSavingNota] = useState(false);

  async function cycleStatus() {
    const next = item.status === "concluido" ? "pendente" : "concluido";
    setLoading(true);
    try {
      const { data } = await instalacaosApi.atualizarItem(instId, item.id, { status: next });
      onUpdated(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const { data } = await instalacaosApi.deletarItem(instId, item.id);
      onDeleted(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleSaveNota() {
    setSavingNota(true);
    try {
      const { data } = await instalacaosApi.atualizarItem(instId, item.id, { nota: notaEdit || null });
      onUpdated(data);
      setShowNota(false);
    } catch {}
    finally { setSavingNota(false); }
  }

  const isConcluido = item.status === "concluido";
  const temNota = Boolean(item.nota);

  return (
    <div className="border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 py-2.5 group">
        <button
          onClick={cycleStatus}
          disabled={loading || locked}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
            isConcluido
              ? "border-green-500 bg-green-500"
              : locked
                ? "border-gray-200 cursor-not-allowed"
                : "border-gray-300 hover:border-orange-400"
          }`}
        >
          {isConcluido && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className={`flex-1 text-sm ${isConcluido ? "line-through text-gray-400" : "text-gray-700"}`}>
          {item.titulo}
          {!item.obrigatoria && <span className="ml-1.5 text-[10px] text-gray-300">(opcional)</span>}
        </span>
        {item.data_conclusao && isConcluido && (
          <span className="text-[10px] text-gray-300 shrink-0">
            {fmtDateTime(item.data_conclusao)}
          </span>
        )}
        {/* Botão de nota */}
        {!locked && (
          <button
            onClick={() => { setShowNota((v) => !v); setNotaEdit(item.nota || ""); }}
            title={temNota ? "Ver/editar nota" : "Adicionar nota"}
            className={`opacity-0 group-hover:opacity-100 ${temNota ? "!opacity-100" : ""} w-5 h-5 flex items-center justify-center rounded transition-all ${
              temNota ? "text-amber-500 hover:text-amber-600" : "text-gray-300 hover:text-amber-400"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={temNota ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        {!locked && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 transition-all"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nota preview (quando tem nota e painel fechado) */}
      {temNota && !showNota && (
        <div
          onClick={() => !locked && (setShowNota(true), setNotaEdit(item.nota || ""))}
          className={`ml-8 mb-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100 ${!locked ? "cursor-pointer hover:bg-amber-100" : ""} transition-colors`}
        >
          <p className="text-[11px] text-amber-700 leading-snug">{item.nota}</p>
        </div>
      )}

      {/* Editor de nota */}
      {showNota && (
        <div className="ml-8 mb-2 space-y-1.5">
          <textarea
            autoFocus
            value={notaEdit}
            onChange={(e) => setNotaEdit(e.target.value)}
            placeholder="Adicione uma observação sobre este item…"
            rows={2}
            className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 bg-amber-50 text-amber-900 placeholder-amber-300 resize-none transition"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveNota}
              disabled={savingNota}
              className="px-3 py-1 rounded-lg text-[11px] font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {savingNota ? "Salvando…" : "Salvar nota"}
            </button>
            {notaEdit && (
              <button
                onClick={() => { setNotaEdit(""); }}
                className="px-3 py-1 rounded-lg text-[11px] font-medium text-amber-600 hover:bg-amber-50 transition-colors"
              >
                Limpar
              </button>
            )}
            <button
              onClick={() => setShowNota(false)}
              className="ml-auto text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal Editar (antes de iniciar) ──────────────────────────────────────────

function EditarInstalacaoModal({ inst, tiposConfig, usuarios, onSave, onClose, saving, error }) {
  const tiposAtuais = (inst.tipos?.length > 0 ? inst.tipos : [inst.tipo].filter(Boolean))
    .map((t) => t.replace(/^instalacao_/, ""));

  const [tiposSel, setTiposSel] = useState([...tiposAtuais]);
  const [form, setForm] = useState({
    quantidade: inst.quantidade || 1,
    prioridade: inst.prioridade || "normal",
    responsavel_id: inst.responsavel_id ?? "",
    data_agendada: inst.data_agendada || "",
    contato_nome: inst.contato_nome || "",
    contato_telefone: inst.contato_telefone || "",
    observacoes: inst.observacoes || "",
  });

  const oriSet = new Set(tiposAtuais);
  const tiposChanged = tiposSel.length !== oriSet.size || tiposSel.some((t) => !oriSet.has(t));

  function toggleTipo(slug) {
    setTiposSel((prev) => prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]);
  }

  function handleSubmit() {
    const tipos = tiposSel.map((t) => (t.startsWith("instalacao_") ? t : `instalacao_${t}`));
    onSave({
      tipos,
      quantidade: Number(form.quantidade),
      prioridade: form.prioridade,
      responsavel_id: form.responsavel_id ? parseInt(form.responsavel_id) : null,
      data_agendada: form.data_agendada || null,
      contato_nome: form.contato_nome || null,
      contato_telefone: form.contato_telefone || null,
      observacoes: form.observacoes || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">Editar Instalação</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Produtos */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Produtos</label>
            <div className="flex flex-wrap gap-2">
              {tiposConfig.filter((t) => t.ativo).map((t) => {
                const slug = t.tipo.replace(/^instalacao_/, "");
                const sel = tiposSel.includes(slug);
                return (
                  <button key={t.id} type="button" onClick={() => toggleTipo(slug)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      sel ? "border-transparent text-white shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                    }`}
                    style={sel ? { background: t.cor || "#6366f1" } : undefined}>
                    {sel && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {t.nome}
                  </button>
                );
              })}
            </div>
            {tiposChanged && (
              <div className="mt-2.5 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Alterar os produtos irá regenerar o checklist. Itens já marcados serão perdidos.</span>
              </div>
            )}
          </div>

          {/* Quantidade + Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Quantidade</label>
              <input type="number" min={1} value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Prioridade</label>
              <select value={form.prioridade}
                onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition bg-white">
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Responsável + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Responsável</label>
              <select value={form.responsavel_id}
                onChange={(e) => setForm((f) => ({ ...f, responsavel_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition bg-white">
                <option value="">Sem responsável</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data Agendada</label>
              <input type="date" value={form.data_agendada}
                onChange={(e) => setForm((f) => ({ ...f, data_agendada: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition" />
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contato no local</label>
              <input type="text" value={form.contato_nome} placeholder="Nome do contato"
                onChange={(e) => setForm((f) => ({ ...f, contato_nome: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Telefone</label>
              <input type="text" value={form.contato_telefone} placeholder="(00) 00000-0000"
                onChange={(e) => setForm((f) => ({ ...f, contato_telefone: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition" />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Observações</label>
            <textarea value={form.observacoes} rows={3}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Observações adicionais…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition resize-none" />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || tiposSel.length === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InstalacaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [inst, setInst] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [tiposConfig, setTiposConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [formEdit, setFormEdit] = useState({});
  const [saving, setSaving] = useState(false);
  const [novoItem, setNovoItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [novoComentario, setNovoComentario] = useState("");
  const [sendingComentario, setSendingComentario] = useState(false);
  const [showModalFinalizar, setShowModalFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  const [editandoResp, setEditandoResp] = useState(false);
  const [savingResp, setSavingResp] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [editarError, setEditarError] = useState("");
  const [editarSaving, setEditarSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await instalacaosApi.obter(id);
      setInst(data);
      setFormEdit({
        status: data.status,
        prioridade: data.prioridade,
        responsavel_id: data.responsavel_id ?? "",
        data_agendada: data.data_agendada || "",
        observacoes: data.observacoes || "",
      });
      clientesApi.obter(data.cliente_id).then(({ data: c }) => setCliente(c)).catch(() => {});
    } catch {
      setError("Instalação não encontrada.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    usuariosApi.listar().then(({ data }) => setUsuarios(data.filter((u) => u.ativo))).catch(() => {});
    instalacaosApi.tipos().then(({ data }) => setTiposConfig(data)).catch(() => {});
  }, [id]);

  const elapsed = useElapsed(inst?.iniciado_em, inst?.finalizado_em);

  async function handleIniciar() {
    setIniciando(true);
    try {
      const { data } = await instalacaosApi.iniciar(id);
      setInst(data);
    } catch (err) { setError(err.message); }
    finally { setIniciando(false); }
  }

  async function handleFinalizar(obsText) {
    setFinalizando(true);
    try {
      const { data } = await instalacaosApi.finalizar(id, { observacao_final: obsText || null });
      setInst(data);
      setShowModalFinalizar(false);
    } catch (err) { setError(err.message); }
    finally { setFinalizando(false); }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const { data } = await instalacaosApi.atualizar(id, {
        ...formEdit,
        responsavel_id: formEdit.responsavel_id ? parseInt(formEdit.responsavel_id) : null,
        data_agendada: formEdit.data_agendada || null,
        observacoes: formEdit.observacoes || null,
      });
      setInst(data);
      setEditando(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!novoItem.trim()) return;
    setAddingItem(true);
    try {
      const { data } = await instalacaosApi.adicionarItem(id, { titulo: novoItem.trim(), obrigatoria: false });
      setInst(data);
      setNovoItem("");
    } catch {}
    finally { setAddingItem(false); }
  }

  async function handleComentario(e) {
    e.preventDefault();
    if (!novoComentario.trim()) return;
    setSendingComentario(true);
    try {
      await instalacaosApi.adicionarComentario(id, { conteudo: novoComentario.trim(), usuario: "Admin" });
      const { data } = await instalacaosApi.obter(id);
      setInst(data);
      setNovoComentario("");
    } catch {}
    finally { setSendingComentario(false); }
  }

  async function handleSaveResp(rawVal) {
    const responsavel_id = rawVal ? parseInt(rawVal) : null;
    setSavingResp(true);
    try {
      const { data } = await instalacaosApi.atualizar(id, { responsavel_id });
      setInst(data);
      setFormEdit((f) => ({ ...f, responsavel_id: data.responsavel_id ?? "" }));
    } catch {}
    finally {
      setSavingResp(false);
      setEditandoResp(false);
    }
  }

  async function handleEditarAntes(payload) {
    setEditarSaving(true);
    setEditarError("");
    try {
      const { data } = await instalacaosApi.editarAntes(id, payload);
      setInst(data);
      setShowEditarModal(false);
    } catch (err) {
      setEditarError(err.message || "Erro ao salvar alterações.");
    } finally {
      setEditarSaving(false);
    }
  }

  async function handleUploadAnexo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    try {
      const { data } = await instalacaosApi.uploadAnexo(id, file);
      setInst(data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Erro ao enviar arquivo.";
      setUploadError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAnexo(anexo) {
    if (!window.confirm(`Remover "${anexo.filename}"?`)) return;
    try {
      const { data } = await instalacaosApi.deletarAnexo(id, anexo.id);
      setInst(data);
    } catch {}
  }

  async function handleDownloadAnexo(anexo) {
    try {
      const { data } = await instalacaosApi.downloadAnexo(id, anexo.id);
      const url = URL.createObjectURL(new Blob([data], { type: anexo.content_type || "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = anexo.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!inst || error) {
    return (
      <Layout>
        <div className="py-20 text-center text-gray-400 text-sm">{error || "Instalação não encontrada."}</div>
      </Layout>
    );
  }

  const tiposMap = Object.fromEntries(tiposConfig.map((t) => [t.tipo, t]));

  const checklist = inst.checklist || [];
  const concluidos = checklist.filter((i) => i.status === "concluido").length;
  const todasConcluidas = checklist.length > 0 && concluidos === checklist.length;
  const emAndamento = inst.iniciado_em && !inst.finalizado_em;
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition";
  const responsavelUser = inst.responsavel_id ? usuarios.find((u) => u.id === inst.responsavel_id) : null;

  return (
    <Layout>
      {showModalFinalizar && (
        <ModalFinalizar
          elapsed={elapsed}
          saving={finalizando}
          onConfirm={handleFinalizar}
          onClose={() => setShowModalFinalizar(false)}
        />
      )}
      {showEditarModal && (
        <EditarInstalacaoModal
          inst={inst}
          tiposConfig={tiposConfig}
          usuarios={usuarios}
          saving={editarSaving}
          error={editarError}
          onSave={handleEditarAntes}
          onClose={() => { setShowEditarModal(false); setEditarError(""); }}
        />
      )}
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate("/instalacoes")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Instalações
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{inst.codigo}</span>
        </div>
        <div className="flex items-center gap-2">
          {inst.status === "agendada" && (
            <button
              onClick={() => { setEditarError(""); setShowEditarModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar Instalação
            </button>
          )}
          <button
            onClick={() => setEditando((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              editando ? "bg-gray-100 text-gray-600" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
            }`}
          >
            {editando ? "Cancelar edição" : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda */}
        <div className="lg:col-span-1 space-y-4">
          {/* Card header */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-mono text-gray-400 mb-1">{inst.codigo}</p>
                <h1 className="text-base font-bold text-gray-900">
                  {cliente?.razao_social || `Cliente #${inst.cliente_id}`}
                </h1>
                {cliente?.cnpj && <p className="text-xs text-gray-400 mt-0.5">{cliente.cnpj}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {/* Multi-type badges */}
                <div className="flex flex-col items-end gap-1">
                  {(inst.tipos?.length > 0 ? inst.tipos : [inst.tipo]).map((t) => {
                    const td = tiposMap[normalizeTipo(t)];
                    const cor = td?.cor;
                    const label = (inst.tipos_nomes || {})[t] || td?.nome || TIPO_LABEL[t] || t;
                    return (
                      <span key={t}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cor ? "" : (TIPO_COLOR[t] || "bg-gray-100 text-gray-600 border-gray-200")}`}
                        style={cor ? { background: `${cor}22`, color: cor, borderColor: `${cor}55` } : undefined}>
                        {label}
                      </span>
                    );
                  })}
                </div>
                {inst.template_pop_pdf_path && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await templatesApi.visualizarPopTemplate(inst.template_id);
                        const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
                        window.open(url, "_blank");
                        setTimeout(() => URL.revokeObjectURL(url), 60000);
                      } catch {}
                    }}
                    title="Ver POP geral deste tipo de instalação"
                    className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    POP Geral
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[inst.status]}`}>
                {STATUS_LABEL[inst.status]}
              </span>
              {inst.prioridade !== "normal" && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  inst.prioridade === "urgente" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {inst.prioridade === "urgente" ? "Urgente" : "Alta prioridade"}
                </span>
              )}
              {inst.quantidade > 1 && (
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {inst.quantidade} unidades
                </span>
              )}
            </div>

            {/* Progresso */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 font-medium">Progresso</span>
                <span className="text-xs font-bold text-gray-700">{inst.progresso}%</span>
              </div>
              <ProgBar value={inst.progresso} />
              <p className="text-[11px] text-gray-400 mt-1">{concluidos} de {checklist.length} itens concluídos</p>
            </div>

            {/* Timer */}
            <div className="mb-4 pt-3 border-t border-gray-100">
              {!inst.iniciado_em && inst.status !== "concluida" && inst.status !== "cancelada" && (
                <button
                  onClick={handleIniciar}
                  disabled={iniciando}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {iniciando ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  Iniciar Instalação
                </button>
              )}

              {emAndamento && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      <span className="text-xs font-semibold text-orange-700">Em andamento</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-orange-600 tabular-nums">
                      {formatDuration(elapsed)}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowModalFinalizar(true)}
                    disabled={!todasConcluidas}
                    title={!todasConcluidas ? "Conclua todos os itens do checklist primeiro" : "Finalizar instalação"}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {todasConcluidas ? "Finalizar Instalação" : `Finalizar (${concluidos}/${checklist.length} itens)`}
                  </button>
                </div>
              )}

              {inst.finalizado_em && inst.duracao_minutos && (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-semibold text-green-700">Tempo total</span>
                  </div>
                  <span className="text-sm font-bold text-green-700">{formatMinutes(inst.duracao_minutos)}</span>
                </div>
              )}
            </div>

            {/* Responsável — card de perfil com seletor inline */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Responsável</p>
                {!editandoResp && !inst.finalizado_em && (
                  <button
                    type="button"
                    onClick={() => setEditandoResp(true)}
                    className="p-1 rounded text-gray-300 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                    title="Alterar responsável"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>

              {editandoResp ? (
                <div className="flex items-center gap-2">
                  <select
                    autoFocus
                    defaultValue={inst.responsavel_id ?? ""}
                    disabled={savingResp}
                    onChange={(e) => handleSaveResp(e.target.value)}
                    onBlur={() => !savingResp && setEditandoResp(false)}
                    className="flex-1 text-sm border border-orange-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400/20 bg-white"
                  >
                    <option value="">Sem responsável</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                  {savingResp && (
                    <div className="w-4 h-4 rounded-full border-2 border-orange-400 border-t-transparent animate-spin shrink-0" />
                  )}
                </div>
              ) : inst.responsavel_nome ? (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  {responsavelUser?.avatar_url ? (
                    <img
                      src={responsavelUser.avatar_url}
                      alt={inst.responsavel_nome}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarColor(inst.responsavel_nome)}`}>
                      {initials(inst.responsavel_nome)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{inst.responsavel_nome}</p>
                    {responsavelUser?.grupo_nome && (
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{responsavelUser.grupo_nome}</p>
                    )}
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="Ativo" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditandoResp(true)}
                  className="w-full flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 group-hover:bg-orange-100 flex items-center justify-center shrink-0 transition-colors">
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400 group-hover:text-orange-500 italic transition-colors">Atribuir responsável…</p>
                </button>
              )}
            </div>

            {/* Contato no local */}
            {(inst.contato_nome || inst.contato_telefone) && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Contato no local</p>
                <div className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    {inst.contato_nome && (
                      <p className="text-sm font-semibold text-gray-800 leading-tight">{inst.contato_nome}</p>
                    )}
                    {inst.contato_telefone && (
                      <a
                        href={`tel:${inst.contato_telefone.replace(/\D/g, "")}`}
                        className="text-xs text-orange-600 hover:underline mt-0.5 block"
                      >
                        {inst.contato_telefone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Datas */}
            <div className="space-y-2 pt-3 border-t border-gray-100">
              {[
                { label: "Criado em",     value: fmtDateTime(inst.created_at) },
                { label: "Agendado para", value: inst.data_agendada ? fmtDateOnly(inst.data_agendada) : null },
                { label: "Concluído em",  value: inst.finalizado_em
                    ? fmtDateTime(inst.finalizado_em)
                    : inst.data_conclusao
                      ? fmtDateOnly(inst.data_conclusao)
                      : null },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-medium text-gray-700">{value}</span>
                </div>
              ) : null)}
            </div>

            {inst.observacoes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Observações</p>
                <p className="text-sm text-gray-600">{inst.observacoes}</p>
              </div>
            )}
          </div>

          {/* Editar */}
          {editando && (
            <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Editar instalação</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
                  <select value={formEdit.status} onChange={(e) => setFormEdit((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
                    <option value="agendada">Agendada</option>
                    <option value="em_execucao">Em Execução</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Prioridade</label>
                  <select value={formEdit.prioridade} onChange={(e) => setFormEdit((f) => ({ ...f, prioridade: e.target.value }))} className={inputCls}>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Responsável</label>
                  <select value={formEdit.responsavel_id} onChange={(e) => setFormEdit((f) => ({ ...f, responsavel_id: e.target.value }))} className={inputCls}>
                    <option value="">Sem responsável</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data Agendada</label>
                  <input type="date" value={formEdit.data_agendada} onChange={(e) => setFormEdit((f) => ({ ...f, data_agendada: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Observações</label>
                  <textarea value={formEdit.observacoes} rows={3} onChange={(e) => setFormEdit((f) => ({ ...f, observacoes: e.target.value }))} className={`${inputCls} resize-none`} />
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button onClick={handleSaveEdit} disabled={saving}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita */}
        <div className="lg:col-span-2 space-y-4">
          {/* Checklist */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800">Checklist</h2>
              <div className="flex items-center gap-2">
                {inst.finalizado_em && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Finalizada
                  </span>
                )}
                <span className="text-xs text-gray-400">{concluidos}/{checklist.length}</span>
              </div>
            </div>

            {checklist.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhum item no checklist.</p>
            ) : (() => {
              const tipos = inst.tipos?.length > 0 ? inst.tipos : [inst.tipo];
              const isMulti = tipos.length > 1 && checklist.some((i) => i.tipo);
              if (!isMulti) {
                return (
                  <div>
                    {checklist.map((item) => (
                      <ChecklistItem key={item.id} item={item} instId={id}
                        onUpdated={(u) => setInst(u)} onDeleted={(u) => setInst(u)}
                        locked={!inst.iniciado_em || Boolean(inst.finalizado_em)} />
                    ))}
                  </div>
                );
              }
              // Group by tipo, maintaining the order from tipos array
              const grouped = tipos.reduce((acc, t) => {
                acc[t] = checklist.filter((i) => i.tipo === t);
                return acc;
              }, {});
              const ungrouped = checklist.filter((i) => !i.tipo);
              return (
                <div className="space-y-4">
                  {tipos.map((t) => {
                    const items = grouped[t] || [];
                    if (items.length === 0) return null;
                    const done = items.filter((i) => i.status === "concluido").length;
                    const allDone = done === items.length;
                    return (
                      <div key={t}>
                        <div className={`flex items-center gap-2 mb-2 px-1 pb-1.5 border-b ${allDone ? "border-green-100" : "border-gray-100"}`}>
                          {(() => {
                            const td2 = tiposMap[normalizeTipo(t)];
                            const cor2 = td2?.cor;
                            const label2 = (inst.tipos_nomes || {})[t] || td2?.nome || TIPO_LABEL[t] || t;
                            return (
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cor2 ? "" : (TIPO_COLOR[t] || "bg-gray-100 text-gray-600 border-gray-200")}`}
                                style={cor2 ? { background: `${cor2}22`, color: cor2, borderColor: `${cor2}55` } : undefined}>
                                {label2}
                              </span>
                            );
                          })()}
                          <span className={`text-[11px] font-medium ${allDone ? "text-green-500" : "text-gray-400"}`}>
                            {done}/{items.length}
                          </span>
                          {allDone && (
                            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {items.map((item) => (
                          <ChecklistItem key={item.id} item={item} instId={id}
                            onUpdated={(u) => setInst(u)} onDeleted={(u) => setInst(u)}
                            locked={!inst.iniciado_em || Boolean(inst.finalizado_em)} />
                        ))}
                      </div>
                    );
                  })}
                  {ungrouped.length > 0 && (
                    <div>
                      {ungrouped.map((item) => (
                        <ChecklistItem key={item.id} item={item} instId={id}
                          onUpdated={(u) => setInst(u)} onDeleted={(u) => setInst(u)}
                          locked={!inst.iniciado_em || Boolean(inst.finalizado_em)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Adicionar item */}
            {!inst.finalizado_em && (
              <form onSubmit={handleAddItem} className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <input
                  type="text"
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  placeholder="Adicionar item ao checklist…"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-400 transition"
                />
                <button type="submit" disabled={addingItem || !novoItem.trim()}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors">
                  {addingItem ? "…" : "+ Adicionar"}
                </button>
              </form>
            )}
          </div>

          {/* Comentários */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Comentários</h2>

            {(inst.comentarios || []).length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Nenhum comentário ainda.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {inst.comentarios.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-orange-600">{c.usuario.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-gray-700">{c.usuario}</span>
                        <span className="text-[10px] text-gray-400">
                          {fmtDateTime(c.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{c.conteudo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleComentario} className="flex items-start gap-2">
              <textarea
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                placeholder="Escreva um comentário…"
                rows={2}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400 transition resize-none"
              />
              <button type="submit" disabled={sendingComentario || !novoComentario.trim()}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors">
                {sendingComentario ? "…" : "Enviar"}
              </button>
            </form>
          </div>

          {/* Anexos */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-800">Anexos</h2>
                {(inst.anexos || []).length > 0 && (
                  <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {inst.anexos.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 transition-colors"
              >
                {uploading ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                {uploading ? "Enviando…" : "Anexar arquivo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUploadAnexo}
              />
            </div>

            {uploadError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{uploadError}</p>
            )}

            {(inst.anexos || []).length === 0 ? (
              <p className="text-sm text-gray-400 py-2 text-center">Nenhum arquivo anexado.</p>
            ) : (
              <div className="space-y-2">
                {inst.anexos.map((anexo) => (
                  <div key={anexo.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                    <span className="text-lg shrink-0">{fileIcon(anexo.content_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{anexo.filename}</p>
                      <p className="text-[10px] text-gray-400">
                        {fmtBytes(anexo.tamanho_bytes)}
                        {anexo.tamanho_bytes ? " · " : ""}
                        {fmtDateTime(anexo.created_at)}
                        {anexo.uploaded_by ? ` · ${anexo.uploaded_by}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleDownloadAnexo(anexo)}
                        title="Baixar"
                        className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnexo(anexo)}
                        title="Remover"
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
