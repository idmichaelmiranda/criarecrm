import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

// SVGs em vez de emoji de bandeira — Windows não tem glifo de bandeira na
// fonte padrão (Segoe UI Emoji) e renderiza só o código do país em texto.
function FlagIcon({ code, className }) {
  const uid = useId();
  const clipId = `flag-clip-${uid}`;
  return (
    <svg viewBox="0 0 20 14" width="20" height="14" className={className} aria-hidden="true">
      <clipPath id={clipId}>
        <rect width="20" height="14" rx="2.5" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {code === "pt-BR" && (
          <>
            <rect width="20" height="14" fill="#009739" />
            <polygon points="10,2 18.5,7 10,12 1.5,7" fill="#FEDD00" />
            <circle cx="10" cy="7" r="3" fill="#012169" />
            <path d="M6.3 6 Q10 4.6 13.7 6.5" stroke="#fff" strokeWidth="0.5" fill="none" />
          </>
        )}
        {code === "en" && (
          <>
            <rect width="20" height="14" fill="#fff" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect key={i} y={i * 2} width="20" height="2" fill={i % 2 === 0 ? "#B22234" : "#fff"} />
            ))}
            <rect width="9" height="7.5" fill="#3C3B6E" />
          </>
        )}
        {code === "es" && (
          <>
            <rect width="20" height="14" fill="#AA151B" />
            <rect y="3.5" width="20" height="7" fill="#F1BF00" />
          </>
        )}
      </g>
    </svg>
  );
}

const LANGUAGES = [
  { code: "pt-BR", short: "PT" },
  { code: "en", short: "EN" },
  { code: "es", short: "ES" },
];

// Seletor de idioma reutilizável — usePortal=true escapa de ancestrais com
// overflow:hidden/position:fixed (ex.: Sidebar), mesmo padrão do NotifDropdown.
export function LanguageSwitcher({ theme = "light", usePortal = false, iconOnly = false, className = "" }) {
  const { t, i18n } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function toggleOpen() {
    if (!open && usePortal && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen((v) => !v);
  }

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  const btnClasses = theme === "dark"
    ? "flex items-center justify-center gap-1 rounded-lg text-slate-300 bg-white/8 hover:bg-white/12 transition-all"
    : "flex items-center gap-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors";

  const menu = (
    <div
      ref={menuRef}
      className={`${usePortal ? "fixed" : "absolute"} z-50 mt-1 min-w-[168px] bg-white rounded-xl border border-gray-100 shadow-xl py-1 overflow-hidden`}
      style={usePortal ? { top: menuPos?.top, left: menuPos?.left } : { top: "100%", right: 0 }}
    >
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => { i18n.changeLanguage(l.code); setOpen(false); }}
          className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors ${
            l.code === i18n.language ? "text-orange-600 font-semibold" : "text-gray-600"
          }`}
        >
          <span className="flex items-center gap-2">
            <FlagIcon code={l.code} className="shrink-0 rounded-[1px] ring-1 ring-black/5" />
            {t(`language.${l.code}`)}
          </span>
          {l.code === i18n.language && (
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        title={t("language.label")}
        className={`${btnClasses} ${iconOnly ? "w-8 h-8" : "px-2.5 py-1.5 text-xs font-semibold"}`}
      >
        <FlagIcon code={current.code} className="shrink-0 rounded-[1px] ring-1 ring-black/10" />
        {!iconOnly && <span>{current.short}</span>}
      </button>
      {open && (usePortal ? createPortal(menu, document.body) : menu)}
    </div>
  );
}
