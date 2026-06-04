import { useEffect, useRef, useState } from "react";

const ORANGE = [245, 99, 22];
const oa = (a) => `rgba(${ORANGE[0]},${ORANGE[1]},${ORANGE[2]},${a})`;
const oc  = `rgb(${ORANGE[0]},${ORANGE[1]},${ORANGE[2]})`;

const SERVICES = [
  {
    label: "SIA PDV",
    sub: "Frente de caixa",
    d: "M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6",
  },
  {
    label: "SIA Administrativo",
    sub: "Gestão corporativa",
    d: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7",
  },
  {
    label: "Força de Vendas",
    sub: "Mobilidade comercial",
    d: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    label: "Conciliador Bancário",
    sub: "Reconciliação financeira",
    d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  },
  {
    label: "Classificador Tributário",
    sub: "Inteligência fiscal",
    d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    label: "TEF",
    sub: "Transferência eletrônica",
    d: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
  },
  {
    label: "Coletor Mobile",
    sub: "Inventário e coleta",
    d: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
];

// Valores base para o container de referência (560px altura)
const ORBIT_R_BASE = 200;
const CARD_W_BASE  = 148;
const LOGO_SZ_BASE = 96;

function initParticles(w, h) {
  return Array.from({ length: 55 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    alpha: 0,
    target: Math.random() * 0.28,
    speed: 0.004 + Math.random() * 0.008,
    size: 0.6 + Math.random() * 1.4,
  }));
}

function initPulses() {
  return SERVICES.map((_, idx) =>
    [0, 0.42, 0.78].map((offset, j) => ({
      t: -(idx * 0.13) - offset,
      speed: 0.0024 + Math.random() * 0.0018,
      alpha: [0.95, 0.62, 0.38][j],
      size: [3.2, 2.2, 1.4][j],
    }))
  );
}

