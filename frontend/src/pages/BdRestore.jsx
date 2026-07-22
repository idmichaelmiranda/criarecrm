import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { bdRestoreApi } from "../services/api";

// ── Ícones ────────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function IconDatabase({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path strokeLinecap="round" d="M3 5v5c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
      <path strokeLinecap="round" d="M3 10v5c0 1.657 4.03 3 9 3s9-1.343 9-3v-5" />
    </svg>
  );
}

function IconTable({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 6h11M10 18h11M3 6h4v12H3z" />
    </svg>
  );
}

function IconCode({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

// ── Tooltip informativo ───────────────────────────────────────────────────────

function InfoTooltip({ children }) {
  return (
    <div className="relative group/tip inline-flex shrink-0">
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-500 text-[9px] font-bold flex items-center justify-center hover:bg-indigo-200 transition-colors leading-none"
        tabIndex={-1}
      >
        i
      </button>
      <div className="pointer-events-none absolute z-20 bottom-full right-0 mb-1.5 w-64 p-3 bg-gray-900 text-white text-[11px] leading-relaxed rounded-xl opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-xl">
        {children}
        <span className="absolute top-full right-2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
      </div>
    </div>
  );
}

// ── Configuração das abas ─────────────────────────────────────────────────────

const TABS = [
  { id: "firebird", ready: true },
  { id: "excel", ready: false },
  { id: "sql", ready: false },
];

// ── Tab strip ─────────────────────────────────────────────────────────────────

function TabStrip({ activeTab, onChange }) {
  const { t } = useTranslation("bdRestore");
  const Icon = { firebird: IconDatabase, excel: IconTable, sql: IconCode };
  return (
    <div className="flex gap-2 mb-7 p-1 bg-gray-50 rounded-xl border border-gray-100">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const Ic = Icon[tab.id];
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
              active
                ? "bg-white shadow-sm border border-gray-200"
                : "hover:bg-white/70 hover:text-gray-700"
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              active ? "bg-orange-50 text-orange-500" : "bg-gray-100 text-gray-400"
            }`}>
              <Ic className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className={`text-sm font-semibold truncate ${active ? "text-gray-800" : "text-gray-500"}`}>
                  {t(`tabs.${tab.id}.label`)}
                </p>
                {!tab.ready && (
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-600">
                    {t("tabs.comingSoon")}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{t(`tabs.${tab.id}.sublabel`)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Step header ───────────────────────────────────────────────────────────────

function StepHeader({ number, title, subtitle, done, locked }) {
  const { t } = useTranslation("bdRestore");
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 transition-colors ${
        done   ? "bg-green-500 text-white" :
        locked ? "bg-gray-100 text-gray-400" :
                 "bg-orange-500 text-white"
      }`}>
        {done ? <IconCheck /> : number}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${locked ? "text-gray-400" : "text-gray-800"}`}>{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {locked && (
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-300 mt-0.5 shrink-0">
          <IconLock /> {t("step.lockedHint")}
        </span>
      )}
    </div>
  );
}

// ── Tabelas mapeadas (Firebird) ───────────────────────────────────────────────

const TABELAS = [
  { key: "empresas",            d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { key: "produto",             d: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { key: "clientes",            d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "perfilclientes",      d: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" },
  { key: "admcartao",           d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { key: "aliquotas",           d: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
  { key: "certificado_digital", d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { key: "formaspagamento",     d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
];

function TabelaCard({ tabela, contagem, locked }) {
  const { t, i18n } = useTranslation("bdRestore");
  const isObj      = contagem !== null && typeof contagem === "object";
  const totalCount = isObj ? contagem.total    : contagem;
  const distintos  = isObj ? contagem.distintos : null;
  const temDistinto = distintos !== null && distintos !== totalCount;

  const analisado = totalCount !== null && !locked;
  const temDados  = analisado && totalCount > 0;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
      locked   ? "bg-gray-50 border-gray-100 opacity-50" :
      temDados ? "bg-white border-green-100 shadow-sm"   :
                 "bg-white border-gray-100 shadow-sm"
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        locked    ? "bg-gray-100" :
        temDados  ? "bg-green-50" :
        analisado ? "bg-gray-100" :
                    "bg-orange-50"
      }`}>
        <svg style={{ width: 18, height: 18 }}
          className={
            locked    ? "text-gray-300"  :
            temDados  ? "text-green-600" :
            analisado ? "text-gray-400"  :
                        "text-orange-400"
          }
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d={tabela.d} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-semibold ${locked ? "text-gray-400" : "text-gray-800"}`}>
            {t(`tabela.items.${tabela.key}.label`)}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {analisado ? (
              <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${
                temDados
                  ? "text-green-700 bg-green-50 border-green-100"
                  : "text-gray-400 bg-gray-50 border-gray-200"
              }`}>
                {t("tabela.records", { count: totalCount ?? 0 })}
              </span>
            ) : !locked ? (
              <span className="text-xs text-gray-300">{t("tabela.waiting")}</span>
            ) : null}
            {analisado && temDistinto && (
              <InfoTooltip>
                <p className="font-semibold text-white mb-1">{t("tabela.tooltip.title")}</p>
                <p className="text-gray-300">
                  <span className="text-white font-semibold">{(totalCount ?? 0).toLocaleString(i18n.language)} {t("tabela.tooltip.rowsPrefix")}</span> {t("tabela.tooltip.rowsExplanation")}
                </p>
                <p className="text-gray-300 mt-1">
                  <span className="text-white font-semibold">{(distintos ?? 0).toLocaleString(i18n.language)} {t("tabela.tooltip.uniquePrefix")}</span> {t("tabela.tooltip.uniqueExplanation")}
                </p>
              </InfoTooltip>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{t(`tabela.items.${tabela.key}.desc`)}</p>
        {analisado && temDistinto && (
          <p className="text-[11px] text-indigo-500 font-medium mt-1">
            {t("tabela.uniqueRecords", { count: distintos ?? 0 })}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Conteúdo Firebird ─────────────────────────────────────────────────────────

function FirebirdContent({ state }) {
  const { t } = useTranslation("bdRestore");
  const {
    file, dragging, setDragging, analisando, analise, gerando, geradoOk, erroGeral,
    fileRef, handleDrop, handleFileInput, removerArquivo, analisar, gerarBase,
    step1Done, step2Done, step2Locked, step3Locked,
    orphanedPerfil, clientesLidos,
  } = state;

  return (
    <div className="space-y-5">
      {/* PASSO 1 — Upload */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <StepHeader
          number="1"
          title={t("firebird.step1.title")}
          subtitle={t("firebird.step1.subtitle")}
          done={step1Done}
        />

        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-12 px-6 cursor-pointer transition-all ${
              dragging
                ? "border-orange-400 bg-orange-50"
                : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/30"
            }`}
          >
            <IconUpload />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">
                {dragging ? t("firebird.step1.dropHere") : t("firebird.step1.dragOrClick")}
              </p>
              <p className="text-xs text-gray-400 mt-1">{t("firebird.step1.supportedFormats")}</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".fdb,.gdb,.ib"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatBytes(file.size)} · {t("firebird.step1.fileTypeLabel")}</p>
            </div>
            <button onClick={removerArquivo}
              className="shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {erroGeral && (
          <p className="mt-3 text-xs text-red-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {erroGeral}
          </p>
        )}

        {file && (
          <button
            onClick={analisar}
            disabled={analisando}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {analisando ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {t("firebird.step1.analyzing")}
              </>
            ) : analise ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t("firebird.step1.reanalyze")}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                {t("firebird.step1.analyzeButton")}
              </>
            )}
          </button>
        )}
      </div>

      {/* PASSO 2 — Dados encontrados */}
      <div
        className={`bg-white rounded-2xl border shadow-sm p-6 transition-opacity ${step2Locked ? "opacity-60" : ""}`}
        style={{ borderColor: step2Locked ? "#f3f4f6" : step2Done ? "#d1fae5" : "#f3f4f6" }}
      >
        <StepHeader
          number="2"
          title={t("firebird.step2.title")}
          subtitle={t("firebird.step2.subtitle")}
          done={step2Done}
          locked={step2Locked}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TABELAS.map((tb) => (
            <TabelaCard
              key={tb.key}
              tabela={tb}
              contagem={analise ? (analise[tb.key] ?? null) : null}
              locked={step2Locked}
            />
          ))}
        </div>

        {orphanedPerfil.length > 0 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-amber-700">
                  {t("firebird.step2.orphanedTitle", { count: orphanedPerfil.length })}
                </p>
                <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                  {t("firebird.step2.orphanedDetailPrefix")}{" "}
                  <span className="font-mono font-semibold">[{orphanedPerfil.join(", ")}]</span>.
                  {" "}{t("firebird.step2.orphanedDetailSuffix")} <span className="font-semibold">{t("firebird.step2.orphanedNullNote")}</span> {t("firebird.step2.orphanedNullReason")}
                </p>
              </div>
            </div>
          </div>
        )}

        {clientesLidos === 0 && analise?.clientes > 0 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-semibold text-red-700">
                {t("firebird.step2.clientesFailure")}
              </p>
            </div>
          </div>
        )}

        {step2Done && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-green-700 font-medium">
              {t("firebird.step2.successMessage")}
            </p>
          </div>
        )}
      </div>

      {/* PASSO 3 — Gerar base */}
      <div
        className={`bg-white rounded-2xl border shadow-sm p-6 transition-opacity ${step3Locked ? "opacity-60" : ""}`}
        style={{ borderColor: step3Locked ? "#f3f4f6" : geradoOk ? "#d1fae5" : "#f3f4f6" }}
      >
        <StepHeader
          number="3"
          title={t("firebird.step3.title")}
          subtitle={t("firebird.step3.subtitle")}
          done={geradoOk}
          locked={step3Locked}
        />

        {!step3Locked && !geradoOk && (
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={gerando}
              onClick={() => gerarBase(1)}
              className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-11 h-11 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">{t("firebird.step3.production")}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t("firebird.step3.productionDesc")}</p>
              </div>
            </button>

            <button
              disabled={gerando}
              onClick={() => gerarBase(2)}
              className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-11 h-11 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">{t("firebird.step3.homolog")}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t("firebird.step3.homologDesc")}</p>
              </div>
            </button>
          </div>
        )}

        {erroGeral && !gerando && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mt-2">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-red-700">{erroGeral}</p>
          </div>
        )}

        {gerando && (
          <div className="flex items-center justify-center gap-3 py-8">
            <span className="w-5 h-5 rounded-full border-2 border-orange-300 border-t-orange-500 animate-spin" />
            <p className="text-sm text-gray-500">{t("firebird.step3.generating")}</p>
          </div>
        )}

        {geradoOk && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">{t("firebird.step3.successTitle")}</p>
              <p className="text-xs text-green-600 mt-0.5">{t("firebird.step3.successSubtitle")}</p>
            </div>
            <button onClick={() => state.setGeradoOk(false)}
              className="ml-auto text-xs text-green-600 hover:text-green-800 underline shrink-0">
              {t("firebird.step3.generateAgain")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Conteúdo Em breve ─────────────────────────────────────────────────────────

function ComingSoonContent({ tab }) {
  const { t } = useTranslation("bdRestore");
  const steps = t(`tabs.${tab.id}.steps`, { returnObjects: true });
  const descs = t(`comingSoon.stepDescs.${tab.id}`, { returnObjects: true, defaultValue: steps.map(() => "") });
  const desc = t(`tabs.${tab.id}.desc`, { defaultValue: "" });

  return (
    <div className="space-y-5">
      {/* Preview dos passos (desabilitados) */}
      {steps.map((stepLabel, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 opacity-70">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 bg-gray-100 text-gray-400">
              {i + 1}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">{stepLabel}</p>
              <p className="text-xs text-gray-400 mt-0.5">{descs[i]}</p>
            </div>
          </div>
          <div className="h-14 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
            <p className="text-[11px] text-gray-300 font-medium tracking-wide uppercase">{t("comingSoon.inDevelopment")}</p>
          </div>
        </div>
      ))}

      {/* Banner informativo */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
            {tab.id === "excel" ? <IconTable className="w-4 h-4 text-indigo-500" /> : <IconCode className="w-4 h-4 text-indigo-500" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-800 mb-1">
              {t(`comingSoon.bannerTitle.${tab.id}`)}
            </p>
            <p className="text-xs text-indigo-600 leading-relaxed">{desc}</p>
            <p className="text-xs text-indigo-400 mt-2 font-medium">
              {t("comingSoon.bannerFooter")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar por aba ───────────────────────────────────────────────────────────

function Sidebar({ activeTab }) {
  const { t } = useTranslation("bdRestore");
  const tabId = ["firebird", "excel", "sql"].includes(activeTab) ? activeTab : "firebird";
  const title    = t(`sidebar.${tabId}.title`);
  const items    = t(`sidebar.${tabId}.items`, { returnObjects: true });
  const howTitle = t(`sidebar.${tabId}.howTitle`);
  const how      = t(`sidebar.${tabId}.how`, { returnObjects: true });

  return (
    <div className="space-y-5">
      {/* O que é migrado / variante */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{title}</p>
        <div className="space-y-3">
          {items.map(([titulo, desc]) => (
            <div key={titulo} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-700">{titulo}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Como funciona / variante */}
      <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">{howTitle}</p>
        <div className="space-y-3">
          {how.map(([n, txt]) => (
            <div key={n} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {n}
              </span>
              <p className="text-xs text-indigo-700">{txt}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Aviso técnico */}
      <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-1">{t("sidebar.warningTitle")}</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              {t("sidebar.warningText")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BdRestore() {
  const { t } = useTranslation("bdRestore");
  const [activeTab, setActiveTab] = useState("firebird");

  // ── Estado do Firebird (preservado integralmente) ──────────────────────────
  const [file, setFile]                   = useState(null);
  const [dragging, setDragging]           = useState(false);
  const [analisando, setAnalisando]       = useState(false);
  const [analise, setAnalise]             = useState(null);
  const [sessionId, setSessionId]         = useState(null);
  const [gerando, setGerando]             = useState(false);
  const [geradoOk, setGeradoOk]           = useState(false);
  const [erroGeral, setErroGeral]         = useState(null);
  const [orphanedPerfil, setOrphanedPerfil] = useState([]);
  const [clientesLidos, setClientesLidos]   = useState(null);
  const fileRef = useRef(null);
  const analysisGenRef = useRef(0);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  function handleFileInput(e) {
    const f = e.target.files[0];
    if (f) pickFile(f);
  }

  function pickFile(f) {
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["fdb", "gdb", "ib"].includes(ext)) {
      setErroGeral(t("firebird.errors.invalidFormat"));
      return;
    }
    setErroGeral(null);
    setAnalise(null);
    setGeradoOk(false);
    setFile(f);
  }

  function removerArquivo() {
    analysisGenRef.current += 1;  // invalida qualquer análise em andamento
    setAnalisando(false);
    setFile(null);
    setAnalise(null);
    setSessionId(null);
    setGeradoOk(false);
    setErroGeral(null);
    setOrphanedPerfil([]);
    setClientesLidos(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analisar() {
    if (!file) return;
    const myGen = ++analysisGenRef.current;
    setAnalisando(true);
    setAnalise(null);
    setOrphanedPerfil([]);
    setClientesLidos(null);
    setGeradoOk(false);
    setErroGeral(null);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const { data } = await bdRestoreApi.analisar(form);
      if (analysisGenRef.current !== myGen) return;  // X foi clicado — descarta
      const { session_id, clientes_orphaned_perfil, clientes_lidos, ...contagens } = data;
      setSessionId(session_id || null);
      setOrphanedPerfil(clientes_orphaned_perfil || []);
      setClientesLidos(clientes_lidos ?? null);
      setAnalise(contagens);
    } catch (err) {
      if (analysisGenRef.current !== myGen) return;  // X foi clicado — descarta
      setErroGeral(err.message || t("firebird.errors.analyzeFailed"));
    } finally {
      if (analysisGenRef.current === myGen) setAnalisando(false);
    }
  }

  async function gerarBase(ambiente) {
    console.log("[BD-RESTORE] gerarBase chamado — sessionId:", sessionId, "ambiente:", ambiente);
    if (!sessionId) {
      setErroGeral(t("firebird.errors.sessionExpired"));
      return;
    }
    setGerando(true);
    setErroGeral(null);
    try {
      const { data, headers } = await bdRestoreApi.gerar(sessionId, ambiente);
      // Extrai nome do arquivo do header Content-Disposition
      const disposition = headers["content-disposition"] || "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match ? match[1] : `restore_${ambiente === 1 ? "prod" : "homolog"}.sql`;
      // Dispara download no navegador
      const url = window.URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setGeradoOk(true);
    } catch (err) {
      // Com responseType:"blob", erros do servidor chegam como Blob — ler como texto
      let msg = err.message || t("firebird.errors.generateFailed");
      try {
        if (err.response?.data instanceof Blob) {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.detail || text || msg;
        }
      } catch (_) {}
      setErroGeral(msg);
    } finally {
      setGerando(false);
    }
  }

  const step1Done = !!file;
  // Verifica só as chaves de tabela — session_id já foi separado em analisar()
  const _TABELA_KEYS = ["empresas", "produto", "clientes", "perfilclientes", "admcartao", "aliquotas", "certificado_digital", "formaspagamento"];
  const step2Done = analise !== null && _TABELA_KEYS.some((k) => {
    const v = analise[k];
    if (v === null || v === undefined) return false;
    if (typeof v === "object") return (v.total ?? 0) > 0;
    return v > 0;
  });
  const step2Locked = !step1Done;
  const step3Locked = !step2Done;

  // ── Derivados para o flow header ───────────────────────────────────────────
  const currentTab  = TABS.find((tb) => tb.id === activeTab);
  const currentSteps = t(`tabs.${currentTab.id}.steps`, { returnObjects: true });
  const flowDone    = activeTab === "firebird"
    ? [step1Done, step2Done, geradoOk]
    : [false, false, false];

  const firebirdState = {
    file, dragging, setDragging, analisando, analise, gerando, geradoOk, setGeradoOk,
    erroGeral, fileRef, handleDrop, handleFileInput, removerArquivo, analisar, gerarBase,
    step1Done, step2Done, step2Locked, step3Locked,
    orphanedPerfil, clientesLidos,
  };

  return (
    <Layout>
      {/* ── Cabeçalho da página ─────────────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <IconDatabase />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t("page.title")}</h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">
          {t("page.subtitle")}
        </p>

        {/* Flow pills adaptativo à aba ativa */}
        <div className="flex items-center gap-2 mt-4 ml-12 flex-wrap">
          {currentSteps.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                flowDone[i]
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${flowDone[i] ? "bg-green-500" : "bg-gray-300"}`} />
                {s}
              </span>
              {i < currentSteps.length - 1 && <span className="text-gray-300 text-xs">→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ── Tab strip ──────────────────────────────────────────────────────── */}
      <TabStrip activeTab={activeTab} onChange={setActiveTab} />

      {/* ── Grid: conteúdo + sidebar ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {activeTab === "firebird" && <FirebirdContent state={firebirdState} />}
          {activeTab !== "firebird" && <ComingSoonContent tab={currentTab} />}
        </div>
        <Sidebar activeTab={activeTab} />
      </div>
    </Layout>
  );
}
