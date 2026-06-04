import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { Badge, PrioridadeBadge } from "../components/ui/Badge";
import { implantacoesApi, clientesApi, usuariosApi, templatesApi } from "../services/api";
import { fmtDate, fmtDateTime } from "../utils/dateUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds parent_id → [sub_items] index from the flat checklist.
 * Mirrors backend _build_subs_index exactly.
 */
function buildSubsIndex(checklist) {
  const idx = {};
  for (const item of checklist || []) {
    if (item.parent_id) {
      (idx[item.parent_id] = idx[item.parent_id] || []).push(item);
    }
  }
  return idx;
}

/**
 * Leaf-item progress: if a root item has non-archived sub-items, count those;
 * otherwise count the root item. Matches backend _leaf_counts logic exactly.
 * subsIndex: result of buildSubsIndex(impl.checklist) — preferred over item.subitens
 * because self-referential selectinload may not always populate subitens in the ORM chain.
 */
function leafProgress(rootItems, subsIndex) {
  let total = 0, done = 0;
  for (const item of rootItems) {
    if (item.arquivado) continue;
    const subs = (subsIndex && subsIndex[item.id]) || item.subitens || [];
    const activeSubs = subs.filter(
      (s) => !s.arquivado && s.status !== "nao_aplicavel"
    );
    if (activeSubs.length > 0) {
      total += activeSubs.length;
      done  += activeSubs.filter((s) => s.status === "concluido").length;
    } else if (item.status !== "nao_aplicavel") {
      total += 1;
      if (item.status === "concluido") done += 1;
    }
  }
  return { total, done };
}

function getInitials(name) {
  if (!name) return null;
  return name.trim().split(/\s+/).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
}

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Math.round((date - today) / 86400000);
}

function prazoLabel(days) {
  if (days === null) return "";
  if (days < 0) return `${Math.abs(days)}d atr.`;
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `${days}d`;
}

function prazoClasses(days) {
  if (days === null) return "";
  if (days < 0) return "bg-red-50 text-red-600 border-red-200";
  if (days <= 1) return "bg-amber-50 text-amber-600 border-amber-200";
  return "bg-green-50 text-green-600 border-green-200";
}

function slaEtapaLabel(data_inicio, sla_dias) {
  if (!data_inicio) return null;
  const start = new Date(data_inicio);
  const deadline = new Date(start.getTime() + sla_dias * 86400000);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((deadline - today) / 86400000);
  return daysLeft;
}

// ── Field / Spinner ───────────────────────────────────────────────────────────

