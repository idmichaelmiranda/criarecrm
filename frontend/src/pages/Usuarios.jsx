import { useState, useEffect } from "react";
import { Layout } from "../components/layout/Layout";
import { usuariosApi, gruposApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

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
function avatarColor(nome) {
  return PALETTE[(nome || "").charCodeAt(0) % PALETTE.length];
}

// ── Componentes base ──────────────────────────────────────────────────────────
function Avatar({ nome, avatarUrl, size = "md" }) {
  const sz = size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm";
  if (avatarUrl) return (
    <img src={avatarUrl} alt={nome} className={`${sz} rounded-xl object-cover shrink-0 ring-2 ring-white shadow-sm`} />
  );
  const [bg, fg] = avatarColor(nome);
  return (
    <div className={`${sz} ${bg} rounded-xl flex items-center justify-center shrink-0 shadow-sm`}>
      <span className={`font-bold ${fg}`}>{(nome || "?").charAt(0).toUpperCase()}</span>
    </div>
  );
}

function StatusBadge({ ativo, pendente }) {
  if (pendente) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Pendente
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ativo ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ativo ? "bg-green-500" : "bg-gray-400"}`} />
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

const GROUP_COLORS = [
  "bg-indigo-50 text-indigo-700 border-indigo-100",
  "bg-violet-50 text-violet-700 border-violet-100",
  "bg-blue-50   text-blue-700   border-blue-100",
  "bg-teal-50   text-teal-700   border-teal-100",
  "bg-orange-50 text-orange-700 border-orange-100",
];
function GroupBadge({ nome }) {
  if (!nome) return <span className="text-gray-300 text-xs">—</span>;
  const cls = GROUP_COLORS[(nome || "").charCodeAt(0) % GROUP_COLORS.length];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {nome}
    </span>
  );
}

// ── Modal Editar/Criar ────────────────────────────────────────────────────────
const EMPTY_FORM = { nome: "", email: "", senha: "", grupo_id: "", ativo: true };

function EditModal({ titulo, grupos, inicial, onSave, onClose, loading, hasPermission }) {
  const isEdit = !!inicial?.id;
  const [form, setForm] = useState(
    isEdit
      ? { nome: inicial.nome, email: inicial.email, senha: "", grupo_id: inicial.grupo_id ?? "", ativo: inicial.ativo }
      : { ...EMPTY_FORM }
  );
  const [error, setError] = useState("");
  const canEdit = hasPermission(isEdit ? "usuarios.edit" : "usuarios.create");

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); setError(""); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) { setError("Nome e e-mail são obrigatórios."); return; }
    if (!isEdit && !form.senha.trim()) { setError("Senha é obrigatória para novo usuário."); return; }
    if (!form.grupo_id) { setError("Selecione um grupo."); return; }
    const payload = { nome: form.nome.trim(), email: form.email.trim(), grupo_id: Number(form.grupo_id), ativo: form.ativo };
    if (form.senha.trim()) payload.senha = form.senha.trim();
    try { await onSave(payload); } catch (err) { setError(err.message); }
  }

  const inp = "w-full px-3 py-2.5 rounded-xl text-sm text-gray-900 placeholder-gray-400 border border-gray-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:bg-gray-50 disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">{titulo}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Nome completo</label>
              <input value={form.nome} onChange={(e) => set("nome", e.target.value)} disabled={!canEdit} placeholder="Nome completo" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!canEdit} placeholder="usuario@empresa.com" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                {isEdit ? "Nova senha (deixe em branco para manter)" : "Senha"}
              </label>
              <input type="password" value={form.senha} onChange={(e) => set("senha", e.target.value)} disabled={!canEdit} placeholder="••••••••" className={inp} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Grupo</label>
              <select value={form.grupo_id} onChange={(e) => set("grupo_id", e.target.value)} disabled={!canEdit} className={`${inp} bg-white`}>
                <option value="">Selecione...</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
              <button type="button" onClick={() => canEdit && set("ativo", !form.ativo)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${form.ativo ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                <span className={`relative w-8 h-4 rounded-full transition-colors ${form.ativo ? "bg-green-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${form.ativo ? "translate-x-4" : "translate-x-0.5"}`} />
                </span>
                {form.ativo ? "Ativo" : "Inativo"}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 px-3 py-2 rounded-xl bg-red-50 border border-red-100">{error}</p>}
          {canEdit && (
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Modal Aprovar ─────────────────────────────────────────────────────────────
function AprovarModal({ usuario, grupos, onAprovar, onClose, loading }) {
  const [grupoId, setGrupoId] = useState("");
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!grupoId) { setError("Selecione um grupo de permissão."); return; }
    try { await onAprovar(usuario.id, { grupo_id: Number(grupoId) }); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">Aprovar cadastro</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <Avatar nome={usuario.nome} avatarUrl={usuario.avatar_url} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{usuario.nome}</p>
              <p className="text-xs text-gray-500 truncate">{usuario.email}</p>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Grupo de permissão</label>
            <select value={grupoId} onChange={(e) => { setGrupoId(e.target.value); setError(""); }}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-gray-900 border border-gray-200 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all bg-white">
              <option value="">Selecione o grupo</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
            Um e-mail será enviado automaticamente ao usuário com o link para definir sua senha.
          </p>
          {error && <p className="text-xs text-red-600 px-3 py-2 rounded-xl bg-red-50 border border-red-100">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors">
              {loading ? "Aprovando..." : "Aprovar Acesso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Row de usuário ────────────────────────────────────────────────────────────
function UserRow({ u, onEdit, onDelete, onAprovar, onReenviarSenha, hasPermission }) {
  return (
    <div className={`flex items-center gap-4 px-6 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors group ${!u.ativo && !u.pendente ? "opacity-60" : ""}`}>
      {/* Avatar */}
      <Avatar nome={u.nome} avatarUrl={u.avatar_url} />

      {/* Nome + email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{u.nome}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{u.email}</p>
      </div>

      {/* Grupo */}
      <div className="w-36 shrink-0 hidden sm:block">
        <GroupBadge nome={u.grupo?.nome} />
      </div>

      {/* Status */}
      <div className="w-24 shrink-0 hidden sm:flex">
        <StatusBadge ativo={u.ativo} pendente={u.pendente} />
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {u.pendente && hasPermission("usuarios.edit") && (
          <button onClick={() => onAprovar(u)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Aprovar
          </button>
        )}
        {!u.pendente && hasPermission("usuarios.edit") && (
          <button onClick={() => onReenviarSenha(u)} title="Reenviar e-mail de senha"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>
        )}
        {!u.pendente && hasPermission("usuarios.edit") && (
          <button onClick={() => onEdit(u)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        {hasPermission("usuarios.delete") && (
          <button onClick={() => onDelete(u)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm px-5 py-4 flex items-center gap-4 ${color.border}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color.bg}`}>
        <span className={color.icon}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Usuarios() {
  const { hasPermission }              = useAuth();
  const [usuarios, setUsuarios]        = useState([]);
  const [grupos, setGrupos]            = useState([]);
  const [loading, setLoading]          = useState(true);
  const [saving, setSaving]            = useState(false);
  const [tab, setTab]                  = useState("ativos");
  const [search, setSearch]            = useState("");
  const [modal, setModal]              = useState(null);
  const [aprovarModal, setAprovarModal]= useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError]              = useState("");
  const [toast, setToast]              = useState(null);

  async function load() {
    try {
      const [u, g] = await Promise.all([usuariosApi.listar(), gruposApi.listar()]);
      setUsuarios(u.data);
      setGrupos(g.data);
    } catch { setError("Erro ao carregar usuários."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const pendentes = usuarios.filter((u) => u.pendente);
  const ativos    = usuarios.filter((u) => !u.pendente);
  const base      = tab === "pendentes" ? pendentes : ativos;
  const filtered  = search.trim()
    ? base.filter((u) => u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : base;

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (modal.item) await usuariosApi.atualizar(modal.item.id, payload);
      else await usuariosApi.criar(payload);
      setModal(null); await load();
    } finally { setSaving(false); }
  }

  async function handleAprovar(id, data) {
    setSaving(true);
    try {
      await usuariosApi.aprovar(id, data);
      setAprovarModal(null);
      if (pendentes.length === 1) setTab("ativos");
      await load();
    } finally { setSaving(false); }
  }

  async function handleReenviarSenha(usuario) {
    try {
      const res = await usuariosApi.reenviarSenha(usuario.id);
      setToast({ type: "success", text: res.data.message });
    } catch (err) {
      setToast({ type: "error", text: err.message });
    } finally { setTimeout(() => setToast(null), 5000); }
  }

  async function handleDelete(id) {
    try {
      await usuariosApi.deletar(id);
      setDeleteConfirm(null); await load();
    } catch (err) {
      setError(err.message); setDeleteConfirm(null);
    }
  }

  const totalAtivos   = ativos.filter((u) => u.ativo).length;
  const totalInativos = ativos.filter((u) => !u.ativo).length;

  return (
    <Layout>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie os acessos à plataforma</p>
        </div>
        {hasPermission("usuarios.create") && (
          <button onClick={() => setModal({ item: null })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo Usuário
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={usuarios.length}
          color={{ border: "border-gray-100", bg: "bg-gray-100", icon: "text-gray-500" }}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard label="Ativos" value={totalAtivos}
          color={{ border: "border-green-100", bg: "bg-green-50", icon: "text-green-600" }}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard label="Inativos" value={totalInativos}
          color={{ border: "border-gray-100", bg: "bg-gray-100", icon: "text-gray-400" }}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
        />
        <StatCard label="Pendentes" value={pendentes.length}
          color={{ border: pendentes.length > 0 ? "border-amber-200" : "border-gray-100", bg: pendentes.length > 0 ? "bg-amber-50" : "bg-gray-100", icon: pendentes.length > 0 ? "text-amber-600" : "text-gray-400" }}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{error}</div>}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => { setTab("ativos"); setSearch(""); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "ativos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Ativos
            <span className="ml-1.5 text-xs font-bold text-gray-400">{ativos.length}</span>
          </button>
          <button onClick={() => { setTab("pendentes"); setSearch(""); }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "pendentes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Pendentes
            {pendentes.length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {pendentes.length}
              </span>
            )}
          </button>
        </div>

        {/* Busca */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 bg-white shadow-sm" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} usuário{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header da lista */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_144px_96px_120px] gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/60">
          {["Usuário", "E-mail", "Grupo", "Status", ""].map((h) => (
            <p key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{h}</p>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {search ? `Nenhum usuário encontrado para "${search}"` : tab === "pendentes" ? "Nenhum cadastro pendente" : "Nenhum usuário cadastrado"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? "Tente outros termos." : tab === "ativos" ? "Clique em Novo Usuário para começar." : ""}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                onEdit={(u) => setModal({ item: u })}
                onDelete={setDeleteConfirm}
                onAprovar={setAprovarModal}
                onReenviarSenha={handleReenviarSenha}
                hasPermission={hasPermission}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      {modal !== null && (
        <EditModal titulo={modal.item ? "Editar Usuário" : "Novo Usuário"} grupos={grupos} inicial={modal.item}
          onSave={handleSave} onClose={() => setModal(null)} loading={saving} hasPermission={hasPermission} />
      )}
      {aprovarModal && (
        <AprovarModal usuario={aprovarModal} grupos={grupos} onAprovar={handleAprovar}
          onClose={() => setAprovarModal(null)} loading={saving} />
      )}

      {/* Confirm excluir */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Excluir usuário?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Tem certeza que deseja excluir <span className="font-semibold text-gray-800">{deleteConfirm.nome}</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium border ${
          toast.type === "success" ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-800"
        }`}>
          {toast.type === "success"
            ? <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast.text}
        </div>
      )}
    </Layout>
  );
}
