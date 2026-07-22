import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../services/api";

export default function Registro() {
  const { t } = useTranslation("registro");
  const [nome, setNome]       = useState("");
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      setError(t("form.errorRequired"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.registro({ nome: nome.trim(), email: email.trim() });
      setSuccess(true);
    } catch (err) {
      setError(err.message || t("form.errorDefault"));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "#161B2E",
    border: "1px solid #2A3356",
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#0D1117" }}>

      {/* ── Painel esquerdo (branding) ── */}
      <div className="hidden lg:flex flex-col w-[500px] shrink-0 relative overflow-hidden"
        style={{ background: "#111827" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.07]"
            style={{ background: "radial-gradient(circle, #F56316, transparent 70%)" }} />
          <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] rounded-full opacity-[0.05]"
            style={{ background: "radial-gradient(circle, #F56316, transparent 70%)" }} />
        </div>
        <div className="relative flex flex-col h-full px-12 py-12">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 -m-3 rounded-3xl opacity-20 animate-pulse"
                style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)", filter: "blur(12px)" }} />
              <div className="relative w-28 h-28 rounded-3xl overflow-hidden shadow-2xl"
                style={{ boxShadow: "0 0 0 1px rgba(245,99,22,0.25), 0 20px 60px rgba(245,99,22,0.18)" }}>
                <img src="/logo.jpg" alt={t("leftPanel.logoAlt")} className="w-full h-full object-cover" />
              </div>
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">{t("leftPanel.brand")}</h1>
            <p className="text-base text-slate-400 font-medium mb-12">{t("leftPanel.tagline")}</p>
            <p className="text-xl font-semibold text-white leading-snug mb-3 max-w-xs">
              {t("leftPanel.headline")}
            </p>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              {t("leftPanel.subtext")}
            </p>
          </div>
          <p className="text-xs text-slate-700 text-center">
            {t("leftPanel.footer", { year: new Date().getFullYear() })}
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
              <img src="/logo.jpg" alt={t("form.logoAlt")} className="w-full h-full object-cover" />
            </div>
            <p className="text-white font-bold text-lg">{t("form.brand")}</p>
          </div>

          {success ? (
            <div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: "rgba(245,99,22,0.12)", border: "1px solid rgba(245,99,22,0.2)" }}>
                <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{t("success.title")}</h1>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                {t("success.message")}
              </p>
              <Link to="/login"
                className="block text-center w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}>
                {t("success.backToLogin")}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-1">{t("form.title")}</h1>
              <p className="text-sm text-slate-500 mb-8">{t("form.subtitle")}</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                    {t("form.nameLabel")}
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => { setNome(e.target.value); setError(""); }}
                    placeholder={t("form.namePlaceholder")}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = "#F56316"}
                    onBlur={(e)  => e.target.style.borderColor = "#2A3356"}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                    {t("form.emailLabel")}
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder={t("form.emailPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = "#F56316"}
                    onBlur={(e)  => e.target.style.borderColor = "#2A3356"}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-red-400"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t("form.submitting")}
                    </span>
                  ) : t("form.submit")}
                </button>
              </form>

              <p className="text-center text-xs text-slate-600 mt-8">
                {t("form.loginPrompt")}{" "}
                <Link to="/login" className="text-orange-400 hover:text-orange-300 transition-colors font-medium">
                  {t("form.loginLink")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
