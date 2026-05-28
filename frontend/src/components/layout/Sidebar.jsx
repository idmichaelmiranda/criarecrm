import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { solicitacoesApi, usuariosApi, authApi, instalacaosApi, notificacoesApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { timeAgoFromUTC } from "../../utils/dateUtils";

function Icon({ d }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

const MENU = {
  OPERACIONAL: [
    {
      to: "/admin", end: true, label: "Dashboard", permission: "dashboard.view",
      d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
      to: "/admin/triagem", label: "Triagem", permission: "triagem.view", badge: true,
      d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    },
    {
      to: "/admin/implantacoes", label: "Implantações", permission: "implantacoes.view",
      d: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
    },
    {
      to: "/instalacoes", label: "Instalações", permission: "instalacoes.view", installsBadge: true,
      d: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
    },
    {
      to: "/admin/clientes", label: "Clientes", permission: "clientes.view",
      d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    },
  ],
  CONFIGURACAO: [
    {
      to: "/admin/templates", label: "Templates", permission: "templates.view",
      d: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    },
    {
      to: "/admin/bd-restore", label: "BD Restore", permission: "configuracoes.view", beta: true,
      d: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    },
  ],
  ADMINISTRACAO: [
    {
      to: "/admin/usuarios", label: "Usuários", permission: "usuarios.view", pendenteBadge: true,
      d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    },
    {
      to: "/admin/grupos-permissao", label: "Grupos de Permissão", permission: "grupos.view",
      d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
  ],
};

function NavItem({ item, badge = 0, pendenteBadge = 0, installsBadge = 0 }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-orange-500/15 text-orange-400"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`
      }
    >
      <Icon d={item.d} />
      <span className="flex-1 min-w-0 truncate">{item.label}</span>
      {item.badge && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-orange-500 text-white text-[11px] font-bold leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {item.installsBadge && installsBadge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-orange-500 text-white text-[11px] font-bold leading-none">
          {installsBadge > 99 ? "99+" : installsBadge}
        </span>
      )}
      {item.pendenteBadge && pendenteBadge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold leading-none">
          {pendenteBadge > 99 ? "99+" : pendenteBadge}
        </span>
      )}
      {item.beta && (
        <span className="h-4 px-1.5 flex items-center justify-center rounded text-[9px] font-bold leading-none text-violet-300 bg-violet-500/20 border border-violet-500/30 uppercase tracking-wide">
          Beta
        </span>
      )}
    </NavLink>
  );
}

function NavGroup({ title, items, badge, pendenteBadge, installsBadge, hasPermission }) {
  const visible = items.filter((i) => hasPermission(i.permission));
  if (visible.length === 0) return null;
  return (
    <div className="pt-5 first:pt-0">
      <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 pb-2">
        {title}
      </p>
      {visible.map((item) => (
        <NavItem key={item.to} item={item} badge={badge} pendenteBadge={pendenteBadge} installsBadge={installsBadge} />
      ))}
    </div>
  );
}

// ── Dropdown de notificações ──────────────────────────────────────────────────

