import { useState, useEffect } from "react";
import { Layout } from "../components/layout/Layout";
import { usuariosApi, gruposApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// ── Badges / Avatar ───────────────────────────────────────────────────────────

function StatusBadge({ ativo, pendente }) {
  if (pendente) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Pendente
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      ativo ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ativo ? "bg-green-500" : "bg-gray-400"}`} />
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

function Avatar({ nome, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-gray-200"
      />
    );
  }
  const palette = [
    "bg-orange-100 text-orange-600",
    "bg-violet-100 text-violet-600",
    "bg-blue-100 text-blue-600",
    "bg-teal-100 text-teal-600",
    "bg-pink-100 text-pink-600",
  ];
  const color = palette[(nome || "").charCodeAt(0) % palette.length];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
      <span className="text-sm font-bold">{nome?.charAt(0).toUpperCase()}</span>
    </div>
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

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) { setError("Nome e e-mail são obrigatórios."); return; }
    if (!isEdit && !form.senha.trim()) { setError("Senha é obrigatória para novo usuário."); return; }
    if (!form.grupo_id) { setError("Selecione um grupo."); return; }
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      grupo_id: Number(form.grupo_id),
      ativo: form.ativo,
    };
    if (form.senha.trim()) payload.senha = form.senha.trim();
    try { await onSave(payload); } catch (err) { setError(err.message); }
  }

  const canEdit = hasPermission(isEdit ? "usuarios.edit" : "usuarios.create");

  const inp = "w-full px-3 py-2.5 rounded-xl text-sm text-gray-900 placeholder-gray-400 border border-gray-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:bg-gray-50 disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome</label>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} disabled={!canEdit} placeholder="Nome completo" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">E-mail</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!canEdit} placeholder="usuario@empresa.com" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              {isEdit ? "Nova Senha (deixe em branco para não alterar)" : "Senha"}
            </label>
            <input type="password" value={form.senha} onChange={(e) => set("senha", e.target.value)} disabled={!canEdit} placeholder="••••••••" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Grupo</label>
            <select value={form.grupo_id} onChange={(e) => set("grupo_id", e.target.value)} disabled={!canEdit} className={`${inp} bg-white`}>
              <option value="">Selecione um grupo</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => canEdit && set("ativo", !form.ativo)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.ativo ? "bg-orange-500" : "bg-gray-300"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.ativo ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
            <span className="text-sm text-gray-600">{form.ativo ? "Usuário ativo" : "Usuário inativo"}</span>
          </div>
          {error && <p className="text-xs text-red-600 px-3 py-2 rounded-lg bg-red-50 border border-red-100">{error}</p>}
          {canEdit && (
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}>
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
    try {
      await onAprovar(usuario.id, { grupo_id: Number(grupoId) });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Aprovar cadastro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Info do usuário */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <Avatar nome={usuario.nome} avatarUrl={usuario.avatar_url} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{usuario.nome}</p>
              <p className="text-xs text-gray-500 truncate">{usuario.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Grupo de permissão
            </label>
            <select
              value={grupoId}
              onChange={(e) => { setGrupoId(e.target.value); setError(""); }}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-gray-900 border border-gray-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all bg-white"
            >
              <option value="">Selecione o grupo</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Ao aprovar, um e-mail será enviado automaticamente ao usuário com o link para definir sua senha.
          </p>

          {error && <p className="text-xs text-red-600 px-3 py-2 rounded-lg bg-red-50 border border-red-100">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors">
              {loading ? "Aprovando..." : "Aprovar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tabela de usuários ────────────────────────────────────────────────────────

function UserTable({ usuarios, onEdit, onDelete, onAprovar, onReenviarSenha, hasPermission, showPendentes }) {
  if (usuarios.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-sm">
          {showPendentes ? "Nenhum cadastro pendente." : "Nenhum usuário cadastrado."}
        </p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-100 bg-gray-50/60">
          {["Usuário", "E-mail", "Grupo", "Status", ""].map((h) => (
            <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3.5">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {usuarios.map((u) => (
          <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <Avatar nome={u.nome} avatarUrl={u.avatar_url} />
                <span className="text-sm font-semibold text-gray-800">{u.nome}</span>
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
            <td className="px-6 py-4">
              <span className="text-xs font-medium text-gray-600 px-2.5 py-1 rounded-lg bg-gray-100">
                {u.grupo?.nome ?? "—"}
              </span>
            </td>
            <td className="px-6 py-4"><StatusBadge ativo={u.ativo} pendente={u.pendente} /></td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-1 justify-end">
                {u.pendente && hasPermission("usuarios.edit") && (
                  <button onClick={() => onAprovar(u)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Aprovar
                  </button>
                )}
                {!u.pendente && hasPermission("usuarios.edit") && (
                  <>
                    <button
                      onClick={() => onReenviarSenha(u)}
                      title="Reenviar e-mail de senha"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button onClick={() => onEdit(u)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </>
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
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Usuarios() {
  const { hasPermission } = useAuth();
  const [usuarios, setUsuarios]     = useState([]);
  const [grupos, setGrupos]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [tab, setTab]               = useState("ativos");
  const [modal, setModal]           = useState(null);
  const [aprovarModal, setAprovarModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError]           = useState("");
  const [toast, setToast]           = useState(null);

  async function load() {
    try {
      const [u, g] = await Promise.all([usuariosApi.listar(), gruposApi.listar()]);
      setUsuarios(u.data);
      setGrupos(g.data);
    } catch {
      setError("Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const pendentes = usuarios.filter((u) => u.pendente);
  const ativos    = usuarios.filter((u) => !u.pendente);

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (modal.item) await usuariosApi.atualizar(modal.item.id, payload);
      else await usuariosApi.criar(payload);
      setModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleAprovar(id, data) {
    setSaving(true);
    try {
      await usuariosApi.aprovar(id, data);
      setAprovarModal(null);
      if (pendentes.length === 1) setTab("ativos");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleReenviarSenha(usuario) {
    try {
      const res = await usuariosApi.reenviarSenha(usuario.id);
      setToast({ type: "success", text: res.data.message });
    } catch (err) {
      setToast({ type: "error", text: err.message });
    } finally {
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function handleDelete(id) {
    try {
      await usuariosApi.deletar(id);
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      setError(err.message);
      setDeleteConfirm(null);
    }
  }

  const listaAtual = tab === "pendentes" ? pendentes : ativos;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie os usuários da plataforma</p>
        </div>
        {hasPermission("usuarios.create") && (
          <button
            onClick={() => setModal({ item: null })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo Usuário
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("ativos")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "ativos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Ativos
          <span className="ml-2 text-xs font-bold text-gray-400">{ativos.length}</span>
        </button>
        <button
          onClick={() => setTab("pendentes")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            tab === "pendentes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Pendentes
          {pendentes.length > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold">
              {pendentes.length}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : (
          <UserTable
            usuarios={listaAtual}
            onEdit={(u) => setModal({ item: u })}
            onDelete={setDeleteConfirm}
            onAprovar={setAprovarModal}
            onReenviarSenha={handleReenviarSenha}
            hasPermission={hasPermission}
            showPendentes={tab === "pendentes"}
          />
        )}
      </div>

      {/* Modal editar/criar */}
      {modal !== null && (
        <EditModal
          titulo={modal.item ? "Editar Usuário" : "Novo Usuário"}
          grupos={grupos}
          inicial={modal.item}
          onSave={handleSave}
          onClose={() => setModal(null)}
          loading={saving}
          hasPermission={hasPermission}
        />
      )}

      {/* Modal aprovar */}
      {aprovarModal && (
        <AprovarModal
          usuario={aprovarModal}
          grupos={grupos}
          onAprovar={handleAprovar}
          onClose={() => setAprovarModal(null)}
          loading={saving}
        />
      )}

      {/* Toast reenvio */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === "success"
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {toast.type === "success" ? (
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.text}
        </div>
      )}

      {/* Confirm excluir */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Excluir usuário?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir <span className="font-semibold text-gray-800">{deleteConfirm.nome}</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
