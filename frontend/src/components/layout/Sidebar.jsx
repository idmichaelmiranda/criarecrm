import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { solicitacoesApi, usuariosApi, authApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

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
      to: "/instalacoes", label: "Instalações", permission: "instalacoes.view",
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

function NavItem({ item, badge = 0, pendenteBadge = 0 }) {
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

function NavGroup({ title, items, badge, pendenteBadge, hasPermission }) {
  const visible = items.filter((i) => hasPermission(i.permission));
  if (visible.length === 0) return null;
  return (
    <div className="pt-5 first:pt-0">
      <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 pb-2">
        {title}
      </p>
      {visible.map((item) => (
        <NavItem key={item.to} item={item} badge={badge} pendenteBadge={pendenteBadge} />
      ))}
    </div>
  );
}

export function Sidebar() {
  const [triageCount, setTriageCount]     = useState(0);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout, hasPermission, updateUser } = useAuth();

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

  const handleAvatarClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleAvatarChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { data } = await authApi.uploadAvatar(file);
      updateUser(data);
    } catch {
      // silently ignore — user can retry
    } finally {
      setUploading(false);
    }
  }, [updateUser]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-[#1B2240] flex flex-col z-30">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-white/5 shrink-0">
        <div className="flex items-start justify-between gap-2">
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
              className="w-6 h-6 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-all shrink-0 mt-0.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        <NavGroup title="Operacional"   items={MENU.OPERACIONAL}   badge={triageCount}   pendenteBadge={0}             hasPermission={hasPermission} />
        <NavGroup title="Configuração"  items={MENU.CONFIGURACAO}  badge={0}             pendenteBadge={0}             hasPermission={hasPermission} />
        <NavGroup title="Administração" items={MENU.ADMINISTRACAO} badge={0}             pendenteBadge={pendentesCount} hasPermission={hasPermission} />
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/5 shrink-0">
        {user && (
          <div className="flex items-center gap-3 mb-3">
            {/* Clickable avatar */}
            <button
              onClick={handleAvatarClick}
              title="Alterar foto"
              disabled={uploading}
              className="relative w-10 h-10 rounded-full shrink-0 group focus:outline-none"
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.nome}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-400 text-sm font-bold">
                    {user.nome.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {/* Hover overlay */}
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

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-300 truncate">{user.nome}</p>
              <p className="text-[10px] text-slate-600 truncate">{user.grupo_nome || "Sem grupo"}</p>
            </div>
          </div>
        )}
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
    </aside>
  );
}