const NOTIF_TIPO = {
  instalacao:  { bg: "bg-blue-100",    fg: "text-blue-500",    d: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
  triagem:     { bg: "bg-orange-100",  fg: "text-orange-500",  d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  sla:         { bg: "bg-red-100",     fg: "text-red-500",     d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  implantacao: { bg: "bg-emerald-100", fg: "text-emerald-600", d: "M13 10V3L4 14h7v7l9-11h-7z" },
  sistema:     { bg: "bg-violet-100",  fg: "text-violet-500",  d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
};

const NOTIF_DEFAULT = { bg: "bg-gray-100", fg: "text-gray-400", d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" };

function NotifDropdown({ notifs, onMarcarLida, onMarcarTodas, onClose, navigate }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const naoLidas = notifs.filter((n) => !n.lida);
  const lidas    = notifs.filter((n) => n.lida);

  function handleItemClick(n) {
    onMarcarLida(n.id);
    if (n.dados?.instalacao_id)  navigate(`/instalacoes/${n.dados.instalacao_id}`);
    else if (n.dados?.implantacao_id) navigate(`/admin/implantacoes/${n.dados.implantacao_id}`);
    else if (n.dados?.solicitacao_id) navigate("/admin/triagem");
    onClose();
  }

  function NotifItem({ n }) {
    const cfg = NOTIF_TIPO[n.tipo] || NOTIF_DEFAULT;
    return (
      <button
        onClick={() => handleItemClick(n)}
        className={`w-full text-left px-4 py-3.5 hover:bg-gray-50/80 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0 ${
          !n.lida ? "bg-orange-50/40" : ""
        }`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
          <svg className={`w-4 h-4 ${cfg.fg}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d={cfg.d} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[12.5px] leading-snug font-semibold ${!n.lida ? "text-gray-900" : "text-gray-600"}`}>
            {n.titulo}
          </p>
          {n.mensagem && (
            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.mensagem}</p>
          )}
          <p className="text-[10px] text-gray-400 mt-1.5 font-medium">{timeAgoFromUTC(n.created_at)}</p>
        </div>
        {!n.lida && <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-96 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden left-[252px] top-3"
      style={{
        maxHeight: "520px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gray-50/70 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">Notificações</span>
          {naoLidas.length > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none">
              {naoLidas.length}
            </span>
          )}
        </div>
        {naoLidas.length > 0 && (
          <button
            onClick={onMarcarTodas}
            className="text-[11px] text-orange-500 hover:text-orange-600 font-semibold transition-colors"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Tudo em dia</p>
            <p className="text-xs text-gray-400 mt-1 text-center">Nenhuma notificação no momento.</p>
          </div>
        ) : (
          <>
            {naoLidas.length > 0 && (
              <>
                <div className="px-4 py-2 bg-orange-50/60 border-b border-orange-100/60 sticky top-0">
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Não lidas</span>
                </div>
                {naoLidas.map((n) => <NotifItem key={n.id} n={n} />)}
              </>
            )}
            {lidas.length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Anteriores</span>
                </div>
                {lidas.map((n) => <NotifItem key={n.id} n={n} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sidebar principal ─────────────────────────────────────────────────────────

export function Sidebar() {
  const [triageCount, setTriageCount]         = useState(0);
  const [pendentesCount, setPendentesCount]   = useState(0);
  const [semRespCount, setSemRespCount]       = useState(0);
  const [notifCount, setNotifCount]           = useState(0);
  const [notifs, setNotifs]                   = useState([]);
  const [showNotifs, setShowNotifs]           = useState(false);
  const [uploading, setUploading]             = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout, hasPermission, updateUser } = useAuth();

  // ── Triagem badge ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasPermission("triagem.view")) return;
    const fetch = () =>
      solicitacoesApi.stats()
        .then(({ data }) => setTriageCount((data.nova || 0) + (data.em_triagem || 0)))
        .catch(() => {});
    fetch();
    const interval = setInterval(fetch, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [hasPermission]);

  // ── Usuários pendentes badge ───────────────────────────────────────────────
  useEffect(() => {
    if (!hasPermission("usuarios.view")) return;
    const fetch = () =>
      usuariosApi.pendentesCount()
        .then(({ data }) => setPendentesCount(data.count || 0))
        .catch(() => {});
    fetch();
    const interval = setInterval(fetch, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [hasPermission]);

  // ── Instalações sem responsável badge ─────────────────────────────────────
  useEffect(() => {
    if (!hasPermission("instalacoes.view")) return;
    const fetch = () =>
      instalacaosApi.stats()
        .then(({ data }) => setSemRespCount(data.sem_responsavel || 0))
        .catch(() => {});
    fetch();
    const interval = setInterval(fetch, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [hasPermission]);

  // ── Notificações do usuário ────────────────────────────────────────────────
  useEffect(() => {
    const fetchCount = () =>
      notificacoesApi.naoLidasCount()
        .then(({ data }) => setNotifCount(data.count || 0))
        .catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  async function handleOpenNotifs() {
    if (showNotifs) { setShowNotifs(false); return; }
    try {
      const { data } = await notificacoesApi.listar();
      setNotifs(data);
    } catch {}
    setShowNotifs(true);
  }

  async function handleMarcarLida(id) {
    try { await notificacoesApi.marcarLida(id); } catch {}
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
    setNotifCount((c) => Math.max(0, c - 1));
  }

  async function handleMarcarTodas() {
    try { await notificacoesApi.marcarTodasLidas(); } catch {}
    setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
    setNotifCount(0);
  }

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const handleAvatarClick = () => { if (!uploading) fileInputRef.current?.click(); };

  const handleAvatarChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { data } = await authApi.uploadAvatar(file);
      updateUser(data);
    } catch {}
    finally { setUploading(false); }
  }, [updateUser]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-[#1B2240] flex flex-col z-30">
      {/* User header — topo */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5 shrink-0">
        {user && (
          <div className="flex items-center gap-2">
            {/* Avatar clicável */}
            <button
              onClick={handleAvatarClick}
              title="Alterar foto"
              disabled={uploading}
              className="relative w-10 h-10 rounded-full shrink-0 group focus:outline-none"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.nome} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-400 text-sm font-bold">{user.nome.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </span>
            </button>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-300 truncate">{user.nome}</p>
              <p className="text-[10px] text-slate-600 truncate">{user.grupo_nome || "Sem grupo"}</p>
            </div>

            {/* Sino de notificações */}
            <button
              onClick={handleOpenNotifs}
              title="Notificações"
              className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all shrink-0 ${
                showNotifs
                  ? "text-orange-400 bg-orange-500/20"
                  : notifCount > 0
                  ? "text-slate-300 bg-white/8 hover:bg-white/12"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/8"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none animate-pulse shadow-sm">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        <NavGroup title="Operacional"   items={MENU.OPERACIONAL}   badge={triageCount}   pendenteBadge={0}             installsBadge={semRespCount} hasPermission={hasPermission} />
        <NavGroup title="Configuração"  items={MENU.CONFIGURACAO}  badge={0}             pendenteBadge={0}             installsBadge={0}            hasPermission={hasPermission} />
        <NavGroup title="Administração" items={MENU.ADMINISTRACAO} badge={0}             pendenteBadge={pendentesCount} installsBadge={0}            hasPermission={hasPermission} />
      </nav>

      {/* Brand footer — rodapé */}
      <div className="px-4 py-4 border-t border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden ring-1 ring-white/10 shrink-0 shadow-lg">
              <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-[15px] leading-none tracking-tight">CriareTI</p>
              <span className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-none">
                Implantações
              </span>
            </div>
          </div>
          {hasPermission("configuracoes.view") && (
            <button
              onClick={() => navigate("/admin/configuracoes")}
              title="Configurações"
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-all shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sair
        </button>
      </div>

      {/* Dropdown de notificações — posicionado à direita do sidebar */}
      {showNotifs && (
        <NotifDropdown
          notifs={notifs}
          onMarcarLida={handleMarcarLida}
          onMarcarTodas={handleMarcarTodas}
          onClose={() => setShowNotifs(false)}
          navigate={navigate}
        />
      )}
    </aside>
  );
}