function Field({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 ${mono ? "font-mono text-xs" : ""}`}>
        {value || <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
    </div>
  );
}

// ── Pipeline Ring ─────────────────────────────────────────────────────────────

function PipelineRing({ etapa, subsIndex }) {
  const { total, done } = leafProgress(etapa.itens, subsIndex);
  const pct    = total > 0 ? done / total : 0;
  const allDone = total > 0 && done === total;

  if (etapa.status === "pulada") {
    return (
      <div className="w-9 h-9 rounded-full bg-gray-100 ring-2 ring-gray-200 flex items-center justify-center">
        <span className="text-gray-400 text-xs font-medium">→</span>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="w-9 h-9 rounded-full bg-green-500 ring-2 ring-green-400 flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-sm leading-none">✓</span>
      </div>
    );
  }

  const SIZE   = 36;
  const STROKE = 3.5;
  const R      = SIZE / 2 - STROKE;
  const C      = 2 * Math.PI * R;
  const isActive = etapa.status === "em_andamento";

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }} className="absolute inset-0">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="white" stroke="#e5e7eb" strokeWidth={STROKE} />
        {pct > 0 && (
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#22c55e" strokeWidth={STROKE}
            strokeDasharray={`${pct * C} ${C}`} strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`block rounded-full transition-colors ${
          isActive ? "w-2.5 h-2.5 bg-blue-500" : pct > 0 ? "w-2 h-2 bg-green-400" : "w-2 h-2 bg-gray-300"
        }`} />
      </div>
    </div>
  );
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

function Pipeline({ etapas, subsIndex, onEtapaClick, onAddEtapa, onRenameEtapa }) {
  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const [editingId, setEditingId] = useState(null);
  const [editNome, setEditNome]   = useState("");
  const [saving, setSaving]       = useState(false);

  function startEdit(etapa, e) {
    e.stopPropagation();
    setEditingId(etapa.id);
    setEditNome(etapa.nome);
  }

  async function commitEdit() {
    if (!editNome.trim() || saving) { setEditingId(null); return; }
    setSaving(true);
    try { await onRenameEtapa(editingId, editNome.trim()); }
    catch { } finally { setSaving(false); setEditingId(null); }
  }

  return (
    <div className="overflow-x-auto overflow-y-visible -mx-2 px-2">
      <div className="flex items-start gap-0 pt-2 pb-3">
        {sorted.map((etapa, idx) => {
          const { total, done } = leafProgress(etapa.itens, subsIndex);
          const allDone   = total > 0 && done === total;
          const isLast    = idx === sorted.length - 1;
          const isEditing = editingId === etapa.id;

          return (
            <div key={etapa.id} className="flex items-center">
              <div className="flex flex-col items-center gap-2 min-w-[84px] group">
                <button
                  onClick={() => !isEditing && onEtapaClick(etapa.id)}
                  title={`${etapa.nome} — ${done}/${total} tarefas`}
                  className="transition-transform duration-150 group-hover:scale-110 group-hover:drop-shadow-md focus:outline-none"
                >
                  <PipelineRing etapa={etapa} subsIndex={subsIndex} />
                </button>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="text-[10px] w-[76px] text-center border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                  />
                ) : (
                  <button
                    onClick={() => onEtapaClick(etapa.id)}
                    onDoubleClick={(e) => startEdit(etapa, e)}
                    title={`${etapa.nome} · Duplo clique para renomear`}
                    className="text-[10px] font-medium text-gray-500 text-center leading-tight max-w-[76px] hover:text-orange-500 transition-colors"
                  >
                    {etapa.nome}
                  </button>
                )}
              </div>
              {!isLast && (
                <div className={`w-8 h-0.5 mb-6 shrink-0 ${allDone ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}

        {/* "+" ring ao final da pipeline */}
        <div className="flex items-center">
          <div className="w-6 h-0.5 mb-6 shrink-0 bg-gray-100" />
          <button
            onClick={onAddEtapa}
            title="Adicionar nova etapa"
            className="flex flex-col items-center gap-2 min-w-[60px] focus:outline-none group/add mb-4"
          >
            <div className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 group-hover/add:border-orange-400 group-hover/add:text-orange-500 group-hover/add:bg-orange-50 transition-all">
              <span className="text-lg leading-none font-light">+</span>
            </div>
            <p className="text-[10px] text-gray-400 group-hover/add:text-orange-500 transition-colors">Nova</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Etapa Dropdown ────────────────────────────────────────────────────────────

function EtapaDropdown({ status, onAction, onClose, onEdit, onMoveLeft, onMoveRight, onDelete, isFirst, isLast }) {
  const statusOpts = [
    { v: "em_andamento", label: "▶  Iniciar",               show: status !== "em_andamento" },
    { v: "concluida",    label: "✓  Marcar como Concluída",  show: status !== "concluida"    },
    { v: "pulada",       label: "→  Pular Etapa",            show: status !== "pulada"       },
    { v: "pendente",     label: "↺  Reabrir",                show: ["concluida", "pulada", "bloqueada"].includes(status) },
  ].filter((o) => o.show);

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-8 z-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[210px]">
        {statusOpts.map((o) => (
          <button key={o.v} onClick={() => { onAction(o.v); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors">
            {o.label}
          </button>
        ))}
        {statusOpts.length > 0 && <div className="my-1 border-t border-gray-100" />}
        <button onClick={() => { onEdit(); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
          ✏️  Editar etapa
        </button>
        {!isFirst && (
          <button onClick={() => { onMoveLeft(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            ← Mover para esquerda
          </button>
        )}
        {!isLast && (
          <button onClick={() => { onMoveRight(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            → Mover para direita
          </button>
        )}
        <div className="my-1 border-t border-gray-100" />
        <button onClick={() => { onDelete(); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
          🗑  Remover etapa
        </button>
      </div>
    </>
  );
}

// ── Edit Etapa Modal ──────────────────────────────────────────────────────────

const ETAPA_CORES = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f97316", "#64748b",
];

function EditEtapaModal({ etapa, implId, onClose, onSaved }) {
  const [nome, setNome]       = useState(etapa.nome);
  const [cor, setCor]         = useState(etapa.cor || "#6366f1");
  const [slaDias, setSlaDias] = useState(etapa.sla_dias || 3);
  const [saving, setSaving]   = useState(false);

  async function handleSave() {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      await implantacoesApi.atualizarEtapa(implId, etapa.id, { nome: nome.trim(), cor, sla_dias: slaDias });
      onSaved();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Editar Etapa</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nome da etapa</label>
            <input
              autoFocus
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {ETAPA_CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${cor === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">SLA da etapa (dias)</label>
            <input
              type="number"
              min={1}
              max={999}
              value={slaDias}
              onChange={(e) => setSlaDias(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !nome.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-item Row ──────────────────────────────────────────────────────────────

function SubItemRow({ sub, implId, onRefresh, onOptimisticToggle }) {
  const [toggling, setToggling]         = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editValue, setEditValue]       = useState(sub.titulo);
  const [localDone, setLocalDone]       = useState(sub.status === "concluido");

  useEffect(() => { setLocalDone(sub.status === "concluido"); }, [sub.status]);

  const isDone = localDone;

  async function handleToggle() {
    if (toggling) return;
    const newDone = !isDone;
    const newStatus = newDone ? "concluido" : "pendente";
    setLocalDone(newDone);
    onOptimisticToggle?.(sub.id, newStatus);
    setToggling(true);
    try {
      await implantacoesApi.atualizarChecklist(sub.id, { status: newStatus });
    } catch {
      setLocalDone(isDone);
      onOptimisticToggle?.(sub.id, sub.status);
    }
    finally { setToggling(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Remover "${sub.titulo}"?`)) return;
    try {
      await implantacoesApi.deletarChecklist(sub.id);
      onRefresh();
    } catch { }
  }

  async function handleArchive() {
    try {
      await implantacoesApi.atualizarChecklist(sub.id, { arquivado: !sub.arquivado });
      onRefresh();
    } catch { }
  }

  async function handleSaveTitle() {
    const trimmed = editValue.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === sub.titulo) return;
    try {
      await implantacoesApi.atualizarChecklist(sub.id, { titulo: trimmed });
      onRefresh();
    } catch { setEditValue(sub.titulo); }
  }

  return (
    <div className={`flex items-center gap-2 py-1 group/sub ${sub.arquivado ? "opacity-50" : ""}`}>
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center transition-all
          ${isDone ? "bg-orange-500 border-orange-500" : "border-gray-300 hover:border-orange-400"}`}
      >
        {isDone && <span className="text-white text-[7px] font-bold leading-none">✓</span>}
      </button>
      {editingTitle ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveTitle();
            if (e.key === "Escape") { setEditingTitle(false); setEditValue(sub.titulo); }
          }}
          className="flex-1 text-xs border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white text-gray-700"
        />
      ) : (
        <span
          onDoubleClick={() => { if (!isDone) { setEditingTitle(true); setEditValue(sub.titulo); } }}
          title={!isDone ? "Duplo clique para renomear" : undefined}
          className={`flex-1 text-xs leading-snug ${isDone ? "line-through text-gray-400" : "text-gray-600 cursor-text"}`}
        >
          {sub.titulo}
        </span>
      )}
      <button
        onClick={handleArchive}
        title={sub.arquivado ? "Desarquivar" : "Arquivar"}
        className={`opacity-0 group-hover/sub:opacity-100 w-4 h-4 rounded flex items-center justify-center transition-all text-[10px]
          ${sub.arquivado ? "opacity-100 text-amber-400 hover:bg-amber-50" : "text-gray-400 hover:text-amber-400 hover:bg-amber-50"}`}
      >
        📦
      </button>
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover/sub:opacity-100 w-4 h-4 rounded flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-50 transition-all text-[10px]"
      >
        ✕
      </button>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({ item, implId, etapaId, usuarios, onRefresh, onOptimisticToggle, isDragged, onDragStart, onDragEnd, onMoveUp, onMoveDown }) {
  const [hovered, setHovered]         = useState(false);
  const [showNote, setShowNote]       = useState(false);
  const [noteText, setNoteText]       = useState(item.descricao || "");
  const [savingNote, setSavingNote]   = useState(false);
  const [toggling, setToggling]       = useState(false);
  const [showRespPicker, setShowRespPicker] = useState(false);
  const [editingPrazo, setEditingPrazo]     = useState(false);
  const [prazoInput, setPrazoInput]         = useState((item.data_prazo || "").split("T")[0]);
  const [showSubitens, setShowSubitens]     = useState(false);
  const [newSubTitle, setNewSubTitle]       = useState("");
  const [addingSub, setAddingSub]           = useState(false);
  const [showAddSub, setShowAddSub]         = useState(false);
  const [editingTitle, setEditingTitle]     = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(item.titulo);
  const [localStatus, setLocalStatus]       = useState(item.status);
  const [showArchivedSubs, setShowArchivedSubs] = useState(false);

  // Sync local status when parent data refreshes
  useEffect(() => { setLocalStatus(item.status); }, [item.status]);

  const isCustom  = item.template_tarefa_id == null;
  const isNA      = localStatus === "nao_aplicavel";
  const isDone    = localStatus === "concluido";
  const initials  = getInitials(item.responsavel);
  const days      = item.data_prazo ? daysDiff(item.data_prazo) : null;
  const allSubitens    = item.subitens || [];
  const subitens       = allSubitens.filter((s) => !s.arquivado);
  const archivedSubs   = allSubitens.filter((s) => s.arquivado);
  const subDone        = subitens.filter((s) => s.status === "concluido").length;

  async function handleSaveTitle() {
    const trimmed = editTitleValue.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === item.titulo) return;
    try {
      await implantacoesApi.atualizarChecklist(item.id, { titulo: trimmed });
      onRefresh();
    } catch { setEditTitleValue(item.titulo); }
  }

  async function handleArchive() {
    const novo = !item.arquivado;
    try {
      await implantacoesApi.atualizarChecklist(item.id, { arquivado: novo });
      onRefresh();
    } catch { }
  }

  async function handleAddSub() {
    if (!newSubTitle.trim() || addingSub) return;
    setAddingSub(true);
    try {
      await implantacoesApi.criarSubitem(implId, item.id, { titulo: newSubTitle.trim() });
      setNewSubTitle("");
      setShowAddSub(false);
      setShowSubitens(true);
      onRefresh();
    } catch { } finally { setAddingSub(false); }
  }

  async function handleToggle() {
    if (isNA || toggling) return;
    const newStatus = isDone ? "pendente" : "concluido";
    setLocalStatus(newStatus);
    onOptimisticToggle?.(item.id, newStatus);
    setToggling(true);
    try {
      await implantacoesApi.atualizarChecklist(item.id, { status: newStatus });
    } catch {
      setLocalStatus(item.status);
      onOptimisticToggle?.(item.id, item.status);
    }
    finally { setToggling(false); }
  }

  async function handleToggleNA() {
    const newStatus = isNA ? "pendente" : "nao_aplicavel";
    setLocalStatus(newStatus);
    onOptimisticToggle?.(item.id, newStatus);
    try {
      await implantacoesApi.atualizarChecklist(item.id, { status: newStatus });
    } catch {
      setLocalStatus(item.status);
      onOptimisticToggle?.(item.id, item.status);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remover "${item.titulo}"?`)) return;
    try {
      await implantacoesApi.deletarChecklist(item.id);
      onRefresh();
    } catch { }
  }

  async function handleSaveNote() {
    setSavingNote(true);
    try {
      await implantacoesApi.atualizarChecklist(item.id, { descricao: noteText });
      onRefresh();
      setShowNote(false);
    } catch { } finally { setSavingNote(false); }
  }

  async function handleSelectResp(nome, id = null) {
    setShowRespPicker(false);
    try {
      await implantacoesApi.atualizarChecklist(item.id, { responsavel: nome, responsavel_id: id });
      onRefresh();
    } catch { }
  }

  async function handleVerPop() {
    if (!item.template_tarefa_id) return;
    try {
      const res = await templatesApi.visualizarPop(item.template_tarefa_id);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { }
  }

  async function handleSavePrazo() {
    try {
      await implantacoesApi.atualizarChecklist(item.id, { data_prazo: prazoInput || null });
      setEditingPrazo(false);
      onRefresh();
    } catch { }
  }

  const showMeta = item.responsavel || item.data_prazo || (hovered && !isDone && !isNA);

  return (
    <div
      draggable={!isNA}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => onDragStart({ id: item.id, sourceEtapaId: etapaId }), 0);
      }}
      onDragEnd={onDragEnd}
      className={`rounded-xl border shadow-sm transition-all select-none
        ${!isNA && !item.arquivado ? "cursor-grab active:cursor-grabbing" : ""}
        ${isDragged ? "opacity-40 scale-95" : ""}
        ${item.arquivado
          ? "bg-gray-50 border-gray-200 opacity-50"
          : isNA
          ? "bg-gray-50 border-gray-100 opacity-60"
          : isDone
          ? "bg-white border-gray-100 opacity-60"
          : hovered
          ? "bg-white border-orange-200 shadow-md"
          : "bg-white border-gray-100"
        }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Checkbox */}
          <button
            onClick={handleToggle}
            disabled={toggling || isNA}
            className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all
              ${isDone
                ? "bg-orange-500 border-orange-500"
                : isNA
                ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                : "border-gray-300 hover:border-orange-400 cursor-pointer"
              }`}
          >
            {isDone && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1">
              {editingTitle ? (
                <input
                  autoFocus
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") { setEditingTitle(false); setEditTitleValue(item.titulo); }
                  }}
                  className="flex-1 text-sm border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white text-gray-800 w-full"
                />
              ) : (
                <p
                  onDoubleClick={() => { if (!isDone && !isNA) { setEditingTitle(true); setEditTitleValue(item.titulo); } }}
                  title={!isDone && !isNA ? "Duplo clique para renomear" : undefined}
                  className={`text-sm leading-snug flex-1 break-words ${(isDone || isNA) ? "line-through text-gray-400" : "text-gray-800 cursor-text"}`}
                >
                  {item.titulo}
                </p>
              )}
              <div className="flex items-center gap-1 shrink-0 ml-1 mt-0.5">
                {item.pop_pdf_path && (
                  <button
                    onClick={handleVerPop}
                    title="Ver POP (PDF de referência)"
                    className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700 border border-blue-100 transition-colors leading-none"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    POP
                  </button>
                )}
                {item.obrigatoria && !isNA && (
                  <span className="text-orange-400 text-[10px] font-bold leading-none" title="Obrigatória">•</span>
                )}
                {isCustom && (
                  <span className="text-[9px] text-indigo-400 font-semibold bg-indigo-50 px-1 py-0.5 rounded leading-none" title="Tarefa personalizada">+</span>
                )}
              </div>
            </div>

            {/* Responsavel + Prazo meta row */}
            {showMeta && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">

                {/* ── Responsavel picker ── */}
                <div className="relative">
                  <button
                    onClick={() => setShowRespPicker((v) => !v)}
                    title={item.responsavel ? `Responsável: ${item.responsavel}` : "Atribuir responsável"}
                    className="flex items-center gap-1 group/resp"
                  >
                    {initials ? (
                      <>
                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[8px] font-bold flex items-center justify-center leading-none shrink-0">
                          {initials}
                        </span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[72px] group-hover/resp:text-indigo-600 transition-colors">
                          {item.responsavel}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-300 hover:text-gray-500 transition-colors">
                        <span className="w-4 h-4 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[9px] hover:border-gray-400">+</span>
                        <span>resp.</span>
                      </span>
                    )}
                  </button>

                  {showRespPicker && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowRespPicker(false)} />
                      <div className="absolute left-0 top-6 z-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[180px] max-h-52 overflow-y-auto">
                        {/* Clear */}
                        {item.responsavel && (
                          <button
                            onClick={() => handleSelectResp(null)}
                            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                          >
                            <span className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[9px] shrink-0">—</span>
                            Remover responsável
                          </button>
                        )}
                        {/* User list */}
                        {usuarios.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-400">Nenhum usuário</p>
                        )}
                        {usuarios.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleSelectResp(u.nome, u.id)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                              item.responsavel === u.nome
                                ? "bg-indigo-50 text-indigo-700 font-semibold"
                                : "text-gray-700 hover:bg-orange-50"
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[8px] font-bold flex items-center justify-center shrink-0 leading-none">
                              {getInitials(u.nome)}
                            </span>
                            {u.nome}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* ── Prazo ── */}
                {editingPrazo ? (
                  <input
                    autoFocus
                    type="date"
                    value={prazoInput}
                    onChange={(e) => setPrazoInput(e.target.value)}
                    onBlur={handleSavePrazo}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSavePrazo();
                      if (e.key === "Escape") { setEditingPrazo(false); setPrazoInput((item.data_prazo || "").split("T")[0]); }
                    }}
                    className="text-[11px] border border-blue-300 rounded px-1 py-0.5 w-32 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  />
                ) : item.data_prazo ? (
                  <button
                    onClick={() => { setEditingPrazo(true); setPrazoInput(item.data_prazo.split("T")[0]); }}
                    title={`Prazo: ${fmtDate(item.data_prazo)}`}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${prazoClasses(days)}`}
                  >
                    📅 {prazoLabel(days)}
                  </button>
                ) : (
                  <button
                    onClick={() => { setEditingPrazo(true); setPrazoInput(""); }}
                    className="flex items-center gap-0.5 text-[10px] text-gray-300 hover:text-gray-500 border border-dashed border-gray-200 hover:border-gray-300 rounded px-1 py-0.5 transition-colors"
                    title="Adicionar prazo"
                  >
                    📅 prazo
                  </button>
                )}
              </div>
            )}

            {/* Note preview */}
            {item.descricao && !showNote && (
              <p className="text-[11px] text-gray-400 mt-1 italic line-clamp-2 leading-relaxed">
                💬 {item.descricao}
              </p>
            )}

            {/* Sub-items indicator */}
            {subitens.length > 0 && !showSubitens && (
              <button
                onClick={() => setShowSubitens(true)}
                className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="w-3 h-3 rounded border border-gray-300 flex items-center justify-center text-[7px] leading-none">✓</span>
                {subDone}/{subitens.length} sub-itens
              </button>
            )}

            {/* Status info */}
            {isDone && item.data_conclusao && (
              <p className="text-[10px] text-green-600 mt-0.5">✅ {fmtDateTime(item.data_conclusao)}</p>
            )}
            {isNA && <p className="text-[10px] text-gray-400 mt-0.5">⊘ Não aplicável</p>}

            {/* Action bar — inside content, no longer competes with title width */}
            {(hovered || item.arquivado) && (
              <div className="flex items-center gap-0.5 mt-2 pt-1.5 border-t border-gray-100">
                <button
                  onClick={() => { setShowNote((v) => !v); setNoteText(item.descricao || ""); }}
                  title={item.descricao ? "Editar nota" : "Adicionar nota"}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] transition-colors
                    ${item.descricao ? "text-blue-500 bg-blue-50 hover:bg-blue-100" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                >
                  📝
                </button>
                <button
                  onClick={() => { setShowSubitens((v) => !v); if (!showSubitens) setShowAddSub(false); }}
                  title="Sub-itens"
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] transition-colors
                    ${subitens.length > 0 ? "text-indigo-500 bg-indigo-50 hover:bg-indigo-100" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                >
                  ☰
                </button>
                <button
                  onClick={handleToggleNA}
                  title={isNA ? "Reativar tarefa" : "Marcar como Não Aplicável"}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] transition-colors
                    ${isNA ? "text-indigo-500 bg-indigo-50 hover:bg-indigo-100" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                >
                  ⊘
                </button>
                {onMoveUp && (
                  <button onClick={onMoveUp} title="Mover para cima"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    ▲
                  </button>
                )}
                {onMoveDown && (
                  <button onClick={onMoveDown} title="Mover para baixo"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    ▼
                  </button>
                )}
                <button
                  onClick={handleArchive}
                  title={item.arquivado ? "Desarquivar tarefa" : "Arquivar tarefa"}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] transition-colors
                    ${item.arquivado ? "text-amber-500 bg-amber-50 hover:bg-amber-100" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                >
                  📦
                </button>
                {isCustom && (
                  <button onClick={handleDelete} title="Remover tarefa"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                    🗑
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-items panel */}
      {showSubitens && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100">
          <div className="pt-2 space-y-0.5">
            {subitens.map((sub) => (
              <SubItemRow key={sub.id} sub={sub} implId={implId} onRefresh={onRefresh} onOptimisticToggle={onOptimisticToggle} />
            ))}
            {archivedSubs.length > 0 && (
              <div className="pt-0.5">
                <button
                  onClick={() => setShowArchivedSubs((v) => !v)}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors py-0.5"
                >
                  <span>{showArchivedSubs ? "▾" : "▸"}</span>
                  {archivedSubs.length} sub-item{archivedSubs.length !== 1 ? "s" : ""} arquivado{archivedSubs.length !== 1 ? "s" : ""}
                </button>
                {showArchivedSubs && archivedSubs.map((sub) => (
                  <SubItemRow key={sub.id} sub={sub} implId={implId} onRefresh={onRefresh} onOptimisticToggle={onOptimisticToggle} />
                ))}
              </div>
            )}
            {showAddSub ? (
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  autoFocus
                  type="text"
                  value={newSubTitle}
                  onChange={(e) => setNewSubTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSub();
                    if (e.key === "Escape") { setShowAddSub(false); setNewSubTitle(""); }
                  }}
                  placeholder="Nome do sub-item..."
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400 transition"
                />
                <button onClick={handleAddSub} disabled={addingSub || !newSubTitle.trim()}
                  className="px-2 py-1 rounded text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  {addingSub ? "..." : "OK"}
                </button>
                <button onClick={() => { setShowAddSub(false); setNewSubTitle(""); }}
                  className="px-1 py-1 text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddSub(true)}
                className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 hover:text-orange-500 transition-colors"
              >
                <span className="text-sm leading-none font-light">+</span> sub-item
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inline note editor */}
      {showNote && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100">
          <div className="pt-2">
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Nota, instrução ou detalhe para essa tarefa..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition"
            />
            <div className="flex gap-1.5 mt-1.5">
              <button onClick={handleSaveNote} disabled={savingNote}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {savingNote ? "Salvando..." : "Salvar nota"}
              </button>
              <button onClick={() => setShowNote(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ etapa, subsIndex, implId, somentePendentes, filterText, filterResp, filterStatus, columnRef, onRefresh, onOptimisticToggle, isExpanded, dragItem, onDragStart, onDragEnd, onMoveItem, usuarios, isFirst, isLast, onMoveLeft, onMoveRight, onDelete }) {
  const [showAdd, setShowAdd]             = useState(false);
  const [newTitle, setNewTitle]           = useState("");
  const [showMenu, setShowMenu]           = useState(false);
  const [saving, setSaving]               = useState(false);
  const [isDragOver, setIsDragOver]       = useState(false);
  const [showEditEtapa, setShowEditEtapa] = useState(false);
  const [showArchived, setShowArchived]   = useState(false);

  // SLA per-etapa: only show when in progress and has a start date
  const slaDaysLeft = (etapa.status === "em_andamento" && etapa.data_inicio)
    ? slaEtapaLabel(etapa.data_inicio, etapa.sla_dias)
    : null;

  // Archived items always separated
  const archivedItems = etapa.itens.filter((i) => i.arquivado);

  // Apply all filters (only non-archived items)
  let items = etapa.itens.filter((i) => !i.arquivado);
  if (somentePendentes) items = items.filter((i) => i.status !== "concluido" && i.status !== "nao_aplicavel");
  if (filterStatus)     items = items.filter((i) => i.status === filterStatus);
  if (filterResp)       items = items.filter((i) => i.responsavel === filterResp);
  if (filterText) {
    const q = filterText.toLowerCase();
    items = items.filter((i) =>
      i.titulo.toLowerCase().includes(q) ||
      (i.responsavel || "").toLowerCase().includes(q)
    );
  }

  const { total, done } = leafProgress(etapa.itens, subsIndex);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const isDropTarget = isDragOver && dragItem && dragItem.sourceEtapaId !== etapa.id;

  const COL_BG = {
    pendente:     "bg-gray-50",
    em_andamento: "bg-blue-50/40",
    concluida:    "bg-green-50/40",
    bloqueada:    "bg-red-50/40",
    pulada:       "bg-gray-100/70",
  };
  const BAR_COLOR = {
    concluida:    "bg-green-500",
    em_andamento: "bg-blue-500",
    pulada:       "bg-gray-400",
    bloqueada:    "bg-red-400",
    pendente:     "bg-gray-300",
  };

  async function handleAdd() {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    try {
      await implantacoesApi.criarChecklist(implId, { titulo: newTitle.trim(), etapa_id: etapa.id });
      setNewTitle("");
      setShowAdd(false);
      onRefresh();
    } catch { } finally { setSaving(false); }
  }

  async function handleEtapaAction(status) {
    try {
      await implantacoesApi.atualizarEtapa(implId, etapa.id, { status });
      onRefresh();
    } catch { }
  }

  async function handleDeleteEtapa() {
    if (!window.confirm(`Remover a etapa "${etapa.nome}"? As tarefas desta etapa serão mantidas sem etapa.`)) return;
    try {
      await implantacoesApi.deletarEtapa(implId, etapa.id);
      onRefresh();
    } catch { }
  }

  function handleDragOver(e) {
    if (!dragItem || dragItem.sourceEtapaId === etapa.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }

  async function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (!dragItem || dragItem.sourceEtapaId === etapa.id) return;
    await onMoveItem(dragItem.id, etapa.id);
  }

  async function handleReorderItem(itemId, direction) {
    const sorted = [...items].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex((i) => i.id === itemId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    const cur  = sorted[idx];
    try {
      await implantacoesApi.reordenarChecklist(implId, [
        { id: cur.id,  ordem: swap.ordem },
        { id: swap.id, ordem: cur.ordem },
      ]);
      onRefresh();
    } catch { }
  }

  return (
    <div
      ref={columnRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col rounded-xl border transition-all
        ${isDropTarget
          ? "border-blue-400 ring-2 ring-blue-300/50"
          : `border-gray-200 ${COL_BG[etapa.status] || "bg-gray-50"}`
        }
        flex-1 min-w-[256px] max-w-[300px]`}
      style={{ maxHeight: isExpanded ? "calc(100vh - 136px)" : "calc(100vh - 360px)", minHeight: 200 }}
    >
      {/* Column header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-gray-300 text-sm leading-none cursor-grab select-none shrink-0" title="Reordenar via menu ⋮">⠿</span>
          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: etapa.cor || "#6366f1" }} />
          <p className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{etapa.nome}</p>

          {/* SLA badge */}
          {slaDaysLeft !== null && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${
              slaDaysLeft < 0   ? "bg-red-100 text-red-600" :
              slaDaysLeft <= 3  ? "bg-amber-100 text-amber-600" :
                                  "bg-gray-100 text-gray-500"
            }`} title={`SLA da etapa: ${etapa.sla_dias} dias`}>
              {slaDaysLeft < 0 ? `${Math.abs(slaDaysLeft)}d atr.` : `${slaDaysLeft}d SLA`}
            </span>
          )}

          <span className="text-xs text-gray-400 shrink-0 tabular-nums font-medium">{done}/{total}</span>
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-white/80 hover:text-gray-600 transition-colors text-base leading-none font-bold"
            >
              ⋮
            </button>
            {showMenu && (
              <EtapaDropdown
                status={etapa.status}
                onAction={handleEtapaAction}
                onClose={() => setShowMenu(false)}
                onEdit={() => setShowEditEtapa(true)}
                onMoveLeft={onMoveLeft}
                onMoveRight={onMoveRight}
                onDelete={handleDeleteEtapa}
                isFirst={isFirst}
                isLast={isLast}
              />
            )}
          </div>
        </div>

        <Badge status={etapa.status} />

        {/* Progress bar */}
        <div className="mt-2 h-1 bg-gray-200/80 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${BAR_COLOR[etapa.status] || "bg-gray-300"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2 min-h-0">
        {items.map((item, idx) => (
          <KanbanCard
            key={item.id}
            item={item}
            implId={implId}
            etapaId={etapa.id}
            usuarios={usuarios}
            onRefresh={onRefresh}
            onOptimisticToggle={onOptimisticToggle}
            isDragged={dragItem?.id === item.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onMoveUp={idx > 0 ? () => handleReorderItem(item.id, "up") : null}
            onMoveDown={idx < items.length - 1 ? () => handleReorderItem(item.id, "down") : null}
          />
        ))}
        {items.length === 0 && !isDropTarget && (
          <div className="py-6 text-center">
            <p className="text-xs text-gray-400">
              {(somentePendentes || filterText || filterResp || filterStatus) && etapa.itens.length > 0
                ? "Nenhuma tarefa neste filtro"
                : "Sem tarefas"}
            </p>
          </div>
        )}
        {/* Drop target indicator */}
        {isDropTarget && (
          <div className="h-14 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/60 flex items-center justify-center text-xs text-blue-500 font-medium">
            Soltar aqui
          </div>
        )}

        {/* Archived items section */}
        {archivedItems.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="w-full flex items-center gap-1.5 px-1 py-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-[10px]">{showArchived ? "▾" : "▸"}</span>
              {archivedItems.length} arquivado{archivedItems.length !== 1 ? "s" : ""}
            </button>
            {showArchived && (
              <div className="space-y-1.5 mt-0.5">
                {archivedItems.map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    implId={implId}
                    etapaId={etapa.id}
                    usuarios={usuarios}
                    onRefresh={onRefresh}
                    onOptimisticToggle={onOptimisticToggle}
                    isDragged={false}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add task */}
      <div className="px-2 pb-2 pt-1 shrink-0">
        {showAdd ? (
          <div className="space-y-1.5">
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setShowAdd(false); setNewTitle(""); }
              }}
              placeholder="Nome da tarefa..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition bg-white"
            />
            <div className="flex gap-1.5">
              <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {saving ? "..." : "Adicionar"}
              </button>
              <button onClick={() => { setShowAdd(false); setNewTitle(""); }}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-white/80 transition-colors">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)}
            className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors group">
            <span className="text-base leading-none font-light group-hover:text-orange-500">+</span>
            Adicionar tarefa
          </button>
        )}
      </div>

      {showEditEtapa && (
        <EditEtapaModal
          etapa={etapa}
          implId={implId}
          onClose={() => setShowEditEtapa(false)}
          onSaved={() => { setShowEditEtapa(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconExpand() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function IconCompress() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </svg>
  );
}

// ── Kanban Tab ────────────────────────────────────────────────────────────────

function KanbanTab({ etapas, subsIndex, implId, somentePendentes, columnRefs, onRefresh, onOptimisticToggle, isExpanded, showAddEtapa: propShowAdd, onSetShowAddEtapa }) {
  const [filterText, setFilterText]     = useState("");
  const [filterResp, setFilterResp]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dragItem, setDragItem]         = useState(null);
  const [usuarios, setUsuarios]         = useState([]);
  const [localShowAdd, setLocalShowAdd] = useState(false);
  const [novaEtapa, setNovaEtapa]       = useState({ nome: "", cor: "#6366f1", sla_dias: 3 });
  const [savingEtapa, setSavingEtapa]   = useState(false);

  const showAddEtapa = propShowAdd !== undefined ? propShowAdd : localShowAdd;
  function setShowAddEtapa(v) { setLocalShowAdd(v); if (onSetShowAddEtapa) onSetShowAddEtapa(v); }

  useEffect(() => {
    usuariosApi.listar()
      .then(({ data }) => setUsuarios(data.filter((u) => u.ativo)))
      .catch(() => {});
  }, []);

  const hasFilters = filterText || filterResp || filterStatus;

  const responsaveis = [...new Set(
    etapas.flatMap((e) => e.itens.map((i) => i.responsavel).filter(Boolean))
  )].sort();

  async function handleMoveItem(itemId, targetEtapaId) {
    try {
      await implantacoesApi.atualizarChecklist(itemId, { etapa_id: targetEtapaId });
      onRefresh();
    } catch { }
  }

  async function handleMoveEtapa(etapa, direction) {
    const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
    const idx    = sorted.findIndex((e) => e.id === etapa.id);
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    const ordens = [
      { id: etapa.id, ordem: swap.ordem },
      { id: swap.id,  ordem: etapa.ordem },
    ];
    try {
      await implantacoesApi.reordenarEtapas(implId, ordens);
      onRefresh();
    } catch { }
  }

  async function handleAddEtapa() {
    if (!novaEtapa.nome.trim() || savingEtapa) return;
    setSavingEtapa(true);
    try {
      await implantacoesApi.criarEtapa(implId, novaEtapa);
      setNovaEtapa({ nome: "", cor: "#6366f1", sla_dias: 3 });
      setShowAddEtapa(false);
      onRefresh();
    } catch { } finally { setSavingEtapa(false); }
  }

  const inputCls = "border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition bg-white";
  const sorted   = [...etapas].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className={isExpanded ? "flex flex-col h-full" : "flex flex-col"}>
      {/* ── Filter bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Buscar tarefa..."
            className={`${inputCls} pl-8 w-full`}
          />
        </div>

        {responsaveis.length > 0 && (
          <select value={filterResp} onChange={(e) => setFilterResp(e.target.value)} className={inputCls}>
            <option value="">Todos responsáveis</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
          <option value="">Todos status</option>
          <option value="pendente">Pendentes</option>
          <option value="bloqueado">Bloqueados</option>
          <option value="nao_aplicavel">Não aplicáveis</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setFilterText(""); setFilterResp(""); setFilterStatus(""); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* ── Board ───────────────────────────────────────────── */}
      <div
        className={isExpanded ? "flex gap-3 overflow-x-auto flex-1 pb-2" : "flex gap-3 overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6"}
        style={{ scrollbarWidth: "thin" }}
      >
        {sorted.map((etapa, idx) => (
          <KanbanColumn
            key={etapa.id}
            etapa={etapa}
            subsIndex={subsIndex}
            implId={implId}
            somentePendentes={somentePendentes}
            filterText={filterText}
            filterResp={filterResp}
            filterStatus={filterStatus}
            columnRef={(el) => { if (el) columnRefs.current[etapa.id] = el; }}
            onRefresh={onRefresh}
            onOptimisticToggle={onOptimisticToggle}
            isExpanded={isExpanded}
            dragItem={dragItem}
            onDragStart={setDragItem}
            onDragEnd={() => setDragItem(null)}
            onMoveItem={handleMoveItem}
            usuarios={usuarios}
            isFirst={idx === 0}
            isLast={idx === sorted.length - 1}
            onMoveLeft={() => handleMoveEtapa(etapa, "left")}
            onMoveRight={() => handleMoveEtapa(etapa, "right")}
          />
        ))}

        {/* ── Add Etapa card ── */}
        <div className="min-w-[220px] max-w-[220px] shrink-0">
          {showAddEtapa ? (
            <div className="rounded-xl border border-dashed border-orange-300 bg-orange-50/50 p-3 space-y-2.5">
              <input
                autoFocus
                type="text"
                value={novaEtapa.nome}
                onChange={(e) => setNovaEtapa((v) => ({ ...v, nome: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddEtapa();
                  if (e.key === "Escape") { setShowAddEtapa(false); }
                }}
                placeholder="Nome da nova etapa..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition bg-white"
              />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Cor</p>
                <div className="flex gap-1.5 flex-wrap">
                  {ETAPA_CORES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNovaEtapa((v) => ({ ...v, cor: c }))}
                      className={`w-5 h-5 rounded-full transition-all ${novaEtapa.cor === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">SLA (dias)</p>
                <input
                  type="number" min={1} max={999}
                  value={novaEtapa.sla_dias}
                  onChange={(e) => setNovaEtapa((v) => ({ ...v, sla_dias: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-orange-400 transition bg-white"
                />
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleAddEtapa} disabled={savingEtapa || !novaEtapa.nome.trim()}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  {savingEtapa ? "..." : "Criar"}
                </button>
                <button onClick={() => setShowAddEtapa(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-white/80 transition-colors">
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddEtapa(true)}
              className="w-full h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50/30 transition-all group"
            >
              <span className="text-xl leading-none font-light group-hover:text-orange-500">+</span>
              Nova etapa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────

function TimelineTab({ timeline }) {
  if (timeline.length === 0) {
    return <div className="py-12 text-center text-sm text-gray-400">Nenhum evento na timeline.</div>;
  }

  const iconMap = {
    inbox: "📥", search: "🔍", "check-circle": "✅", "x-circle": "❌",
    flag: "🚩", settings: "⚙️", "message-circle": "💬", alert: "⚠️",
    refresh: "🔄", trophy: "🏆",
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
      <div className="space-y-0">
        {timeline.map((ev) => (
          <div key={ev.id} className="relative flex gap-4 pb-5">
            <div
              className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border-2 border-white shadow-sm"
              style={{ backgroundColor: ev.cor || "#e5e7eb" }}
            >
              {iconMap[ev.icone] || "•"}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-800">{ev.titulo}</p>
                <p className="text-xs text-gray-400 shrink-0">{fmtDateTime(ev.created_at)}</p>
              </div>
              {ev.descricao && <p className="text-sm text-gray-600 mt-0.5">{ev.descricao}</p>}
              {ev.usuario && <p className="text-xs text-gray-400 mt-1">por {ev.usuario}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comentários Tab ───────────────────────────────────────────────────────────

function ComentariosTab({ implId, comentarios, onAdded }) {
  const [text, setText]     = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await implantacoesApi.adicionarComentario(implId, { conteudo: text, usuario: "Admin" });
      setText("");
      onAdded();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Escreva um comentário interno..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition"
        />
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors self-end"
        >
          {saving ? "..." : "Enviar"}
        </button>
      </form>

      {comentarios.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhum comentário ainda.</p>
      ) : (
        <div className="space-y-3">
          {[...comentarios].reverse().map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-700">{c.usuario}</span>
                <span className="text-xs text-gray-400">{fmtDateTime(c.created_at)}</span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.conteudo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cliente Tab ───────────────────────────────────────────────────────────────

function ClienteTab({ clienteId }) {
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) { setLoading(false); return; }
    clientesApi.obter(clienteId)
      .then(({ data }) => setCliente(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clienteId]);

  if (loading) return <Spinner />;
  if (!cliente) return <p className="text-sm text-gray-400">Cliente não encontrado.</p>;

  const e = cliente.endereco || {};
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-white text-lg font-bold"
          style={{ background: "linear-gradient(135deg, #253261, #1B2240)" }}
        >
          {cliente.razao_social.charAt(0)}
        </div>
        <div>
          <p className="font-bold text-gray-900">{cliente.razao_social}</p>
          {cliente.nome_fantasia && <p className="text-sm text-gray-400">{cliente.nome_fantasia}</p>}
          <p className="text-xs font-mono text-gray-500 mt-1">{cliente.cnpj}</p>
        </div>
        <button
          onClick={() => navigate(`/admin/clientes/${cliente.id}`)}
          className="ml-auto text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors shrink-0"
        >
          Ver ficha completa →
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-gray-100 pt-4">
        <Field label="E-mail" value={cliente.email} />
        <Field label="Celular" value={cliente.telefone_celular} mono />
        <Field label="Responsável" value={cliente.responsavel} />
        <Field label="Tel. Fixo" value={cliente.telefone_fixo} mono />
        {e.cidade && <Field label="Cidade/UF" value={`${e.cidade} - ${e.estado}`} />}
        {e.cep && <Field label="CEP" value={e.cep} mono />}
      </div>
    </div>
  );
}

// ── Edit Panel ────────────────────────────────────────────────────────────────

function EditPanel({ impl, onClose, onSaved }) {
  const [form, setForm] = useState({
    status:       impl.status,
    consultor:    impl.consultor || "",
    prioridade:   impl.prioridade,
    observacoes:  impl.observacoes || "",
    data_prevista: impl.data_prevista || "",
  });
  const [saving, setSaving] = useState(false);

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition";

  async function handleSave() {
    setSaving(true);
    try {
      await implantacoesApi.atualizar(impl.id, form);
      onSaved();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Editar Implantação</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
              <option value="em_andamento">Em Andamento</option>
              <option value="pausada">Pausada</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Consultor</label>
            <input type="text" value={form.consultor} onChange={(e) => setForm((f) => ({ ...f, consultor: e.target.value }))} placeholder="Nome do consultor" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data Prevista</label>
            <input type="date" value={form.data_prevista} onChange={(e) => setForm((f) => ({ ...f, data_prevista: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Prioridade</label>
            <div className="flex gap-2">
              {["baixa", "normal", "alta", "critica"].map((p) => (
                <button key={p} type="button"
                  onClick={() => setForm((f) => ({ ...f, prioridade: p }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    form.prioridade === p ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {p === "critica" ? "Crítica" : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder="Notas internas..." className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "checklist",   label: "Kanban"      },
  { id: "timeline",    label: "Timeline"    },
  { id: "comentarios", label: "Comentários" },
  { id: "cliente",     label: "Cliente"     },
];

export default function ImplantacaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [impl, setImpl]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeTab, setActiveTab] = useState("checklist");
  const [showEdit, setShowEdit] = useState(false);
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddEtapa, setShowAddEtapa] = useState(false);
  const columnRefs = useRef({});

  useEffect(() => {
    if (!isExpanded) return;
    document.body.style.overflow = "hidden";
    function onKey(e) { if (e.key === "Escape") setIsExpanded(false); }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isExpanded]);

  const load = useCallback(async () => {
    try {
      const { data } = await implantacoesApi.obter(id);
      setImpl(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const subsIndex = useMemo(() => buildSubsIndex(impl?.checklist), [impl?.checklist]);

  function handlePipelineClick(etapaId) {
    setActiveTab("checklist");
    requestAnimationFrame(() => {
      columnRefs.current[etapaId]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    });
  }

  if (loading) return <Layout><Spinner /></Layout>;

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-40 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => navigate("/admin/implantacoes")} className="text-xs text-gray-400 hover:underline">
            ← Voltar
          </button>
        </div>
      </Layout>
    );
  }

  if (!impl) return null;

  async function handleRenameEtapa(etapaId, nome) {
    try { await implantacoesApi.atualizarEtapa(impl.id, etapaId, { nome }); load(); } catch { }
  }

  function handleOptimisticToggle(itemId, newStatus) {
    setImpl(prev => ({
      ...prev,
      // Update flat checklist (drives leafProgress via subsIndex)
      checklist: (prev.checklist || []).map(item =>
        item.id === itemId ? { ...item, status: newStatus } : item
      ),
      // Update nested etapas (drives card display)
      etapas: prev.etapas.map(etapa => ({
        ...etapa,
        itens: etapa.itens.map(item => {
          if (item.id === itemId) return { ...item, status: newStatus };
          if (!item.subitens?.length) return item;
          const isSub = item.subitens.some(s => s.id === itemId);
          if (!isSub) return item;
          const updatedSubs = item.subitens.map(s => s.id === itemId ? { ...s, status: newStatus } : s);
          let parentStatus = item.status;
          if (newStatus === "concluido" || newStatus === "nao_aplicavel") {
            const activeSubs = updatedSubs.filter(s => !s.arquivado);
            const allDone = activeSubs.length > 0 && activeSubs.every(s => s.status === "concluido" || s.status === "nao_aplicavel");
            if (allDone) parentStatus = "concluido";
          } else if (newStatus === "pendente" && item.status === "concluido") {
            parentStatus = "pendente";
          }
          return { ...item, status: parentStatus, subitens: updatedSubs };
        }),
      })),
    }));
  }

  const slaColor =
    impl.status === "concluida" || impl.status === "cancelada" ? "text-gray-500" :
    impl.sla_status === "atrasada" ? "text-red-600 font-semibold" :
    impl.sla_status === "critico"  ? "text-amber-600 font-semibold" :
    "text-gray-600";

  const { total: lpTotal, done: lpDone } = impl.etapas.reduce(
    (acc, e) => { const r = leafProgress(e.itens, subsIndex); return { total: acc.total + r.total, done: acc.done + r.done }; },
    { total: 0, done: 0 }
  );
  const liveProgress = lpTotal > 0 ? Math.round((lpDone / lpTotal) * 100) : 0;
  const pendingItems = lpTotal - lpDone;

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm">
        <button
          onClick={() => navigate("/admin/implantacoes")}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Implantações
        </button>
        <span className="text-gray-300">/</span>
        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{impl.codigo}</span>
        <span className="text-gray-600 font-medium truncate">{impl.nome}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{impl.nome}</h1>
              <Badge status={impl.status} />
              <PrioridadeBadge prioridade={impl.prioridade} />
              {impl.conversao_dados && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h7" />
                  </svg>
                  Conversão de dados
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {impl.consultor ? `Consultor: ${impl.consultor}` : "Sem consultor"}
              {" · "}
              <span className={slaColor}>SLA: {fmtDate(impl.sla_limite)}</span>
              {" · "}
              Início: {fmtDate(impl.data_inicio)}
            </p>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
          >
            Editar
          </button>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-500">Progresso geral</span>
            <div className="flex items-center gap-3">
              {pendingItems > 0 && (
                <span className="text-xs text-gray-400">{pendingItems} pendente{pendingItems !== 1 ? "s" : ""}</span>
              )}
              <span className="text-sm font-bold text-gray-800">{liveProgress}%</span>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                impl.status === "concluida" ? "bg-green-500" : liveProgress >= 80 ? "bg-blue-500" : "bg-orange-400"
              }`}
              style={{ width: `${liveProgress}%` }}
            />
          </div>
        </div>

        {/* Pipeline */}
        {impl.etapas.length > 0 && (
          <Pipeline
            etapas={impl.etapas}
            subsIndex={subsIndex}
            onEtapaClick={handlePipelineClick}
            onAddEtapa={() => { setActiveTab("checklist"); setShowAddEtapa(true); }}
            onRenameEtapa={handleRenameEtapa}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex items-center justify-between px-2">
            <div className="flex">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {tab.id === "comentarios" && impl.comentarios.length > 0 && (
                    <span className="ml-1.5 text-xs text-gray-400">({impl.comentarios.length})</span>
                  )}
                  {tab.id === "checklist" && pendingItems > 0 && (
                    <span className="ml-1.5 text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{pendingItems}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Toolbar for kanban tab */}
            {activeTab === "checklist" && (
              <div className="pr-2 flex items-center gap-2">
                <button
                  onClick={() => setShowAddEtapa(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                >
                  <span className="text-base leading-none font-light">+</span>
                  Nova Etapa
                </button>
                <button
                  onClick={() => setSomentePendentes((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    somentePendentes
                      ? "bg-orange-100 text-orange-700 border border-orange-200"
                      : "text-gray-500 hover:bg-gray-100 border border-transparent"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${somentePendentes ? "bg-orange-500" : "bg-gray-400"}`} />
                  Só pendentes
                </button>
                <button
                  onClick={() => setIsExpanded(true)}
                  title="Expandir tela cheia"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-transparent transition-all"
                >
                  <IconExpand />
                  Expandir
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "checklist" && (
            <KanbanTab
              etapas={impl.etapas}
              subsIndex={subsIndex}
              implId={impl.id}
              somentePendentes={somentePendentes}
              columnRefs={columnRefs}
              onRefresh={load}
              onOptimisticToggle={handleOptimisticToggle}
              showAddEtapa={showAddEtapa}
              onSetShowAddEtapa={setShowAddEtapa}
            />
          )}
          {activeTab === "timeline"    && <TimelineTab timeline={impl.timeline} />}
          {activeTab === "comentarios" && <ComentariosTab implId={impl.id} comentarios={impl.comentarios} onAdded={load} />}
          {activeTab === "cliente"     && <ClienteTab clienteId={impl.cliente_id} />}
        </div>
      </div>

      {/* ── Fullscreen Kanban overlay ─────────────────────────────────────── */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white"
          style={{ animation: "kanbanExpand 160ms cubic-bezier(0.16,1,0.3,1)" }}
        >
          <style>{`
            @keyframes kanbanExpand {
              from { opacity: 0.7; transform: scale(0.985) }
              to   { opacity: 1;   transform: scale(1)     }
            }
          `}</style>

          {/* Fullscreen header */}
          <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-gray-100 shrink-0 bg-white shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{impl.nome}</p>
                <Badge status={impl.status} />
                <PrioridadeBadge prioridade={impl.prioridade} />
              </div>
              <div className="flex items-center gap-2 pl-3 border-l border-gray-200 shrink-0">
                <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      impl.status === "concluida" ? "bg-green-500" : liveProgress >= 80 ? "bg-blue-500" : "bg-orange-400"
                    }`}
                    style={{ width: `${liveProgress}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-700 tabular-nums">{liveProgress}%</span>
                {pendingItems > 0 && (
                  <span className="text-xs text-gray-400">{pendingItems} pendente{pendingItems !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowAddEtapa(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
              >
                <span className="text-base leading-none font-light">+</span>
                Nova Etapa
              </button>
              <button
                onClick={() => setSomentePendentes((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  somentePendentes
                    ? "bg-orange-100 text-orange-700 border border-orange-200"
                    : "text-gray-500 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${somentePendentes ? "bg-orange-500" : "bg-gray-400"}`} />
                Só pendentes
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                title="Minimizar (Esc)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors"
              >
                <IconCompress />
                Minimizar
                <span className="ml-1 text-[10px] text-gray-400 font-normal">Esc</span>
              </button>
            </div>
          </div>

          {/* Kanban board */}
          <div className="flex-1 overflow-hidden px-5 py-4">
            <KanbanTab
              etapas={impl.etapas}
              subsIndex={subsIndex}
              implId={impl.id}
              somentePendentes={somentePendentes}
              columnRefs={columnRefs}
              onRefresh={load}
              onOptimisticToggle={handleOptimisticToggle}
              isExpanded={true}
              showAddEtapa={showAddEtapa}
              onSetShowAddEtapa={setShowAddEtapa}
            />
          </div>
        </div>
      )}

      {showEdit && (
        <EditPanel
          impl={impl}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
    </Layout>
  );
}
