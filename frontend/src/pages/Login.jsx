import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();
  const from      = location.state?.from?.pathname || "/admin";

  const [email, setEmail]       = useState("");
  const [senha, setSenha]       = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !senha) { setError("Preencha e-mail e senha."); return; }
    setLoading(true);
    setError("");
    try {
      await login(email, senha);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#F8F9FC" }}>

      {/* ── Painel esquerdo (branding) ── */}
      <div
        className="hidden lg:flex flex-col w-[460px] shrink-0 relative overflow-hidden"
        style={{
          background: "linear-gradient(155deg, #fff7ed 0%, #ffffff 55%)",
          borderRight: "1px solid #f1f5f9",
        }}
      >
        {/* Fundo decorativo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.12]"
            style={{ background: "radial-gradient(circle, #F56316, transparent 70%)" }} />
          <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] rounded-full opacity-[0.07]"
            style={{ background: "radial-gradient(circle, #F56316, transparent 70%)" }} />
          {/* Grade sutil */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: "linear-gradient(#1a1a2e 1px, transparent 1px), linear-gradient(90deg, #1a1a2e 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }} />
        </div>

        {/* Conteúdo do painel */}
        <div className="relative flex flex-col h-full px-12 py-12">

          {/* Logo + branding */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Logo sem container clip — transparência da PNG respira */}
            <div className="relative mb-6">
              <div className="absolute inset-0 -m-4 rounded-3xl opacity-10 animate-pulse"
                style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", filter: "blur(16px)" }} />
              <img
                src="/logo3dhero.png"
                alt="CriareTI"
                style={{
                  width: 112,
                  height: "auto",
                  filter: "drop-shadow(0 8px 24px rgba(245,99,22,0.22)) drop-shadow(0 2px 8px rgba(30,45,78,0.12))",
                }}
              />
            </div>

            {/* Nome da empresa */}
            <h1 className="text-4xl font-extrabold tracking-tight mb-1.5" style={{ color: "#111827" }}>CriareTI</h1>
            <p className="text-base font-medium mb-12" style={{ color: "#9CA3AF" }}>Plataforma de Implantação</p>

            {/* Headline */}
            <p className="text-xl font-semibold leading-snug mb-3 max-w-xs" style={{ color: "#1F2937" }}>
              Gerencie implantações com eficiência e controle.
            </p>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "#9CA3AF" }}>
              Triagem, gestão de clientes, controle de etapas e muito mais — tudo em um único painel operacional.
            </p>

            {/* Divisor */}
            <div className="w-12 h-px my-10" style={{ background: "rgba(245,99,22,0.3)" }} />

            {/* Features */}
            <div className="space-y-4 w-full max-w-xs text-left">
              {[
                ["Triagem inteligente",  "Receba e processe solicitações em tempo real"],
                ["RBAC completo",        "Controle de acesso por perfis e permissões"],
                ["Rastreamento de SLA",  "Monitore prazos e riscos automaticamente"],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "rgba(245,99,22,0.10)", border: "1px solid rgba(245,99,22,0.22)" }}>
                    <svg className="w-3 h-3" style={{ color: "#F56316" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#374151" }}>{title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé */}
          <p className="text-xs text-center" style={{ color: "#D1D5DB" }}>
            © {new Date().getFullYear()} CriareTI. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* ── Painel direito (formulário) ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ background: "#ffffff" }}>
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <img
              src="/logo3dhero.png"
              alt="CriareTI"
              style={{
                width: 40,
                height: "auto",
                filter: "drop-shadow(0 2px 6px rgba(30,45,78,0.15))",
              }}
            />
            <p className="font-bold text-lg" style={{ color: "#111827" }}>CriareTI</p>
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: "#111827" }}>Entrar na plataforma</h1>
          <p className="text-sm mb-8" style={{ color: "#6B7280" }}>Acesse com suas credenciais corporativas</p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#6B7280" }}>
                E-mail
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "#F8F9FC",
                  border: `1px solid ${error ? "#ef4444" : "#E5E7EB"}`,
                  color: "#111827",
                }}
                onFocus={(e) => e.target.style.borderColor = error ? "#ef4444" : "#F56316"}
                onBlur={(e)  => e.target.style.borderColor = error ? "#ef4444" : "#E5E7EB"}
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#6B7280" }}>
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "#F8F9FC",
                    border: `1px solid ${error ? "#ef4444" : "#E5E7EB"}`,
                    color: "#111827",
                  }}
                  onFocus={(e) => e.target.style.borderColor = error ? "#ef4444" : "#F56316"}
                  onBlur={(e)  => e.target.style.borderColor = error ? "#ef4444" : "#E5E7EB"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#9CA3AF" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#6B7280"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#9CA3AF"}
                >
                  {showPass ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#DC2626" }}>
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="flex-1 leading-snug">{error}</span>
                <button type="button" onClick={() => setError("")}
                  className="shrink-0 transition-opacity opacity-50 hover:opacity-100 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", boxShadow: "0 4px 16px rgba(245,99,22,0.25)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Entrando...
                </span>
              ) : "Entrar"}
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-2">
            <Link to="/registro"
              className="text-sm font-medium transition-colors"
              style={{ color: "#F56316" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#d94f0d"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#F56316"}
            >
              Primeiro acesso? Solicite seu cadastro
            </Link>
            <p className="text-xs" style={{ color: "#D1D5DB" }}>
              Problemas para acessar? Contate o administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
