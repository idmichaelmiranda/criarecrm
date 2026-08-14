import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { solicitacoesApi, usuariosApi, authApi, instalacaosApi, notificacoesApi, solicitacoesInstaladorApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { timeAgoFromUTC } from "../../utils/dateUtils";
import { LanguageSwitcher } from "../LanguageSwitcher";

function getStrength(s) {
  if (!s) return 0;
  let n = 0;
  if (s.length >= 8) n++;
  if (/[A-Z]/.test(s)) n++;
  if (/\d/.test(s)) n++;
  if (/[^A-Za-z0-9]/.test(s)) n++;
  return n;
}
const STRENGTH_LEVELS = [
  null,
  { key: "weak",   bar: "bg-red-500",    w: "w-1/4" },
  { key: "fair",   bar: "bg-yellow-500", w: "w-2/4" },
  { key: "good",   bar: "bg-blue-500",   w: "w-3/4" },
  { key: "strong", bar: "bg-green-500",  w: "w-full" },
];

function AlterarSenhaModal({ onClose }) {
  const { t } = useTranslation("sidebar");
  const [form, setForm]       = useState({ atual: "", nova: "", confirma: "" });
  const [show, setShow]       = useState({ atual: false, nova: false, confirma: false });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const str   = getStrength(form.nova);
  const level = STRENGTH_LEVELS[str];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.atual) { setError(t("alterarSenha.errorCurrentRequired")); return; }
    if (form.nova.length < 8) { setError(t("alterarSenha.errorMinLength")); return; }
    if (form.nova !== form.confirma) { setError(t("alterarSenha.errorMismatch")); return; }
    setLoading(true);
    try {
      await usuariosApi.alterarSenha({ senha_atual: form.atual, senha_nova: form.nova });
      setSuccess(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err.message || t("alterarSenha.errorDefault"));
    } finally {
      setLoading(false);
    }
  }

  function EyeBtn({ field }) {
    return (
      <button type="button" tabIndex={-1} onClick={() => setShow((p) => ({ ...p, [field]: !p[field] }))}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show[field]
          ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
          : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        }
      </button>
    );
  }

  const inp = "w-full px-3 py-2.5 pr-10 rounded-xl text-sm text-gray-900 border border-gray-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">{t("alterarSenha.title")}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {success ? (
          <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">{t("alterarSenha.successMessage")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t("alterarSenha.currentPasswordLabel")}</label>
              <div className="relative">
                <input type={show.atual ? "text" : "password"} value={form.atual}
                  onChange={(e) => { setForm((p) => ({ ...p, atual: e.target.value })); setError(""); }}
                  placeholder="••••••••" className={inp} autoFocus />
                <EyeBtn field="atual" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t("alterarSenha.newPasswordLabel")}</label>
              <div className="relative">
                <input type={show.nova ? "text" : "password"} value={form.nova}
                  onChange={(e) => { setForm((p) => ({ ...p, nova: e.target.value })); setError(""); }}
                  placeholder="••••••••" className={inp} />
                <EyeBtn field="nova" />
              </div>
              {form.nova && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${level?.bar ?? ""} ${level?.w ?? "w-0"}`} />
                  </div>
                  <p className={`text-[11px] font-medium ${str === 1 ? "text-red-500" : str === 2 ? "text-yellow-600" : str === 3 ? "text-blue-600" : "text-green-600"}`}>
                    {level?.key && t(`alterarSenha.strength.${level.key}`)}
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t("alterarSenha.confirmPasswordLabel")}</label>
              <div className="relative">
                <input type={show.confirma ? "text" : "password"} value={form.confirma}
                  onChange={(e) => { setForm((p) => ({ ...p, confirma: e.target.value })); setError(""); }}
                  placeholder="••••••••"
                  className={`${inp} ${form.confirma && form.confirma !== form.nova ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`} />
                <EyeBtn field="confirma" />
              </div>
              {form.confirma && form.confirma !== form.nova && (
                <p className="text-[11px] text-red-500 mt-1">{t("alterarSenha.errorMismatch")}</p>
              )}
            </div>
            {error && <p className="text-xs text-red-600 px-3 py-2 rounded-xl bg-red-50 border border-red-100">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">{t("alterarSenha.cancel")}</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {loading ? t("alterarSenha.saving") : t("alterarSenha.title")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

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
      to: "/admin", end: true, labelKey: "dashboard", permission: "dashboard.view",
      d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
      to: "/admin/triagem", labelKey: "triagem", permission: "triagem.view", badge: true,
      d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    },
    {
      to: "/admin/implantacoes", labelKey: "implantacoes", permission: "implantacoes.view",
      d: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
    },
    {
      to: "/instalacoes", labelKey: "instalacoes", permission: "instalacoes.view", installsBadge: true,
      d: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
    },
    {
      to: "/admin/clientes", labelKey: "clientes", permission: "clientes.view",
      d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    },
    {
      to: "/assistente-criare", labelKey: "assistenteCriare", permission: "instalador.aprovar", assistenteBadge: true,
      d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
  ],
  CONFIGURACAO: [
    {
      to: "/admin/templates", labelKey: "templates", permission: "templates.view",
      d: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    },
    {
      to: "/admin/bd-restore", labelKey: "bdRestore", permission: "configuracoes.view", beta: true,
      d: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    },
  ],
  ADMINISTRACAO: [
    {
      to: "/admin/usuarios", labelKey: "usuarios", permission: "usuarios.view", pendenteBadge: true,
      d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    },
    {
      to: "/admin/grupos-permissao", labelKey: "gruposPermissao", permission: "grupos.view",
      d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
    {
      to: "/admin/resultados", labelKey: "resultados", permission: "resultados.view",
      d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    },
  ],
};

// ── Nav Item ──────────────────────────────────────────────────────────────────

function NavItem({ item, badge = 0, pendenteBadge = 0, installsBadge = 0, assistenteBadge = 0, collapsed = false }) {
  const { t } = useTranslation("sidebar");
  const label = t(`nav.${item.labelKey}`);
  const hasBadge =
    (item.badge && badge > 0) ||
    (item.installsBadge && installsBadge > 0) ||
    (item.pendenteBadge && pendenteBadge > 0) ||
    (item.assistenteBadge && assistenteBadge > 0);

  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center rounded-lg text-sm font-medium transition-all duration-150 relative
        ${collapsed ? "justify-center py-2.5 mx-1 px-0" : "gap-3 px-3 py-2.5"}
        ${isActive ? "bg-orange-500/15 text-orange-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`
      }
    >
      <div className="relative shrink-0">
        <Icon d={item.d} />
        {collapsed && hasBadge && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500" />
        )}
      </div>

      {!collapsed && <span className="flex-1 min-w-0 truncate">{label}</span>}

      {!collapsed && item.badge && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-orange-500 text-white text-[11px] font-bold leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {!collapsed && item.installsBadge && installsBadge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-orange-500 text-white text-[11px] font-bold leading-none">
          {installsBadge > 99 ? "99+" : installsBadge}
        </span>
      )}
      {!collapsed && item.pendenteBadge && pendenteBadge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold leading-none">
          {pendenteBadge > 99 ? "99+" : pendenteBadge}
        </span>
      )}
      {!collapsed && item.assistenteBadge && assistenteBadge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold leading-none animate-pulse">
          {assistenteBadge > 99 ? "99+" : assistenteBadge}
        </span>
      )}
      {!collapsed && item.beta && (
        <span className="h-4 px-1.5 flex items-center justify-center rounded text-[9px] font-bold leading-none text-violet-300 bg-violet-500/20 border border-violet-500/30 uppercase tracking-wide">
          {t("nav.beta")}
        </span>
      )}
    </NavLink>
  );
}

