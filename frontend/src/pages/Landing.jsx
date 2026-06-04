import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CriareEcosystem from "../components/CriareEcosystem";

// ── Toast ─────────────────────────────────────────────────────────────────────

function SuccessToast({ onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 7000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-8 right-8 z-50 max-w-sm rounded-2xl p-5 shadow-2xl"
      style={{ background: "#1B2240", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Solicitação enviada!</p>
          <p className="text-xs text-slate-400 mt-1">Nossa equipe entrará em contato em breve.</p>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-400 ml-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Logo Hero (hero direito) ──────────────────────────────────────────────────

function LogoHero() {
  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Luz de fundo — anel externo difuso */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 480,
          height: 480,
          background: "radial-gradient(circle, rgba(245,99,22,0.18) 0%, rgba(245,99,22,0.05) 45%, transparent 72%)",
          filter: "blur(2px)",
        }}
      />
      {/* Luz intermediária mais quente */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 280,
          height: 280,
          background: "radial-gradient(circle, rgba(245,99,22,0.28) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      {/* Reflexo no chão */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: -40,
          width: 220,
          height: 30,
          background: "radial-gradient(ellipse, rgba(245,99,22,0.22) 0%, transparent 70%)",
          filter: "blur(12px)",
        }}
      />

      {/* Logo */}
      <div className="relative">
        {/* Glow colado na logo */}
        <div
          className="absolute inset-0 rounded-[32px] animate-pulse"
          style={{
            margin: -16,
            background: "linear-gradient(135deg, rgba(245,99,22,0.35), rgba(217,79,13,0.2))",
            filter: "blur(24px)",
            borderRadius: 48,
          }}
        />
        <div
          className="relative overflow-hidden"
          style={{
            width: 160,
            height: 160,
            borderRadius: 36,
            boxShadow: "0 0 0 1.5px rgba(245,99,22,0.4), 0 32px 80px rgba(245,99,22,0.3), 0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
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
    <div
      className="relative w-full flex items-center justify-center"
      style={{ height: 72, overflow: "visible", zIndex: 5 }}
    >
      {/* Horizontal line through vertical center */}
      <div style={{
        position: "absolute",
        top: "50%", left: 0, right: 0,
        height: 1,
        transform: "translateY(-50%)",
        background: "linear-gradient(90deg, transparent 0%, rgba(245,99,22,0.08) 15%, rgba(245,99,22,0.22) 50%, rgba(245,99,22,0.08) 85%, transparent 100%)",
      }} />

      {/* Orbital scroll button sitting on the line */}
      <button
        className="cs-btn relative z-10 flex flex-col items-center"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", gap: 0 }}
        onClick={handleClick}
        aria-label={toTop ? "Voltar ao topo" : "Próxima seção"}
      >
        {toTop ? (
          /* ↑ Back-to-top variant: echo above, ring below */
          <>
            <svg
              className="cs-arrow2-up"
              style={{ width: 11, height: 11, color: "rgba(245,99,22,0.42)", marginBottom: -3 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
            ><path d="M5 15l7-7 7 7" /></svg>
            <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
              <div className="cs-ring absolute inset-0 rounded-full"
                style={{ border: "1px dashed rgba(245,99,22,0.38)" }} />
              <div className="cs-glow absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(245,99,22,0.13) 0%, transparent 70%)" }} />
              <svg
                className="cs-arrow1-up relative z-10"
                style={{ width: 18, height: 18, color: "rgba(245,99,22,0.95)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round"
              ><path d="M5 15l7-7 7 7" /></svg>
            </div>
          </>
        ) : (
          /* ↓ Scroll-down variant: ring above, echo below */
          <>
            <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
              <div className="cs-ring absolute inset-0 rounded-full"
                style={{ border: "1px dashed rgba(245,99,22,0.38)" }} />
              <div className="cs-glow absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(245,99,22,0.13) 0%, transparent 70%)" }} />
              <svg
                className="cs-arrow1 relative z-10"
                style={{ width: 18, height: 18, color: "rgba(245,99,22,0.95)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round"
              ><path d="M19 9l-7 7-7-7" /></svg>
            </div>
            <svg
              className="cs-arrow2"
              style={{ width: 11, height: 11, color: "rgba(245,99,22,0.42)", marginTop: -3 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
            ><path d="M19 9l-7 7-7-7" /></svg>
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
    if (isLast) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      document.getElementById(SCROLL_SECTIONS[activeIdx + 1].id)
        ?.scrollIntoView({ behavior: "smooth" });
    }
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
            <svg
              className="cs-arrow2-up"
              style={{ width: 11, height: 11, color: "rgba(245,99,22,0.42)", marginBottom: -3 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
            ><path d="M5 15l7-7 7 7" /></svg>

            <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
              <div className="cs-ring absolute inset-0 rounded-full"
                style={{ border: "1px dashed rgba(245,99,22,0.38)" }} />
              <div className="cs-glow absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(245,99,22,0.13) 0%, transparent 70%)" }} />
              <svg
                className="cs-arrow1-up relative z-10"
                style={{ width: 18, height: 18, color: "rgba(245,99,22,0.95)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round"
              ><path d="M5 15l7-7 7 7" /></svg>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
              <div className="cs-ring absolute inset-0 rounded-full"
                style={{ border: "1px dashed rgba(245,99,22,0.38)" }} />
              <div className="cs-glow absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(245,99,22,0.13) 0%, transparent 70%)" }} />
              <svg
                className="cs-arrow1 relative z-10"
                style={{ width: 18, height: 18, color: "rgba(245,99,22,0.95)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round"
              ><path d="M19 9l-7 7-7-7" /></svg>
            </div>
            <svg
              className="cs-arrow2"
              style={{ width: 11, height: 11, color: "rgba(245,99,22,0.42)", marginTop: -3 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
            ><path d="M19 9l-7 7-7-7" /></svg>
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

  const bg = "#0D1117";
  const panel = "#111827";

  return (
    <div className="min-h-screen text-white antialiased" style={{ background: bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes csOrbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes csArrow1 {
          0%, 100% { transform: translateY(0);    opacity: 0.9;  }
          50%       { transform: translateY(6px);  opacity: 0.3;  }
        }
        @keyframes csArrow2 {
          0%, 100% { transform: translateY(0);    opacity: 0.42; }
          50%       { transform: translateY(6px);  opacity: 0.08; }
        }
        @keyframes csArrow1Up {
          0%, 100% { transform: translateY(0);    opacity: 0.9;  }
          50%       { transform: translateY(-6px); opacity: 0.3;  }
        }
        @keyframes csArrow2Up {
          0%, 100% { transform: translateY(0);    opacity: 0.42; }
          50%       { transform: translateY(-6px); opacity: 0.08; }
        }
        @keyframes csGlowPulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1;   }
        }
        @keyframes csDotPing {
          0%        { transform: translate(-50%,-50%) scale(1);   opacity: 0.8; }
          70%, 100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0;   }
        }
        .cs-ring       { animation: csOrbitSpin 7s linear infinite; }
        .cs-arrow1     { animation: csArrow1   2s ease-in-out infinite; }
        .cs-arrow2     { animation: csArrow2   2s ease-in-out infinite 0.28s; }
        .cs-arrow1-up  { animation: csArrow1Up 2s ease-in-out infinite; }
        .cs-arrow2-up  { animation: csArrow2Up 2s ease-in-out infinite 0.28s; }
        .cs-glow       { animation: csGlowPulse 2s ease-in-out infinite; }
        .cs-dot-ping   { animation: csDotPing  2.2s ease-out infinite; }
        .cs-btn:hover .cs-ring { border-color: rgba(245,99,22,0.7); }
      `}</style>

      {/* ── Fundo com grid sutil ── */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(13,17,23,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        }}>
        <div className="relative max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0"
              style={{ boxShadow: "0 0 0 1px rgba(245,99,22,0.25), 0 4px 16px rgba(245,99,22,0.12)" }}>
              <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">Criare TI</span>
          </div>

          {/* Nav — absolutamente centrada no container, independente da largura do logo e do botão */}
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            <a href="#como-funciona" className="text-sm text-slate-400 hover:text-white transition-colors">Como funciona</a>
            <a href="#o-que-fazemos" className="text-sm text-slate-400 hover:text-white transition-colors">O que fazemos</a>
          </nav>

          <button
            onClick={() => navigate("/solicitar")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", boxShadow: "0 0 20px rgba(245,99,22,0.25)" }}
          >
            Solicitar Implantação
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="hero" className="relative overflow-hidden" style={{ background: "linear-gradient(160deg, #111827 0%, #0D1117 60%)" }}>
        {/* Radial glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none"
          style={{ background: "radial-gradient(circle at 70% 30%, rgba(245,99,22,0.1) 0%, transparent 65%)" }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(circle at 30% 80%, rgba(99,102,241,0.06) 0%, transparent 65%)" }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">

            {/* Left: text */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8"
                style={{ background: "rgba(245,99,22,0.1)", border: "1px solid rgba(245,99,22,0.25)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs font-semibold text-orange-400 tracking-wide">ERP Criare — implantação especializada para o varejo</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl font-black leading-[1.08] tracking-tight mb-5">
                Implante seu ERP
                <br />
                <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(90deg, #F56316 0%, #ff8c47 100%)" }}>
                  com segurança
                </span>
                {" "}e rapidez,
                <br />
                <span className="text-slate-300 font-extrabold">acompanhamento completo.</span>
              </h1>

              <p className="text-base text-slate-400 leading-relaxed mb-10 max-w-md">
                Em apenas <strong className="text-slate-300 font-semibold">4 etapas</strong>, nossa equipe deixa sua empresa
                pronta para operar com o ERP Criare.
              </p>

              {/* CTA */}
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <button
                  onClick={() => navigate("/solicitar")}
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-white text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", boxShadow: "0 8px 32px rgba(245,99,22,0.4)" }}
                >
                  Solicitar Implantação
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>

              {/* Trust seals */}
              <div className="flex flex-wrap items-center gap-5">
                {[
                  {
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />,
                    label: "4 etapas estruturadas",
                  },
                  {
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />,
                    label: "Suporte pós go-live",
                  },
                  {
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
                    label: "Retorno em até 2 dias úteis",
                  },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {s.icon}
                    </svg>
                    <span className="text-xs text-slate-500 font-medium">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: ecosystem visualization */}
            <div className="relative h-[320px] sm:h-[420px] lg:h-[560px]">
              <CriareEcosystem />
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-20 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${bg})` }} />
      </section>

      <SectionDivider nextId="como-funciona" />

      {/* ── Como funciona ── */}
      <section id="como-funciona" style={{ background: "linear-gradient(180deg, #0b0f1a 0%, #0d1321 55%, #0b0f1a 100%)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Como funciona</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-4">
            Quatro etapas até o sistema no ar
          </h2>
          <p className="text-slate-400 text-base max-w-lg mx-auto">
            Um processo simples e guiado — do primeiro contato ao go-live, com suporte em cada etapa.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px"
            style={{ background: "linear-gradient(90deg, rgba(245,99,22,0.4) 0%, rgba(245,99,22,0.15) 50%, rgba(245,99,22,0.4) 100%)" }} />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {[
              {
                n: "01",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                title: "Preencha o formulário",
                desc: "Informe os dados da empresa, regime tributário e configurações fiscais em um formulário guiado — leva menos de 10 minutos.",
                time: "~10 min",
              },
              {
                n: "02",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                ),
                title: "Nossa equipe analisa",
                desc: "Especialistas revisam cada informação e preparam o ambiente do sistema personalizado para o seu negócio.",
                time: "1–2 dias úteis",
              },
              {
                n: "03",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.28c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                title: "Implantação e homologação",
                desc: "Instalamos e configuramos todo o sistema, executamos testes e validações em ambiente de homologação antes do go-live.",
                time: "3–5 dias úteis",
              },
              {
                n: "04",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                ),
                title: "Sistema em produção",
                desc: "Go-live com acompanhamento total, treinamento da equipe e suporte dedicado nos primeiros dias de operação.",
                time: "Go Live! 🚀",
              },
            ].map((step, i) => (
              <div key={step.n} className="flex flex-col items-center text-center">
                {/* Step circle */}
                <div className="relative mb-6 shrink-0">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10"
                    style={{
                      background: "linear-gradient(135deg, rgba(245,99,22,0.2), rgba(245,99,22,0.08))",
                      border: "1px solid rgba(245,99,22,0.3)",
                    }}>
                    <span className="text-orange-400">{step.icon}</span>
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                    style={{ background: "#F56316" }}>
                    {step.n}
                  </span>
                </div>
                <div className="flex-1 w-full">
                  <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-5 shrink-0"
                  style={{ background: "rgba(245,99,22,0.1)", color: "#F56316" }}>
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

      <SectionDivider nextId="o-que-fazemos" />

      {/* ── O que fazemos ── */}
      <section id="o-que-fazemos" className="py-24" style={{ background: "linear-gradient(180deg, #0D1117 0%, #111827 50%, #0D1117 100%)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">O que configuramos</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-4">
              Tudo que o seu varejo precisa
            </h2>
            <p className="text-slate-400 text-base max-w-lg mx-auto">
              Do fiscal ao treinamento — configuramos, testamos e entregamos tudo funcionando.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                tag: "Fiscal",
                icon: "🧾",
                title: "NF-e e NFC-e configurados",
                desc: "CSC, token SEFAZ, séries, ambiente e certificado digital — tudo configurado pela nossa equipe técnica.",
                color: "rgba(99,102,241,0.08)",
                border: "rgba(99,102,241,0.2)",
              },
              {
                tag: "Contábil",
                icon: "📊",
                title: "Regime tributário completo",
                desc: "Simples Nacional, Lucro Presumido ou Lucro Real. Configuramos de acordo com o seu contador.",
                color: "rgba(245,99,22,0.08)",
                border: "rgba(245,99,22,0.2)",
              },
              {
                tag: "Pagamento",
                icon: "💳",
                title: "TEF e meios de pagamento",
                desc: "Integração com adquirentes, TEF, Pix e todas as formas de pagamento que o seu varejo aceita.",
                color: "rgba(16,185,129,0.08)",
                border: "rgba(16,185,129,0.2)",
              },
              {
                tag: "Certificado",
                icon: "🔐",
                title: "Certificado digital A1",
                desc: "Importamos e configuramos seu certificado .pfx diretamente no sistema, com validade garantida.",
                color: "rgba(245,158,11,0.08)",
                border: "rgba(245,158,11,0.2)",
              },
              {
                tag: "Treinamento",
                icon: "🎓",
                title: "Capacitação da equipe",
                desc: "Treinamento presencial ou remoto no frente de caixa, módulo fiscal e relatórios gerenciais.",
                color: "rgba(236,72,153,0.08)",
                border: "rgba(236,72,153,0.2)",
              },
              {
                tag: "Suporte",
                icon: "🛎",
                title: "Acompanhamento pós go-live",
                desc: "Acompanhamos a primeira semana de operação, resolvemos pendências e garantimos a estabilidade.",
                color: "rgba(6,182,212,0.08)",
                border: "rgba(6,182,212,0.2)",
              },
            ].map((f) => (
              <div
                key={f.tag}
                className="p-6 rounded-2xl group hover:scale-[1.01] transition-all duration-200 cursor-default"
                style={{ background: f.color, border: `1px solid ${f.border}` }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-2xl">{f.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{f.tag}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-2 leading-snug">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider nextId="seguranca" />

      {/* ── Confiança / Trust signals ── */}
      <section id="seguranca" style={{ background: "linear-gradient(180deg, #0b0f1a 0%, #0d1321 55%, #0b0f1a 100%)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-20">
        <div className="rounded-3xl px-5 py-8 sm:px-10 sm:py-12"
          style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">

            {/* Left */}
            <div>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-4">Seguro e confiável</p>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-4">
                Seus dados tratados com<br />total confidencialidade.
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
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

            {/* Right: trust items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: "🔒", title: "LGPD Compliant",       desc: "Dados protegidos conforme a Lei Geral de Proteção de Dados" },
                { icon: "🛡️", title: "Conexão segura",       desc: "Transmissão criptografada SSL/TLS em todo o formulário"       },
                { icon: "👥", title: "Equipe certificada",   desc: "Especialistas com experiência em ERP de varejo"               },
                { icon: "📞", title: "Suporte dedicado",     desc: "Canal direto com a equipe durante toda a implantação"          },
              ].map((t) => (
                <div key={t.title} className="p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-xl block mb-2">{t.icon}</span>
                  <p className="text-xs font-bold text-white mb-1">{t.title}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{t.desc}</p>
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
          style={{
            background: "linear-gradient(135deg, rgba(245,99,22,0.18) 0%, rgba(245,99,22,0.06) 100%)",
            border: "1px solid rgba(245,99,22,0.22)",
          }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(245,99,22,0.18) 0%, transparent 65%)" }} />

          {/* Logo no CTA */}
          <div className="relative flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 0 0 1px rgba(245,99,22,0.3), 0 16px 40px rgba(245,99,22,0.2)" }}>
              <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
              Pronto para começar?
            </h2>
            <p className="text-slate-400 text-base mb-8 max-w-md mx-auto leading-relaxed">
              Preencha o formulário em poucos minutos e nossa equipe entra em contato para iniciar a implantação do seu sistema.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate("/solicitar")}
                className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl font-bold text-white text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", boxShadow: "0 8px 40px rgba(245,99,22,0.45)" }}
              >
                Solicitar Implantação
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              <p className="text-sm text-slate-500 flex items-center gap-1.5">
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
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-lg overflow-hidden opacity-60">
            <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
          </div>
          <p className="text-sm text-slate-600">
            © {new Date().getFullYear()} Criare TI. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <FloatingScrollNav />

      {showToast && <SuccessToast onClose={() => setShowToast(false)} />}
    </div>
  );
}
