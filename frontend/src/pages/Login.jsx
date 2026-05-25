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
      setError(err.message || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#0D1117" }}>

      {/* ── Painel esquerdo (branding) ── */}
      <div
        className="hidden lg:flex flex-col w-[500px] shrink-0 relative overflow-hidden"
        style={{ background: "#111827" }}
      >
        {/* Fundo decorativo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.07]"
            style={{ background: "radial-gradient(circle, #F56316, transparent 70%)" }} />
          <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] rounded-full opacity-[0.05]"
            style={{ background: "radial-gradient(circle, #F56316, transparent 70%)" }} />
          {/* Grade sutil */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }} />
        </div>

        {/* Conteúdo do painel */}
        <div className="relative flex flex-col h-full px-12 py-12">

          {/* Logo centralizada — elemento hero */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Anel + logo */}
            <div className="relative mb-8">
              {/* Anel externo pulsante */}
              <div className="absolute inset-0 -m-3 rounded-3xl opacity-20 animate-pulse"
                style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", filter: "blur(12px)" }} />
              {/* Container da logo */}
              <div className="relative w-28 h-28 rounded-3xl overflow-hidden shadow-2xl"
                style={{ boxShadow: "0 0 0 1px rgba(245,99,22,0.25), 0 20px 60px rgba(245,99,22,0.18)" }}>
                <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Nome da empresa */}
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">CriareTI</h1>
            <p className="text-base text-slate-400 font-medium mb-12">Plataforma de Implantação</p>

            {/* Headline */}
            <p className="text-xl font-semibold text-white leading-snug mb-3 max-w-xs">
              Gerencie implantações com eficiência e controle.
            </p>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              Triagem, gestão de clientes, controle de etapas e muito mais — tudo em um único painel operacional.
            </p>

            {/* Divisor */}
            <div className="w-12 h-px my-10" style={{ background: "rgba(245,99,22,0.35)" }} />

            {/* Features */}
            <div className="space-y-4 w-full max-w-xs text-left">
              {[
                ["Triagem inteligente",  "Receba e processe solicitações em tempo real"],
                ["RBAC completo",        "Controle de acesso por perfis e permissões"],
                ["Rastreamento de SLA",  "Monitore prazos e riscos automaticamente"],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "rgba(245,99,22,0.12)", border: "1px solid rgba(245,99,22,0.2)" }}>
                    <svg className="w-3 h-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé */}
          <p className="text-xs text-slate-700 text-center">
            © {new Date().getFullYear()} CriareTI. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* ── Painel direito (formulário) ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shrink-0"
              style={{ boxShadow: "0 0 0 1px rgba(245,99,22,0.2)" }}>
              <img src="/logo.jpg" alt="CriareTI" className="w-full h-full object-cover" />
            </div>
            <p className="text-white font-bold text-lg">CriareTI</p>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Entrar na plataforma</h1>
          <p className="text-sm text-slate-500 mb-8">Acesse com suas credenciais corporativas</p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                E-mail
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                style={{ background: "#161B2E", border: "1px solid #2A3356" }}
                onFocus={(e) => e.target.style.borderColor = "#F56316"}
                onBlur={(e)  => e.target.style.borderColor = "#2A3356"}
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                  style={{ background: "#161B2E", border: "1px solid #2A3356" }}
                  onFocus={(e) => e.target.style.borderColor = "#F56316"}
                  onBlur={(e)  => e.target.style.borderColor = "#2A3356"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-red-400"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}
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
              className="text-sm text-orange-400 hover:text-orange-300 transition-colors font-medium">
              Primeiro acesso? Solicite seu cadastro
            </Link>
            <p className="text-xs text-slate-700">
              Problemas para acessar? Contate o administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
