import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// ── Toast ─────────────────────────────────────────────────────────────────────

function SuccessToast({ onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 7000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-8 right-8 z-50 max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-gray-100">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Solicitação enviada!</p>
          <p className="text-xs text-gray-500 mt-1">Nossa equipe entrará em contato em breve.</p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 ml-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Dashboard Mockup (hero direito) ───────────────────────────────────────────

function DashboardMockup() {
  const kpis = [
    { label: "Vendas hoje",    value: "R$ 62.540", delta: "+12,5%" },
    { label: "Pedidos",        value: "152",        delta: "+8,1%"  },
    { label: "Ticket médio",   value: "R$ 412,30",  delta: "+5,3%"  },
    { label: "Clientes ativos",value: "1.289",      delta: "+3,7%"  },
  ];

  const navPaths = [
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  ];

  return (
    <div className="relative flex items-center justify-center h-full select-none">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 right-0 w-80 h-80 rounded-full"
          style={{ background: "rgba(59,130,246,0.07)", filter: "blur(56px)" }} />
        <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full"
          style={{ background: "rgba(99,102,241,0.06)", filter: "blur(44px)" }} />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full"
          style={{ background: "rgba(16,185,129,0.05)", filter: "blur(36px)" }} />
      </div>

      {/* Desktop card */}
      <div className="relative z-10" style={{
        width: 400,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.07)",
        background: "white",
      }}>
        {/* Window chrome */}
        <div style={{ height: 30, background: "#1e293b", display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
          {["#ef4444","#f59e0b","#22c55e"].map((c) => (
            <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.85 }} />
          ))}
        </div>

        <div style={{ display: "flex" }}>
          {/* Sidebar */}
          <div style={{ width: 52, background: "#1e293b", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 5, minHeight: 360 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, overflow: "hidden", marginBottom: 10, border: "1px solid rgba(245,99,22,0.45)" }}>
              <img src="/logo.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            {navPaths.map((d, i) => (
              <div key={i} style={{
                width: 32, height: 32, borderRadius: 8,
                background: i === 0 ? "rgba(245,99,22,0.22)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg style={{ width: 14, height: 14, color: i === 0 ? "#F56316" : "rgba(148,163,184,0.55)" }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d={d} />
                </svg>
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, background: "#f8fafc", padding: "14px 13px" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: "0 0 12px" }}>Visão Geral</p>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {kpis.map((k) => (
                <div key={k.label} style={{ background: "white", borderRadius: 8, padding: "8px 10px", border: "1px solid #f1f5f9" }}>
                  <p style={{ fontSize: 7.5, color: "#94a3b8", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.label}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: "0 0 1px" }}>{k.value}</p>
                  <p style={{ fontSize: 8, color: "#10b981", margin: 0, fontWeight: 600 }}>{k.delta} vs ontem</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div style={{ background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid #f1f5f9", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p style={{ fontSize: 9, fontWeight: 600, color: "#64748b", margin: 0 }}>Evolução de vendas</p>
                <p style={{ fontSize: 7.5, color: "#94a3b8", margin: 0 }}>Últimos 7 dias</p>
              </div>
              <svg viewBox="0 0 220 46" style={{ width: "100%", height: 46, display: "block" }}>
                <defs>
                  <linearGradient id="lndChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <polygon
                  points="0,38 28,32 55,35 82,20 110,28 137,14 165,22 193,9 220,17 220,46 0,46"
                  fill="url(#lndChartGrad)"
                />
                <polyline
                  points="0,38 28,32 55,35 82,20 110,28 137,14 165,22 193,9 220,17"
                  fill="none" stroke="#3b82f6" strokeWidth={1.8}
                  strokeLinejoin="round" strokeLinecap="round"
                />
                {["S","T","Q","Q","S","S","D"].map((d, i) => (
                  <text key={i} x={i * 34 + 4} y={44} style={{ fontSize: 6.5, fill: "#94a3b8", fontFamily: "system-ui,sans-serif" }}>{d}</text>
                ))}
              </svg>
            </div>

            {/* Activity */}
            <div style={{ background: "white", borderRadius: 8, padding: "7px 10px", border: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🧾</div>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 600, color: "#1e293b", margin: 0 }}>Pedido #1524</p>
                  <p style={{ fontSize: 7.5, color: "#94a3b8", margin: 0 }}>R$ 1.250,00</p>
                </div>
              </div>
              <span style={{ fontSize: 7.5, background: "#dcfce7", color: "#16a34a", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>Concluído</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      <div className="absolute z-20" style={{
        right: 0,
        bottom: 20,
        width: 126,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 20px 52px rgba(0,0,0,0.18), 0 4px 14px rgba(0,0,0,0.12)",
        border: "3.5px solid #1e293b",
        background: "#1e293b",
      }}>
        <div style={{ height: 18, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 30, height: 3.5, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
        </div>
        <div style={{ background: "white", margin: "0 3px 3px", borderRadius: 12, padding: "9px 9px 10px" }}>
          <p style={{ fontSize: 7.5, fontWeight: 700, color: "#1e293b", margin: "0 0 7px" }}>Resumo do dia</p>
          {[
            { label: "Vendas",   value: "R$ 62.540", delta: "+12,9%" },
            { label: "Pedidos",  value: "152",        delta: "+8,1%"  },
            { label: "Clientes", value: "1.289",      delta: "+3,7%"  },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <p style={{ fontSize: 7, color: "#64748b", margin: 0 }}>{item.label}</p>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 7.5, fontWeight: 700, color: "#1e293b", margin: 0 }}>{item.value}</p>
                <p style={{ fontSize: 6.5, color: "#10b981", margin: 0, fontWeight: 600 }}>{item.delta}</p>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 7, padding: "4px 0", background: "#F56316", borderRadius: 7, textAlign: "center" }}>
            <p style={{ fontSize: 7.5, fontWeight: 600, color: "white", margin: 0 }}>Ver relatórios</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section Divider ───────────────────────────────────────────────────────────

function SectionDivider({ nextId, toTop = false }) {
  function handleClick() {
    if (toTop) window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(nextId)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: 72, overflow: "visible", zIndex: 5 }}>
      <div style={{
        position: "absolute", top: "50%", left: 0, right: 0,
        height: 1, transform: "translateY(-50%)",
        background: "linear-gradient(90deg, transparent 0%, rgba(203,213,225,0.5) 20%, rgba(203,213,225,0.9) 50%, rgba(203,213,225,0.5) 80%, transparent 100%)",
      }} />
      <button
        className="cs-btn relative z-10 flex flex-col items-center"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", gap: 0 }}
        onClick={handleClick}
        aria-label={toTop ? "Voltar ao topo" : "Próxima seção"}
      >
        {toTop ? (
          <>
            <svg className="cs-arrow2-up" style={{ width: 11, height: 11, color: "rgba(245,99,22,0.42)", marginBottom: -3 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 15l7-7 7 7" />
            </svg>
            <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
              <div className="cs-ring absolute inset-0 rounded-full" style={{ border: "1px dashed rgba(245,99,22,0.38)" }} />
              <div className="cs-glow absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,99,22,0.1) 0%, transparent 70%)" }} />
              <svg className="cs-arrow1-up relative z-10" style={{ width: 18, height: 18, color: "rgba(245,99,22,0.9)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
              <div className="cs-ring absolute inset-0 rounded-full" style={{ border: "1px dashed rgba(245,99,22,0.38)" }} />
              <div className="cs-glow absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,99,22,0.1) 0%, transparent 70%)" }} />
              <svg className="cs-arrow1 relative z-10" style={{ width: 18, height: 18, color: "rgba(245,99,22,0.9)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <svg className="cs-arrow2" style={{ width: 11, height: 11, color: "rgba(245,99,22,0.42)", marginTop: -3 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}

// ── Floating Scroll Navigator ─────────────────────────────────────────────────

const SCROLL_SECTIONS = [
  { id: "hero" },
  { id: "como-funciona" },
  { id: "o-que-fazemos" },
  { id: "seguranca" },
  { id: "cta" },
];

function FloatingScrollNav() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hidden,    setHidden]    = useState(false);

  useEffect(() => {
    const sectionObs = SCROLL_SECTIONS.map(({ id }, i) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActiveIdx(i); },
        { threshold: 0, rootMargin: "-45% 0px -45% 0px" }
      );
      obs.observe(el);
      return obs;
    }).filter(Boolean);

    const footer = document.querySelector("footer");
    let footerObs = null;
    if (footer) {
      footerObs = new IntersectionObserver(
        ([e]) => setHidden(e.isIntersecting),
        { threshold: 0.05 }
      );
      footerObs.observe(footer);
    }

    return () => {
      sectionObs.forEach(o => o.disconnect());
      footerObs?.disconnect();
    };
  }, []);

  const isLast = activeIdx === SCROLL_SECTIONS.length - 1;

  function handleClick() {
    if (isLast) window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(SCROLL_SECTIONS[activeIdx + 1].id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center"
      style={{
        opacity: (hidden || activeIdx > 0) ? 0 : 1,
        pointerEvents: (hidden || activeIdx > 0) ? "none" : "auto",
        transition: "opacity 0.4s ease",
      }}
    >
      <button
        className="cs-btn flex flex-col items-center gap-0"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        aria-label={isLast ? "Voltar ao topo" : "Próxima seção"}
        onClick={handleClick}
      >
        {isLast ? (
          <>
            <svg className="cs-arrow2-up" style={{ width: 11, height: 11, color: "rgba(245,99,22,0.42)", marginBottom: -3 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 15l7-7 7 7" />
            </svg>
            <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
              <div className="cs-ring absolute inset-0 rounded-full" style={{ border: "1px dashed rgba(245,99,22,0.38)" }} />
              <div className="cs-glow absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,99,22,0.1) 0%, transparent 70%)" }} />
              <svg className="cs-arrow1-up relative z-10" style={{ width: 18, height: 18, color: "rgba(245,99,22,0.9)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
              <div className="cs-ring absolute inset-0 rounded-full" style={{ border: "1px dashed rgba(245,99,22,0.38)" }} />
              <div className="cs-glow absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,99,22,0.1) 0%, transparent 70%)" }} />
              <svg className="cs-arrow1 relative z-10" style={{ width: 18, height: 18, color: "rgba(245,99,22,0.9)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <svg className="cs-arrow2" style={{ width: 11, height: 11, color: "rgba(245,99,22,0.42)", marginTop: -3 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showToast, setShowToast] = useState(searchParams.get("enviado") === "1");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { if (showToast) setSearchParams({}, { replace: true }); }, []);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="min-h-screen antialiased" style={{ background: "#ffffff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1e293b" }}>
      <style>{`
        @keyframes csArrow1    { 0%,100%{transform:translateY(0);opacity:.9}  50%{transform:translateY(6px);opacity:.3}  }
        @keyframes csArrow2    { 0%,100%{transform:translateY(0);opacity:.42} 50%{transform:translateY(6px);opacity:.08} }
        @keyframes csArrow1Up  { 0%,100%{transform:translateY(0);opacity:.9}  50%{transform:translateY(-6px);opacity:.3}  }
        @keyframes csArrow2Up  { 0%,100%{transform:translateY(0);opacity:.42} 50%{transform:translateY(-6px);opacity:.08} }
        @keyframes csGlowPulse { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes csOrbitSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .cs-ring      { animation: csOrbitSpin 7s linear infinite; }
        .cs-arrow1    { animation: csArrow1    2s ease-in-out infinite; }
        .cs-arrow2    { animation: csArrow2    2s ease-in-out infinite .28s; }
        .cs-arrow1-up { animation: csArrow1Up  2s ease-in-out infinite; }
        .cs-arrow2-up { animation: csArrow2Up  2s ease-in-out infinite .28s; }
        .cs-glow      { animation: csGlowPulse 2s ease-in-out infinite; }
        .cs-btn:hover .cs-ring { border-color: rgba(245,99,22,.7); }
      `}</style>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.95)" : "white",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: "1px solid #f1f5f9",
          boxShadow: scrolled ? "0 1px 12px rgba(0,0,0,0.06)" : "none",
        }}>
        <div className="relative max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-gray-100 shadow-sm">
              <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-base tracking-tight text-gray-900">Criare TI</span>
          </div>

          <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
            <a href="#como-funciona" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Como funciona</a>
            <a href="#o-que-fazemos" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">O que fazemos</a>
          </nav>

          <button
            onClick={() => navigate("/solicitar")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", boxShadow: "0 2px 12px rgba(245,99,22,0.28)" }}
          >
            Solicitar Implantação
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="hero" className="relative overflow-hidden bg-white">
        {/* Subtle top-right glow */}
        <div className="absolute top-0 right-0 w-[700px] h-[500px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.06) 0%, transparent 60%)" }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 20% 90%, rgba(99,102,241,0.05) 0%, transparent 60%)" }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-4 sm:pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">

            {/* Left */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5"
                style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                <svg className="w-3.5 h-3.5 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-semibold text-orange-600 tracking-wide">ERP especializado para o varejo</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl font-black leading-[1.1] tracking-tight mb-4 text-gray-900">
                Seu ERP completo<br />
                para uma gestão<br />
                <span style={{ color: "#F56316" }}>mais segura e ágil</span>
              </h1>

              <p className="text-base text-gray-500 leading-relaxed mb-5 max-w-md">
                O ERP Criare foi desenvolvido para simplificar sua operação,
                reduzir riscos e dar visibilidade total do seu negócio.
              </p>

              {/* Trust badges — 2×2 */}
              <div className="grid grid-cols-2 gap-2.5 mb-6 max-w-sm">
                {[
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,             label: "Implantação em 4 etapas" },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />, label: "Suporte pós go-live" },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />, label: "Ambiente seguro" },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,               label: "Retorno rápido e mensurável" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#fff7ed" }}>
                      <svg className="w-3.5 h-3.5" style={{ color: "#F56316" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {s.icon}
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-gray-600 leading-snug">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => navigate("/solicitar")}
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-white text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", boxShadow: "0 8px 28px rgba(245,99,22,0.32)" }}
                >
                  Solicitar Implantação
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <button
                  onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Falar com um especialista
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Right: dashboard mockup */}
            <div className="relative h-[280px] sm:h-[380px] lg:h-[460px]">
              <DashboardMockup />
            </div>
          </div>

        </div>
      </section>

      <SectionDivider nextId="o-que-fazemos" />

      {/* ── O que fazemos ── */}
      <section id="o-que-fazemos" style={{ background: "#f8fafc" }} className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">O que configuramos</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">
              Tudo que sua operação precisa, em um só lugar
            </h2>
            <p className="text-gray-500 text-base max-w-lg mx-auto">
              Do fiscal ao treinamento — configuramos, testamos e entregamos tudo funcionando.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { color: "#F56316", iconPath: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", title: "Gestão de Vendas",       bullets: ["PDV integrado e ágil", "Pedidos, orçamentos e NF-e", "Comissão de vendedores"] },
              { color: "#0ea5e9", iconPath: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",                                                                                                                                        title: "Estoque Inteligente",   bullets: ["Inventário em tempo real", "Reposição automática por mínimo", "Rastreio por lote e validade"] },
              { color: "#10b981", iconPath: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",                         title: "Financeiro Integrado",  bullets: ["Fluxo de caixa em tempo real", "Contas a pagar e receber", "Conciliação bancária automática"] },
              { color: "#7c3aed", iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",                                                                                  title: "Fiscal e Tributário",   bullets: ["Emissão de NF-e, NFC-e e CT-e", "Cálculo automático de impostos", "Obrigações acessórias (SPED, EFD)"] },
              { color: "#f59e0b", iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", title: "Relatórios e BI",       bullets: ["Dashboards de vendas e estoque", "Indicadores de performance (KPIs)", "Exportação para Excel e PDF"] },
              { color: "#e11d48", iconPath: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",          title: "Segurança e Permissões",bullets: ["Perfis de acesso por usuário", "Log de auditoria completo", "Backup automático e criptografado"] },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 hover:shadow-md transition-all duration-200 cursor-default group" style={{ border: "1px solid #e2e8f0" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110" style={{ background: `${f.color}18` }}>
                  <svg className="w-5 h-5" style={{ color: f.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.iconPath} />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 leading-snug">{f.title}</h3>
                <ul className="space-y-1.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: f.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs text-gray-500 leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider nextId="como-funciona" />

      {/* ── Como funciona ── */}
      <section id="como-funciona" style={{ background: "#ffffff" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Como funciona</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">
              Quatro etapas até o sistema no ar
            </h2>
            <p className="text-gray-500 text-base max-w-lg mx-auto">
              Um processo simples e guiado — do primeiro contato ao go-live, com suporte em cada etapa.
            </p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-10 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px"
              style={{ background: "linear-gradient(90deg, rgba(245,99,22,0.25) 0%, rgba(245,99,22,0.1) 50%, rgba(245,99,22,0.25) 100%)" }} />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
              {[
                {
                  n: "01",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
                  title: "Preencha o formulário",
                  desc: "Informe os dados da empresa, regime tributário e configurações fiscais em um formulário guiado — leva menos de 10 minutos.",
                  time: "~10 min",
                },
                {
                  n: "02",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
                  title: "Nossa equipe analisa",
                  desc: "Especialistas revisam cada informação e preparam o ambiente do sistema personalizado para o seu negócio.",
                  time: "1–2 dias úteis",
                },
                {
                  n: "03",
                  icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.28c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
                  title: "Implantação e homologação",
                  desc: "Instalamos e configuramos todo o sistema, executamos testes e validações em ambiente de homologação antes do go-live.",
                  time: "3–5 dias úteis",
                },
                {
                  n: "04",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
                  title: "Sistema em produção",
                  desc: "Go-live com acompanhamento total, treinamento da equipe e suporte dedicado nos primeiros dias de operação.",
                  time: "Go Live! 🚀",
                },
              ].map((step) => (
                <div key={step.n} className="flex flex-col items-center text-center">
                  <div className="relative mb-6 shrink-0">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10 bg-white border border-gray-200 shadow-sm">
                      <svg className="w-6 h-6" style={{ color: "#F56316" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        {step.icon}
                      </svg>
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: "#F56316" }}>
                      {step.n}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1">{step.desc}</p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-5 shrink-0"
                    style={{ background: "#fff7ed", color: "#F56316", border: "1px solid #fed7aa" }}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {step.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionDivider nextId="seguranca" />

      {/* ── Confiança / Trust ── */}
      <section id="seguranca" style={{ background: "#f8fafc" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-20">
          <div className="rounded-3xl px-5 py-8 sm:px-10 sm:py-12 bg-white border border-gray-200 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
              <div>
                <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-4">Seguro e confiável</p>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-4">
                  Seus dados tratados com<br />total confidencialidade.
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  Todas as informações enviadas no formulário são tratadas com sigilo absoluto, usadas exclusivamente
                  para a configuração do seu sistema de gestão.
                </p>
                <button
                  onClick={() => navigate("/solicitar")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}
                >
                  Começar agora
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: "🔒", title: "LGPD Compliant",     desc: "Dados protegidos conforme a Lei Geral de Proteção de Dados" },
                  { icon: "🛡️", title: "Conexão segura",     desc: "Transmissão criptografada SSL/TLS em todo o formulário"       },
                  { icon: "👥", title: "Equipe certificada", desc: "Especialistas com experiência em ERP de varejo"               },
                  { icon: "📞", title: "Suporte dedicado",   desc: "Canal direto com a equipe durante toda a implantação"          },
                ].map((t) => (
                  <div key={t.title} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-xl block mb-2">{t.icon}</span>
                    <p className="text-xs font-bold text-gray-800 mb-1">{t.title}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider nextId="cta" />

      {/* ── CTA Final ── */}
      <section id="cta" className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-24">
        <div className="rounded-3xl p-6 sm:p-12 text-center relative overflow-hidden"
          style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(245,99,22,0.1) 0%, transparent 65%)" }} />

          <div className="relative flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-orange-200 shadow-md">
              <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-3">
              Pronto para começar?
            </h2>
            <p className="text-gray-500 text-base mb-8 max-w-md mx-auto leading-relaxed">
              Preencha o formulário em poucos minutos e nossa equipe entra em contato para iniciar a implantação do seu sistema.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate("/solicitar")}
                className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl font-bold text-white text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", boxShadow: "0 8px 32px rgba(245,99,22,0.35)" }}
              >
                Solicitar Implantação
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Retorno em até 2 dias úteis
              </p>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider toTop />

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid #f1f5f9" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-lg overflow-hidden opacity-50 border border-gray-100">
            <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
          </div>
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Criare TI. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <FloatingScrollNav />

      {showToast && <SuccessToast onClose={() => setShowToast(false)} />}
    </div>
  );
}