function NavGroup({ titleKey, items, badge, pendenteBadge, installsBadge, assistenteBadge, hasPermission, collapsed = false }) {
  const { t } = useTranslation("sidebar");
  const visible = items.filter((i) => hasPermission(i.permission));
  if (visible.length === 0) return null;
  return (
    <div className="pt-4 first:pt-0">
      {collapsed
        ? <div className="h-px bg-white/5 mx-2 mb-2 first:hidden" />
        : <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 pb-2">{t(`nav.groups.${titleKey}`)}</p>
      }
      {visible.map((item) => (
        <NavItem
          key={item.to}
          item={item}
          badge={badge}
          pendenteBadge={pendenteBadge}
          installsBadge={installsBadge}
          assistenteBadge={assistenteBadge}
          collapsed={collapsed}
        />
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
  atraso:      { bg: "bg-amber-100",   fg: "text-amber-600",   d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
};
const NOTIF_DEFAULT = { bg: "bg-gray-100", fg: "text-gray-400", d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" };

function NotifDropdown({ notifs, loading, onMarcarLida, onMarcarTodas, onClose, navigate, collapsed, isMobile }) {
  const { t } = useTranslation("sidebar");
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
    if (n.dados?.instalacao_id)       navigate(`/instalacoes/${n.dados.instalacao_id}`);
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

  const dropdownLeft = isMobile ? "8px" : (collapsed ? "76px" : "252px");

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden top-3"
      style={{
        left: dropdownLeft,
        right: isMobile ? "8px" : "auto",
        width: isMobile ? "auto" : "384px",
        maxHeight: "520px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gray-50/70 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">{t("notif.title")}</span>
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
            {t("notif.markAllRead")}
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">{t("notif.allCaughtUp")}</p>
            <p className="text-xs text-gray-400 mt-1 text-center">{t("notif.noneAtMoment")}</p>
          </div>
        ) : (
          <>
            {naoLidas.length > 0 && (
              <>
                <div className="px-4 py-2 bg-orange-50/60 border-b border-orange-100/60 sticky top-0">
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{t("notif.unread")}</span>
                </div>
                {naoLidas.map((n) => <NotifItem key={n.id} n={n} />)}
              </>
            )}
            {lidas.length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("notif.previous")}</span>
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

// ── Popup senha do dia (modo colapsado) ──────────────────────────────────────

function SenhaDiaPopup({ senhaDia, senhaLoading, senhaVisible, setSenhaVisible, senhaCopied, onCopy, onClose }) {
  const { t } = useTranslation("sidebar");
  const ref = useRef(null);
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-xl border border-white/10 shadow-2xl p-3.5 w-52"
      style={{ left: "clamp(8px, 76px, calc(100vw - 224px))", bottom: "88px", background: "#1B2240" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{t("senhaDia.title")}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setSenhaVisible((v) => !v)} title={senhaVisible ? t("senhaDia.hide") : t("senhaDia.reveal")}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 transition-colors">
            {senhaVisible
              ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            }
          </button>
          <button onClick={onCopy} title={senhaCopied ? t("senhaDia.copied") : t("senhaDia.copy")}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${senhaCopied ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}>
            {senhaCopied
              ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            }
          </button>
        </div>
      </div>
      <p className="font-mono font-bold text-slate-200 text-sm tracking-wider break-all">
        {senhaLoading
          ? <span className="text-slate-500 text-xs font-normal">{t("senhaDia.loading")}</span>
          : senhaDia
            ? (senhaVisible ? senhaDia : "• • • • • •")
            : <span className="text-slate-500 text-xs font-normal">{t("senhaDia.unavailable")}</span>
        }
      </p>
    </div>
  );
}

// ── Sidebar principal ─────────────────────────────────────────────────────────

export function Sidebar({ collapsed = false, onToggle, mobileOpen = false, isMobile = false, onMobileClose }) {
  const { t } = useTranslation("sidebar");
  const [triageCount, setTriageCount]       = useState(0);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [semRespCount, setSemRespCount]     = useState(0);
  const [assistenteCount, setAssistenteCount] = useState(0);
  const [notifCount, setNotifCount]         = useState(0);
  const [notifs, setNotifs]                 = useState([]);
  const [showNotifs, setShowNotifs]         = useState(false);
  const [notifLoading, setNotifLoading]     = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [senhaDia, setSenhaDia]             = useState(null);
  const [senhaLoading, setSenhaLoading]     = useState(true);
  const [senhaVisible, setSenhaVisible]     = useState(false);
  const [senhaCopied, setSenhaCopied]         = useState(false);
  const [showSenhaPopup, setShowSenhaPopup]   = useState(false);
  const [showAlterarSenha, setShowAlterarSenha] = useState(false);
  const fileInputRef = useRef(null);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout, hasPermission, updateUser } = useAuth();

  // Fecha sidebar mobile ao navegar
  useEffect(() => {
    if (onMobileClose) onMobileClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!hasPermission("instalador.aprovar")) return;
    const fetch = () =>
      solicitacoesInstaladorApi.listar({ status: "pendente" })
        .then(({ data }) => setAssistenteCount(data.length || 0))
        .catch(() => {});
    fetch();
    // Poll mais rápido: técnico costuma estar esperando na linha.
    const interval = setInterval(fetch, 10_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [hasPermission]);

  useEffect(() => {
    const fetchCount = () =>
      notificacoesApi.naoLidasCount()
        .then(({ data }) => setNotifCount(data.count || 0))
        .catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 10_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    async function fetchSenha() {
      setSenhaLoading(true);
      try {
        const { data } = await usuariosApi.senhaDia();
        setSenhaDia(data.senha || null);
      } catch {
        setSenhaDia(null);
      } finally {
        setSenhaLoading(false);
      }
    }
    fetchSenha();
    const now = new Date();
    const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1) - now;
    const t = setTimeout(fetchSenha, msToMidnight);
    return () => clearTimeout(t);
  }, []);

  async function handleCopySenha() {
    if (!senhaDia) return;
    try { await navigator.clipboard.writeText(senhaDia); setSenhaCopied(true); setTimeout(() => setSenhaCopied(false), 2000); } catch {}
  }

  async function handleOpenNotifs() {
    if (showNotifs) {
      // Fix #3: ao fechar, sincroniza badge com a lista local atualizada
      setNotifCount(notifs.filter((n) => !n.lida).length);
      setShowNotifs(false);
      return;
    }
    setNotifLoading(true);
    try {
      const { data } = await notificacoesApi.listar();
      setNotifs(data);
      // Fix #2: sincroniza badge com a lista recém-carregada do servidor
      setNotifCount(data.filter((n) => !n.lida).length);
    } catch {
      setNotifs([]);
    } finally {
      setNotifLoading(false);
    }
    setShowNotifs(true);
  }

  async function handleMarcarLida(id) {
    // Fix #1: optimistic update antes do await — UI responde imediatamente
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
    setNotifCount((c) => Math.max(0, c - 1));
    try { await notificacoesApi.marcarLida(id); } catch {}
  }

  async function handleMarcarTodas() {
    // Fix #5: optimistic update antes do await
    setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
    setNotifCount(0);
    try { await notificacoesApi.marcarTodasLidas(); } catch {}
  }

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
    <>
    <aside
      className={`fixed inset-y-0 left-0 bg-[#1B2240] flex flex-col z-30 overflow-hidden
        transition-[width,transform] duration-300 ease-in-out
        ${isMobile && !mobileOpen ? "-translate-x-full" : "translate-x-0"}`}
      style={{ width: isMobile ? "15rem" : (collapsed ? "4rem" : "15rem") }}
    >
      {/* ── Cabeçalho: avatar + info + sino ── */}
      <div className={`border-b border-white/5 shrink-0 ${collapsed ? "px-0 pt-3 pb-3" : "px-4 pt-4 pb-3"}`}>
        {user && (
          collapsed ? (
            /* Modo colapsado: avatar centralizado + sino abaixo */
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAvatarClick}
                title={user.nome}
                disabled={uploading}
                className="relative w-9 h-9 rounded-full shrink-0 group focus:outline-none"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.nome} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-orange-400 text-sm font-bold">{user.nome.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
              </button>

              <LanguageSwitcher theme="dark" usePortal iconOnly />

              <button
                onClick={handleOpenNotifs}
                title={t("notif.title")}
                className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                  showNotifs ? "text-orange-400 bg-orange-500/20" : notifCount > 0 ? "text-slate-300 bg-white/8 hover:bg-white/12" : "text-slate-500 hover:text-slate-300 hover:bg-white/8"
                }`}
              >
                {notifLoading
                  ? <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                }
                {!notifLoading && notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none animate-pulse">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </button>
            </div>
          ) : (
            /* Modo expandido: identidade (linha 1) + barra de acoes (linha 2) */
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAvatarClick}
                  title={t("user.changePhoto")}
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

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-300 truncate">{user.nome}</p>
                  <p className="text-[11px] text-slate-600 truncate">{user.grupo_nome || t("user.noGroup")}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setShowAlterarSenha(true)}
                  title={t("alterarSenha.title")}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-all shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>

                <LanguageSwitcher theme="dark" usePortal iconOnly className="shrink-0" />

                <button
                  onClick={handleOpenNotifs}
                  title={t("notif.title")}
                  className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all shrink-0 ${
                    showNotifs ? "text-orange-400 bg-orange-500/20" : notifCount > 0 ? "text-slate-300 bg-white/8 hover:bg-white/12" : "text-slate-500 hover:text-slate-300 hover:bg-white/8"
                  }`}
                >
                  {notifLoading
                    ? <span className="w-5 h-5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                  }
                  {!notifLoading && notifCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none animate-pulse shadow-sm">
                      {notifCount > 9 ? "9+" : notifCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>

      {/* ── Nav ── */}
      <nav className={`flex-1 py-3 overflow-y-auto space-y-0.5 ${collapsed ? "px-0" : "px-3"}`}>
        <NavGroup titleKey="operacional"    items={MENU.OPERACIONAL}   badge={triageCount}   pendenteBadge={0}              installsBadge={semRespCount} assistenteBadge={assistenteCount} hasPermission={hasPermission} collapsed={collapsed} />
        <NavGroup titleKey="configuracao"   items={MENU.CONFIGURACAO}  badge={0}             pendenteBadge={0}              installsBadge={0}            hasPermission={hasPermission} collapsed={collapsed} />
        <NavGroup titleKey="administracao"  items={MENU.ADMINISTRACAO} badge={0}             pendenteBadge={pendentesCount} installsBadge={0}            hasPermission={hasPermission} collapsed={collapsed} />
      </nav>

      {/* ── Senha do dia ── */}
      {collapsed ? (
        <div className="flex justify-center pb-1 shrink-0">
          <button
            onClick={() => setShowSenhaPopup((v) => !v)}
            title={t("senhaDia.title")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              showSenhaPopup ? "text-amber-400 bg-amber-500/20" : "text-slate-600 hover:text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="mx-3 mb-2 rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2.5 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{t("senhaDia.title")}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setSenhaVisible((v) => !v)} title={senhaVisible ? t("senhaDia.hide") : t("senhaDia.reveal")}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 transition-colors">
                {senhaVisible
                  ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
              <button onClick={handleCopySenha} title={senhaCopied ? t("senhaDia.copied") : t("senhaDia.copy")}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${senhaCopied ? "text-emerald-400" : "text-slate-600 hover:text-slate-300"}`}>
                {senhaCopied
                  ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                }
              </button>
            </div>
          </div>
          <p className="font-mono font-bold text-slate-200 text-sm tracking-wider break-all min-h-[18px]">
            {senhaLoading
              ? <span className="text-slate-600 text-xs font-normal font-sans">{t("senhaDia.loading")}</span>
              : senhaDia
                ? (senhaVisible ? senhaDia : "• • • • • •")
                : <span className="text-slate-600 text-xs font-normal font-sans">{t("senhaDia.unavailable")}</span>
            }
          </p>
        </div>
      )}

      {/* ── Brand footer ── */}
      <div className={`border-t border-white/5 shrink-0 ${collapsed ? "px-0 py-3" : "px-4 py-4"}`}>
        {collapsed ? (
          /* Modo colapsado: logo centralizado + sair */
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-lg shrink-0">
              <img src="/logo.jpg" alt={t("brand.logoAlt")} className="w-full h-full object-cover" />
            </div>
            <button
              onClick={handleLogout}
              title={t("logout")}
              className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-all"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          /* Modo expandido: logo + tagline + config, sair abaixo */
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl overflow-hidden ring-1 ring-white/10 shrink-0 shadow-lg">
                  <img src="/logo.jpg" alt={t("brand.logoAlt")} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-[15px] leading-none tracking-tight">{t("brand.name")}</p>
                  <span className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-none">
                    {t("brand.tagline")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasPermission("configuracoes.view") && (
                  <button
                    onClick={() => navigate("/admin/configuracoes")}
                    title={t("settings")}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-all shrink-0"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t("logout")}
            </button>
          </>
        )}
      </div>

      {/* ── Dropdown de notificações — Portal para escapar do overflow:hidden ── */}
      {showNotifs && createPortal(
        <NotifDropdown
          notifs={notifs}
          loading={notifLoading}
          onMarcarLida={handleMarcarLida}
          onMarcarTodas={handleMarcarTodas}
          onClose={() => setShowNotifs(false)}
          navigate={navigate}
          collapsed={collapsed}
          isMobile={isMobile}
        />,
        document.body
      )}

      {/* ── Popup senha do dia (modo colapsado) ── */}
      {showSenhaPopup && collapsed && (
        <SenhaDiaPopup
          senhaDia={senhaDia}
          senhaLoading={senhaLoading}
          senhaVisible={senhaVisible}
          setSenhaVisible={setSenhaVisible}
          senhaCopied={senhaCopied}
          onCopy={handleCopySenha}
          onClose={() => setShowSenhaPopup(false)}
        />
      )}
    </aside>

    {/* ── Botão toggle — tab visível na borda direita do sidebar (apenas desktop) ── */}
    <button
      onClick={onToggle}
      title={collapsed ? t("toggle.expand") : t("toggle.collapse")}
      className="fixed top-1/2 -translate-y-1/2 z-40 hidden md:flex items-center justify-center
                 bg-[#2a3458] hover:bg-orange-500
                 border border-l-0 border-white/20 hover:border-orange-400
                 text-slate-300 hover:text-white
                 rounded-r-xl shadow-md
                 group"
      style={{
        left: collapsed ? "4rem" : "15rem",
        width: "18px",
        height: "48px",
        transition: "left 300ms ease-in-out, background-color 150ms, border-color 150ms, color 150ms",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {collapsed
          ? <path d="M9 18l6-6-6-6" />
          : <path d="M15 18l-6-6 6-6" />
        }
      </svg>
    </button>

    {showAlterarSenha && <AlterarSenhaModal onClose={() => setShowAlterarSenha(false)} />}
    </>
  );
}