export default function CriareEcosystem() {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);
  const s            = useRef({
    w: 0, h: 0, cx: 0, cy: 0,
    nodes: [],
    particles: [],
    pulses: [],
    angle: 0,
    ready: false,
  });

  const [positions, setPositions] = useState([]);
  const [hovered,   setHovered]   = useState(null);
  const [sizes, setSizes] = useState({ orbitR: ORBIT_R_BASE, cardW: CARD_W_BASE, logoSz: LOGO_SZ_BASE });

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;

    function computeNodes(w, h, orbitR) {
      const cx = w / 2;
      const cy = h / 2;
      return SERVICES.map((_, i) => {
        const a = (2 * Math.PI * i) / SERVICES.length - Math.PI / 2;
        return { x: cx + orbitR * Math.cos(a), y: cy + orbitR * Math.sin(a) };
      });
    }

    function setup() {
      const prevW = s.current.w;
      const prevH = s.current.h;
      const w = container.clientWidth;
      const h = container.clientHeight;

      // Escala dinâmica: reduz órbita e cards em telas menores
      const scale  = Math.max(0.52, Math.min(1, Math.min(w, h) / 560));
      const orbitR = Math.round(ORBIT_R_BASE * scale);
      const cardW  = Math.round(CARD_W_BASE  * scale);
      const logoSz = Math.round(LOGO_SZ_BASE * scale);
      s.current.orbitR = orbitR;
      setSizes({ orbitR, cardW, logoSz });

      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      s.current.w  = w;
      s.current.h  = h;
      s.current.cx = w / 2;
      s.current.cy = h / 2;
      s.current.nodes = computeNodes(w, h, orbitR);

      if (!s.current.ready) {
        s.current.particles = initParticles(w, h);
        s.current.pulses    = initPulses();
        s.current.ready     = true;
      } else {
        s.current.particles.forEach(p => {
          if (prevW) p.x = (p.x / prevW) * w;
          if (prevH) p.y = (p.y / prevH) * h;
        });
      }

      setPositions(s.current.nodes.map(n => ({ ...n })));
    }

    function tick() {
      const { w, h, cx, cy, nodes, particles, pulses } = s.current;
      if (!w || !h || !nodes.length) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);

      s.current.angle += 0.004;
      const ang = s.current.angle;
      const R   = s.current.orbitR || ORBIT_R_BASE;

      // ── Orbit rings ──────────────────────────────────────────────────────────

      // Outer ghost ring — slow CCW
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-ang * 0.22);
      ctx.setLineDash([2, 26]);
      ctx.strokeStyle = oa(0.055);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Main orbit ring CW + travelling dot
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.setLineDash([3, 14]);
      ctx.strokeStyle = oa(0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowColor = oc;
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = oa(0.9);
      ctx.beginPath();
      ctx.arc(R, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Inner ring CCW — fast
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-ang * 1.7);
      ctx.setLineDash([5, 12]);
      ctx.strokeStyle = oa(0.15);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── Fiber-optic lines + neural pulses ────────────────────────────────

      nodes.forEach((node, i) => {
        const g = ctx.createLinearGradient(cx, cy, node.x, node.y);
        g.addColorStop(0,    oa(0.5));
        g.addColorStop(0.52, oa(0.14));
        g.addColorStop(1,    oa(0.05));

        ctx.save();
        ctx.strokeStyle = g;
        ctx.lineWidth   = 1;
        ctx.shadowColor = oa(0.45);
        ctx.shadowBlur  = 5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
        ctx.restore();

        pulses[i].forEach(p => {
          p.t += p.speed;
          if (p.t > 1.28) p.t -= 1.55 + Math.random() * 0.25;

          const t = p.t;
          if (t <= 0 || t >= 1) return;

          const px   = cx + (node.x - cx) * t;
          const py   = cy + (node.y - cy) * t;
          const fade = Math.sin(t * Math.PI);

          ctx.save();
          ctx.globalAlpha = p.alpha * fade;
          ctx.shadowColor = oc;
          ctx.shadowBlur  = 20;
          ctx.fillStyle   = oc;
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();

          const t2 = Math.max(0, t - 0.052);
          const tx  = cx + (node.x - cx) * t2;
          const ty  = cy + (node.y - cy) * t2;
          ctx.globalAlpha = p.alpha * fade * 0.26;
          ctx.shadowBlur  = 5;
          ctx.beginPath();
          ctx.arc(tx, ty, p.size * 0.48, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      });

      // ── Ambient micro-particles ───────────────────────────────────────────

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x += w;
        if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h;
        if (p.y > h) p.y -= h;

        const diff = p.target - p.alpha;
        if (Math.abs(diff) < 0.009) p.target = Math.random() * 0.28;
        p.alpha += diff * 0.045;
        if (p.alpha < 0) p.alpha = 0;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = oc;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    setup();
    rafRef.current = requestAnimationFrame(tick);

    const ro = new ResizeObserver(setup);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ zIndex: 0 }}
      />

      {/* ── Central logo mark ──────────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 20,
        }}
      >
        {/* Ambient pulse glow */}
        <div
          className="absolute pointer-events-none animate-pulse"
          style={{
            width: 220,
            height: 220,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,99,22,0.38) 0%, transparent 68%)",
            filter: "blur(26px)",
          }}
        />
        {/* Logo container with neon ring */}
        <div
          style={{
            position: "relative",
            width: sizes.logoSz,
            height: sizes.logoSz,
            borderRadius: 26,
            overflow: "hidden",
            border: "1.5px solid rgba(245,99,22,0.6)",
            boxShadow: [
              "0 0 0 12px rgba(245,99,22,0.06)",
              "0 0 44px rgba(245,99,22,0.58)",
              "0 0 80px rgba(245,99,22,0.28)",
              "inset 0 1px 0 rgba(255,255,255,0.14)",
            ].join(", "),
          }}
        >
          <img
            src="/logo.jpg"
            alt="Criare"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      </div>

      {/* ── Service cards (360° trigonometric distribution) ───────────────── */}
      {positions.map((pos, i) => {
        const isHov = hovered === i;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              top: pos.y,
              left: pos.x,
              width: sizes.cardW,
              transform: "translate(-50%, -50%)",
              zIndex: 10,
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              style={{
                padding: "11px 13px",
                borderRadius: 12,
                background: "rgba(10, 14, 24, 0.9)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: `1px solid ${
                  isHov ? "rgba(245,99,22,0.62)" : "rgba(245,99,22,0.16)"
                }`,
                boxShadow: isHov
                  ? "0 0 28px rgba(245,99,22,0.24), 0 8px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.09)"
                  : "0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
                transition: "border-color 0.22s ease, box-shadow 0.22s ease",
                cursor: "default",
              }}
            >
              {/* Icon + label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: isHov ? "rgba(245,99,22,0.22)" : "rgba(245,99,22,0.11)",
                    border: "1px solid rgba(245,99,22,0.24)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#F56316",
                    flexShrink: 0,
                    transition: "background 0.22s ease",
                  }}
                >
                  <svg
                    style={{ width: 16, height: 16 }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={SERVICES[i].d} />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.92)",
                    lineHeight: 1.25,
                    letterSpacing: "0.01em",
                  }}
                >
                  {SERVICES[i].label}
                </span>
              </div>

              {/* Sub-label */}
              <p
                style={{
                  fontSize: 10.5,
                  color: "rgba(148,163,184,0.62)",
                  margin: 0,
                  lineHeight: 1.35,
                  paddingLeft: 40,
                }}
              >
                {SERVICES[i].sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
