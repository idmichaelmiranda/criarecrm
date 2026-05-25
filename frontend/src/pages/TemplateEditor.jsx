import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { templatesApi } from "../services/api";

// ── Color palette ─────────────────────────────────────────────────────────────

const COLORS = [
  "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899",
  "#06b6d4", "#10b981", "#6366f1", "#ef4444",
  "#f97316", "#84cc16", "#14b8a6", "#a855f7",
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 py-1">
      {COLORS.map((c) => {
        const selected = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className="relative w-7 h-7 rounded-full transition-all duration-150 focus:outline-none hover:scale-110"
            style={{
              backgroundColor: c,
              transform: selected ? "scale(1.2)" : undefined,
              boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "0 1px 3px rgba(0,0,0,.15)",
            }}
          >
            {selected && (
              <svg
                className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow-sm"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Grip icon ─────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor" className="shrink-0">
      <circle cx="3" cy="2"  r="1.4" /><circle cx="7" cy="2"  r="1.4" />
      <circle cx="3" cy="7"  r="1.4" /><circle cx="7" cy="7"  r="1.4" />
      <circle cx="3" cy="12" r="1.4" /><circle cx="7" cy="12" r="1.4" />
    </svg>
  );
}

// ── POP Geral ─────────────────────────────────────────────────────────────────

function PopGeral({ templateId, popPath, onUpdated }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing,  setRemoving]  = useState(false);
  const [error,     setError]     = useState("");

  const hasPop   = Boolean(popPath);
  const fileName = hasPop ? popPath.split(/[\\/]/).pop() : null;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    try {
      const { data } = await templatesApi.uploadPopTemplate(templateId, file);
      onUpdated(data.pop_pdf_path);
    } catch (err) {
      setError(err.message || "Erro ao enviar POP");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleView() {
    try {
      const res = await templatesApi.visualizarPopTemplate(templateId);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {}
  }

  async function handleRemove() {
    setRemoving(true); setError("");
    try {
      await templatesApi.deletarPopTemplate(templateId);
      onUpdated(null);
    } catch (err) {
      setError(err.message || "Erro ao remover POP");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-2">POP Geral</label>
      {hasPop ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleView} title={`Ver POP: ${fileName}`}
            className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-semibold transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {fileName}
          </button>
          <button type="button" onClick={handleRemove} disabled={removing}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
            {removing
              ? <span className="w-3.5 h-3.5 rounded-full border border-gray-300 border-t-transparent animate-spin block" />
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            }
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || !templateId}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 border border-dashed border-gray-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40">
          {uploading
            ? <span className="w-3.5 h-3.5 rounded-full border border-blue-300 border-t-transparent animate-spin block" />
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          }
          Anexar POP geral
        </button>
      )}
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Tarefa row ────────────────────────────────────────────────────────────────

function TarefaRow({ tarefa, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  const fileRef                   = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing,  setRemoving]  = useState(false);
  const [popError,  setPopError]  = useState("");

  const hasPop   = Boolean(tarefa.pop_pdf_path);
  const isSaved  = Boolean(tarefa.id);
  const fileName = hasPop ? tarefa.pop_pdf_path.split(/[\\/]/).pop() : null;

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setPopError("");
    try {
      const { data } = await templatesApi.uploadPop(tarefa.id, file);
      onUpdate({ ...tarefa, pop_pdf_path: data.pop_pdf_path });
    } catch (err) {
      setPopError(err.message || "Erro ao enviar POP");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleViewPop() {
    try {
      const res = await templatesApi.visualizarPop(tarefa.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {}
  }

  async function handleRemovePop() {
    setRemoving(true); setPopError("");
    try {
      await templatesApi.deletarPop(tarefa.id);
      onUpdate({ ...tarefa, pop_pdf_path: null });
    } catch (err) {
      setPopError(err.message || "Erro ao remover POP");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="group flex flex-col">
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">

        {/* Drag grip */}
        <span className="text-gray-300 group-hover:text-gray-400 transition-colors cursor-grab active:cursor-grabbing shrink-0">
          <GripIcon />
        </span>

        {/* Obrigatória checkbox */}
        <input
          type="checkbox"
          checked={tarefa.obrigatoria}
          onChange={(e) => onUpdate({ ...tarefa, obrigatoria: e.target.checked })}
          className="w-3.5 h-3.5 accent-orange-500 shrink-0 cursor-pointer"
          title="Tarefa obrigatória"
        />

        {/* Título */}
        <input
          type="text"
          value={tarefa.titulo}
          onChange={(e) => onUpdate({ ...tarefa, titulo: e.target.value })}
          placeholder="Descreva a tarefa..."
          className="flex-1 text-sm bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:outline-none py-0.5 text-gray-800 placeholder-gray-300 transition-colors"
        />

        {/* Reorder buttons — aparecem no hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            title="Mover para cima"
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            title="Mover para baixo"
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* POP */}
        {isSaved && (
          hasPop ? (
            <div className="flex items-center gap-0.5 shrink-0">
              <button type="button" onClick={handleViewPop} title={`Ver: ${fileName}`}
                className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 transition-colors">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                POP
              </button>
              <button type="button" onClick={handleRemovePop} disabled={removing} title="Remover POP"
                className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-500 transition-all">
                {removing
                  ? <span className="w-3 h-3 rounded-full border border-gray-300 border-t-transparent animate-spin block" />
                  : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                }
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              title="Anexar POP (PDF)"
              className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-blue-500 transition-all shrink-0">
              {uploading
                ? <span className="w-3 h-3 rounded-full border border-blue-300 border-t-transparent animate-spin block" />
                : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              }
              POP
            </button>
          )
        )}

        {/* Delete */}
        <button type="button" onClick={onDelete}
          title="Remover tarefa"
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {popError && <p className="text-[10px] text-red-500 ml-10 -mt-0.5">{popError}</p>}
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ── Etapa card ────────────────────────────────────────────────────────────────

function EtapaCard({ etapa, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  const [open, setOpen] = useState(true);

  function addTarefa() {
    onUpdate({
      ...etapa,
      tarefas: [
        ...etapa.tarefas,
        { _key: Date.now(), id: null, titulo: "", obrigatoria: true, ordem: etapa.tarefas.length + 1 },
      ],
    });
  }

  function updateTarefa(idx, updated) {
    const tarefas = [...etapa.tarefas];
    tarefas[idx] = updated;
    onUpdate({ ...etapa, tarefas });
  }

  function deleteTarefa(idx) {
    const t = etapa.tarefas[idx];
    onUpdate({
      ...etapa,
      tarefas: etapa.tarefas.filter((_, i) => i !== idx),
      _deletedTarefaIds: [...(etapa._deletedTarefaIds || []), ...(t.id ? [t.id] : [])],
    });
  }

  function moveTarefa(idx, dir) {
    const tarefas = [...etapa.tarefas];
    const target = idx + dir;
    if (target < 0 || target >= tarefas.length) return;
    [tarefas[idx], tarefas[target]] = [tarefas[target], tarefas[idx]];
    onUpdate({ ...etapa, tarefas: tarefas.map((t, i) => ({ ...t, ordem: i + 1 })) });
  }

  const cor = etapa.cor || "#6366f1";
  const tarefaCount = etapa.tarefas.length;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">

      {/* ── Etapa header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 select-none"
        style={{ background: `${cor}12`, borderBottom: open ? `1px solid ${cor}25` : "none" }}
      >
        {/* Color dot + picker toggle */}
        <div className="w-4 h-4 rounded-full shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: cor }} />

        {/* Nome */}
        <input
          type="text"
          value={etapa.nome}
          onChange={(e) => onUpdate({ ...etapa, nome: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Nome da etapa..."
          className="flex-1 font-semibold text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-400 focus:outline-none text-gray-800 placeholder-gray-400 transition-colors"
        />

        {/* Task count badge */}
        {tarefaCount > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: `${cor}20`, color: cor }}>
            {tarefaCount} tarefa{tarefaCount !== 1 ? "s" : ""}
          </span>
        )}

        {/* SLA */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-gray-400">SLA</span>
          <input
            type="number" min={1} max={90}
            value={etapa.sla_dias}
            onChange={(e) => onUpdate({ ...etapa, sla_dias: parseInt(e.target.value) || 1 })}
            onClick={(e) => e.stopPropagation()}
            className="w-10 text-xs text-center border border-gray-200 rounded-md px-1 py-0.5 focus:outline-none focus:border-orange-400 bg-white"
          />
          <span className="text-xs text-gray-400">d</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            title="Mover etapa para cima"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-white/70 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            title="Mover etapa para baixo"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-white/70 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button type="button" onClick={onDelete}
            title="Remover etapa"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button type="button" onClick={() => setOpen((v) => !v)}
            title={open ? "Recolher" : "Expandir"}
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/70 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Etapa body ── */}
      {open && (
        <div className="px-4 pb-3 pt-3 bg-white">

          {/* Color picker — dentro do corpo, clara e acessível */}
          <div className="mb-3 pb-3 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Cor da etapa</p>
            <ColorPicker value={etapa.cor} onChange={(c) => onUpdate({ ...etapa, cor: c })} />
          </div>

          {/* Tarefas */}
          {tarefaCount === 0 ? (
            <p className="text-xs text-gray-300 italic py-1 mb-2">Nenhuma tarefa. Adicione abaixo.</p>
          ) : (
            <div className="space-y-0.5 mb-1">
              {etapa.tarefas.map((t, ti) => (
                <TarefaRow
                  key={t._key ?? t.id}
                  tarefa={t}
                  index={ti}
                  total={tarefaCount}
                  onUpdate={(updated) => updateTarefa(ti, updated)}
                  onDelete={() => deleteTarefa(ti)}
                  onMoveUp={() => moveTarefa(ti, -1)}
                  onMoveDown={() => moveTarefa(ti, 1)}
                />
              ))}
            </div>
          )}

          <button type="button" onClick={addTarefa}
            className="mt-1 flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors py-1 px-2 rounded-lg hover:bg-orange-50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar tarefa
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE = {
  nome: "", descricao: "", tipo: "", sla_total_dias: 30, ativo: true, pop_pdf_path: null,
};

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "novo";

  const [header, setHeader]               = useState(DEFAULT_TEMPLATE);
  const [etapas, setEtapas]               = useState([]);
  const [deletedEtapaIds, setDeletedEtapaIds] = useState([]);
  const [loading, setLoading]             = useState(!isNew);
  const [saving,  setSaving]              = useState(false);
  const [error,   setError]               = useState("");

  useEffect(() => {
    if (isNew) return;
    templatesApi.obter(id)
      .then(({ data }) => {
        setHeader({
          nome: data.nome, descricao: data.descricao || "",
          tipo: data.tipo || "", sla_total_dias: data.sla_total_dias,
          ativo: data.ativo, pop_pdf_path: data.pop_pdf_path || null,
        });
        setEtapas(data.etapas.map((e) => ({
          ...e,
          _deletedTarefaIds: [],
          tarefas: e.tarefas.map((t) => ({ ...t, _key: t.id })),
        })));
      })
      .catch(() => setError("Erro ao carregar template."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function addEtapa() {
    setEtapas((prev) => [
      ...prev,
      {
        _key: Date.now(), id: null,
        nome: "", ordem: prev.length + 1,
        sla_dias: 3, cor: COLORS[prev.length % COLORS.length],
        tarefas: [], _deletedTarefaIds: [],
      },
    ]);
  }

  function updateEtapa(idx, updated) {
    setEtapas((prev) => { const a = [...prev]; a[idx] = updated; return a; });
  }

  function deleteEtapa(idx) {
    const e = etapas[idx];
    if (e.id) setDeletedEtapaIds((prev) => [...prev, e.id]);
    setEtapas((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveEtapa(idx, dir) {
    setEtapas((prev) => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((e, i) => ({ ...e, ordem: i + 1 }));
    });
  }

  async function handleSave() {
    if (!header.nome.trim()) { setError("Informe o nome do template."); return; }
    setSaving(true); setError("");
    try {
      let templateId = isNew ? null : parseInt(id);

      if (isNew) {
        const { data: t } = await templatesApi.criar({
          nome: header.nome, descricao: header.descricao || null,
          tipo: header.tipo || null, sla_total_dias: header.sla_total_dias, ativo: header.ativo,
        });
        templateId = t.id;
      } else {
        await templatesApi.atualizar(templateId, {
          nome: header.nome, descricao: header.descricao || null,
          tipo: header.tipo || null, sla_total_dias: header.sla_total_dias, ativo: header.ativo,
        });
      }

      for (const eid of deletedEtapaIds) await templatesApi.deletarEtapa(eid);

      for (let i = 0; i < etapas.length; i++) {
        const etapa = { ...etapas[i], ordem: i + 1 };
        let etapaId = etapa.id;

        if (!etapaId) {
          const { data: e } = await templatesApi.adicionarEtapa(templateId, {
            nome: etapa.nome || "Nova Etapa", ordem: etapa.ordem, sla_dias: etapa.sla_dias, cor: etapa.cor,
          });
          etapaId = e.id;
        } else {
          await templatesApi.atualizarEtapa(etapaId, {
            nome: etapa.nome, ordem: etapa.ordem, sla_dias: etapa.sla_dias, cor: etapa.cor,
          });
        }

        for (const tid of etapa._deletedTarefaIds || []) await templatesApi.deletarTarefa(tid);

        for (let j = 0; j < etapa.tarefas.length; j++) {
          const tarefa = { ...etapa.tarefas[j], ordem: j + 1 };
          if (!tarefa.titulo.trim()) continue;
          if (!tarefa.id) {
            await templatesApi.adicionarTarefa(etapaId, {
              titulo: tarefa.titulo, obrigatoria: tarefa.obrigatoria, ordem: tarefa.ordem,
            });
          } else {
            await templatesApi.atualizarTarefa(tarefa.id, {
              titulo: tarefa.titulo, obrigatoria: tarefa.obrigatoria, ordem: tarefa.ordem,
            });
          }
        }
      }

      navigate("/admin/templates");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <div className="w-7 h-7 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  const isInstalacaoTemplate = header.tipo?.startsWith("instalacao_");
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition";
  const totalTarefas = etapas.reduce((s, e) => s + e.tarefas.length, 0);

  return (
    <Layout>
      {/* ── Topbar ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate("/admin/templates")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Templates
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-semibold">{isNew ? "Novo Template" : (header.nome || "Editar Template")}</span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/templates")}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-sm">
            {saving && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            {saving ? "Salvando…" : isNew ? "Criar Template" : "Salvar Alterações"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

        {/* ── Painel esquerdo: informações ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sticky top-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-4">Informações do Template</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nome *</label>
                <input type="text" value={header.nome}
                  onChange={(e) => setHeader((h) => ({ ...h, nome: e.target.value }))}
                  placeholder="Ex: ERP Varejo"
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Descrição</label>
                <textarea value={header.descricao}
                  onChange={(e) => setHeader((h) => ({ ...h, descricao: e.target.value }))}
                  rows={2} placeholder="Descreva o template…"
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Tipo — read-only para instalação */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tipo</label>
                {isInstalacaoTemplate ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-bold shrink-0">Instalação</span>
                    <span className="text-xs text-gray-500 font-mono truncate">{header.tipo}</span>
                  </div>
                ) : (
                  <input type="text" value={header.tipo}
                    onChange={(e) => setHeader((h) => ({ ...h, tipo: e.target.value }))}
                    placeholder="Ex: erp, restaurante, industria"
                    className={inputCls} />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">SLA Total (dias)</label>
                <input type="number" min={1} max={365} value={header.sla_total_dias}
                  onChange={(e) => setHeader((h) => ({ ...h, sla_total_dias: parseInt(e.target.value) || 30 }))}
                  className={inputCls} />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input type="checkbox" checked={header.ativo}
                  onChange={(e) => setHeader((h) => ({ ...h, ativo: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-gray-700">Template ativo</span>
              </label>

              {!isNew && (
                <div className="pt-1 border-t border-gray-100">
                  <PopGeral
                    templateId={parseInt(id)}
                    popPath={header.pop_pdf_path}
                    onUpdated={(path) => setHeader((h) => ({ ...h, pop_pdf_path: path }))}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="pt-3 border-t border-gray-100 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Checkbox marcado = tarefa obrigatória
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <GripIcon />
              Arraste ou use ↑↓ para reordenar
            </div>
          </div>
        </div>

        {/* ── Painel direito: pipeline ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Pipeline de Etapas</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {etapas.length} etapa{etapas.length !== 1 ? "s" : ""}
                {totalTarefas > 0 && ` · ${totalTarefas} tarefa${totalTarefas !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {etapas.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600">Nenhuma etapa configurada</p>
              <p className="text-xs text-gray-400 mt-1">Clique em Adicionar Etapa para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {etapas.map((etapa, idx) => (
                <EtapaCard
                  key={etapa._key ?? etapa.id}
                  etapa={etapa}
                  index={idx}
                  total={etapas.length}
                  onUpdate={(updated) => updateEtapa(idx, updated)}
                  onDelete={() => deleteEtapa(idx)}
                  onMoveUp={() => moveEtapa(idx, -1)}
                  onMoveDown={() => moveEtapa(idx, 1)}
                />
              ))}
            </div>
          )}

          <button type="button" onClick={addEtapa}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50/30 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Etapa
          </button>
        </div>
      </div>
    </Layout>
  );
}
