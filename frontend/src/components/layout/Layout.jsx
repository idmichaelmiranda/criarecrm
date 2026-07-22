import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { usePresentationMode } from "../../contexts/PresentationContext";

export function Layout({ children }) {
  const { t } = useTranslation("sidebar");
  const { on: presentationMode } = usePresentationMode();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function toggle() {
    setCollapsed((v) => {
      localStorage.setItem("sidebar_collapsed", String(!v));
      return !v;
    });
  }

  const sidebarWidth = collapsed ? "64px" : "240px";

  return (
    <div className="flex min-h-screen bg-gray-50">
      {!presentationMode && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {!presentationMode && (
        <Sidebar
          collapsed={collapsed}
          onToggle={toggle}
          mobileOpen={mobileOpen}
          isMobile={isMobile}
          onMobileClose={() => setMobileOpen(false)}
        />
      )}

      <main
        className="flex-1 min-h-screen transition-[margin] duration-300 ease-in-out"
        style={{ marginLeft: presentationMode ? 0 : (isMobile ? 0 : sidebarWidth) }}
      >
        {!presentationMode && (
          <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm md:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label={t("openMenu")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden">
                <img src="/logo.jpg" alt={t("brand.logoAlt")} className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-gray-800 text-sm">{t("brand.name")}</span>
            </div>
          </div>
        )}

        <div className={presentationMode ? "" : "max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 xl:px-8 py-4 md:py-8"}>
          {children}
        </div>
      </main>
    </div>
  );
}
