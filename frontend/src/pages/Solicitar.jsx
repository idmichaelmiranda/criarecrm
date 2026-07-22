import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { solicitacoesApi } from "../services/api";
import { useCep } from "../hooks/useCep";
import { useCnpj, validateCnpj, maskCnpj } from "../hooks/useCnpj";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Checkbox } from "../components/ui/Checkbox";
import { BANCOS_BR } from "../data/bancos";

// ─── Config ───────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 9;

const STEP_REQUIRED = [
  ["cnpj", "razao_social"],
  ["email", "telefone_celular"],
  ["cep", "endereco", "numero", "bairro", "cidade", "estado"],
  ["nome_contador", "cpf_contador"],
  [],
  [],
  [],
  [],
  [],
];

// ─── CNPJ field ───────────────────────────────────────────────────────────────

function CnpjInput({ register, errors, setValue }) {
  const { t } = useTranslation("solicitar");
  const { fetchCnpj, status } = useCnpj();
  const { ref, onChange: regOnChange, ...rest } = register("cnpj", {
    required: t("cnpj.required"),
    validate: (v) => validateCnpj(v) || t("cnpj.invalid"),
  });

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          ref={ref}
          label={t("cnpj.label")}
          placeholder={t("cnpj.placeholder")}
          maxLength={18}
          error={errors.cnpj?.message}
          onChange={(e) => {
            e.target.value = maskCnpj(e.target.value);
            regOnChange(e);
            fetchCnpj(e.target.value, setValue);
          }}
          {...rest}
        />
        {status === "loading" && (
          <span className="absolute right-3 top-8 flex items-center gap-1.5 text-[11px] text-orange-500">
            <span className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            {t("cnpj.consulting")}
          </span>
        )}
      </div>

      {status === "found" && (
        <div className="flex items-center gap-1.5 text-[11px] text-green-600">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {t("cnpj.foundMessage")}
        </div>
      )}
      {status === "not_found" && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t("cnpj.notFoundMessage")}
        </div>
      )}
    </div>
  );
}

// ─── Phone field ─────────────────────────────────────────────────────────────

function maskPhone(raw) {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : "";
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function PhoneInput({ name, label, required, register, errors }) {
  const { t } = useTranslation("solicitar");
  const rules = required ? { required: t("phone.requiredTemplate", { label: label.replace(" *", "") }) } : {};
  const { ref, onChange: regOnChange, ...rest } = register(name, rules);
  return (
    <Input
      ref={ref}
      label={label}
      placeholder={t("phone.placeholder")}
      maxLength={15}
      error={errors[name]?.message}
      onChange={(e) => { e.target.value = maskPhone(e.target.value); regOnChange(e); }}
      {...rest}
    />
  );
}

// ─── CEP field ────────────────────────────────────────────────────────────────

function CepInput({ name, label, register, errors, setValue, fieldMap, required }) {
  const { t } = useTranslation("solicitar");
  const { fetchCep, loading } = useCep();
  const { ref, onChange: regOnChange, ...rest } = register(name, {
    ...(required ? { required: t("cep.required") } : {}),
  });
  return (
    <div className="relative">
      <Input
        ref={ref}
        label={label}
        placeholder={t("cep.placeholder")}
        maxLength={9}
        error={errors[name]?.message}
        onChange={(e) => { regOnChange(e); fetchCep(e.target.value, setValue, fieldMap); }}
        {...rest}
      />
      {loading && (
        <span className="absolute right-3 top-8 text-[11px] text-orange-500 animate-pulse">
          {t("cep.searching")}
        </span>
      )}
    </div>
  );
}

// ─── Info Banner ──────────────────────────────────────────────────────────────

function InfoBanner({ icon, children, variant = "info" }) {
  const styles = {
    info: {
      wrap: "bg-blue-50 border-blue-200 text-blue-800",
      icon: "text-blue-500",
    },
    warning: {
      wrap: "bg-amber-50 border-amber-200 text-amber-800",
      icon: "text-amber-500",
    },
  };
  const s = styles[variant];
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 mb-1 ${s.wrap}`}>
      <span className={`mt-0.5 shrink-0 ${s.icon}`}>{icon}</span>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

// ─── Bank Selector ────────────────────────────────────────────────────────────

function BankSelector({ setValue, watch }) {
  const { t, i18n } = useTranslation("solicitar");
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  const nome   = watch("nome_banco")   || "";
  const codigo = watch("codigo_banco") || "";
  const cnpj   = watch("cnpj_banco")   || "";

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = BANCOS_BR
    .filter((b) => {
      const q = query.toLowerCase();
      return b.nome.toLowerCase().includes(q) || b.codigo.includes(q);
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, i18n.language));

  function select(banco) {
    setValue("nome_banco",   banco.nome);
    setValue("cnpj_banco",   banco.cnpj);
    setValue("codigo_banco", banco.codigo);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    setValue("nome_banco",   "");
    setValue("cnpj_banco",   "");
    setValue("codigo_banco", "");
    setQuery("");
    setOpen(true);
  }

  if (nome && !open) {
    return (
      <div className="col-span-2 flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
        <span className="w-12 h-10 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-bold font-mono shrink-0 shadow-sm">
          {codigo || "—"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{nome}</p>
          {cnpj && <p className="text-xs text-gray-500 mt-0.5 font-mono">{cnpj}</p>}
        </div>
        <button type="button" onClick={clear}
          className="text-xs text-gray-600 hover:text-gray-800 px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors shrink-0 font-medium">
          {t("bank.change")}
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-2 relative" ref={ref}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("bank.label")}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t("bank.searchPlaceholder")}
          autoComplete="off"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 pr-9"
        />
        <svg className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((b) => (
            <button key={b.codigo} type="button" onMouseDown={() => select(b)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left border-b border-gray-50 last:border-b-0">
              <span className="w-8 text-[11px] font-bold font-mono text-blue-600 shrink-0">{b.codigo}</span>
              <span className="text-sm text-gray-700 flex-1 truncate">{b.nome}</span>
              <span className="text-[10px] font-mono text-gray-400 shrink-0">{b.cnpj}</span>
            </button>
          )) : (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">
              {t("bank.noneFound", { query })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step0({ r, e, sv }) {
  const { t } = useTranslation("solicitar");
  const RAMO_OPTIONS = [
    { value: "comercio",  label: t("options.ramo.comercio") },
    { value: "industria", label: t("options.ramo.industria") },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="col-span-2">
        <CnpjInput register={r} errors={e} setValue={sv} />
      </div>
      <Input label={t("step0.ieLabel")} placeholder={t("step0.ieOptional")} {...r("ie")} />
      <Select label={t("step0.ramoLabel")} options={RAMO_OPTIONS} {...r("ramo_atividade")} />
      <div className="col-span-2">
        <Input label={t("step0.razaoSocialLabel")} placeholder={t("step0.razaoSocialPlaceholder")}
          error={e.razao_social?.message} {...r("razao_social", { required: t("step0.razaoSocialRequired") })} />
      </div>
      <Input label={t("step0.nomeFantasiaLabel")} placeholder={t("step0.nomeFantasiaPlaceholder")} {...r("nome_fantasia")} />
      <Input label={t("step0.responsavelLabel")} placeholder={t("step0.responsavelPlaceholder")} {...r("responsavel")} />
    </div>
  );
}

function Step1({ r, e }) {
  const { t } = useTranslation("solicitar");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="col-span-2">
        <Input label={t("step1.emailLabel")} type="email" placeholder={t("step1.emailPlaceholder")}
          error={e.email?.message}
          {...r("email", {
            required: t("step1.emailRequired"),
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: t("step1.emailInvalid") },
          })} />
      </div>
      <PhoneInput name="telefone_celular" label={t("step1.celularLabel")} required register={r} errors={e} />
      <PhoneInput name="telefone_fixo"   label={t("step1.telefoneFixoLabel")}   register={r} errors={e} />
    </div>
  );
}

function Step2({ r, e, sv }) {
  const { t } = useTranslation("solicitar");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <CepInput name="cep" label={t("step2.cepLabel")} register={r} errors={e} setValue={sv} required
        fieldMap={{ logradouro: "endereco", bairro: "bairro", cidade: "cidade", estado: "estado" }} />
      <Input label={t("step2.numeroLabel")} placeholder={t("step2.numeroPlaceholder")}
        error={e.numero?.message} {...r("numero", { required: t("step2.numeroRequired") })} />
      <div className="col-span-2">
        <Input label={t("step2.enderecoLabel")} placeholder={t("step2.enderecoPlaceholder")}
          error={e.endereco?.message} {...r("endereco", { required: t("step2.enderecoRequired") })} />
      </div>
      <Input label={t("step2.bairroLabel")} placeholder={t("step2.bairroPlaceholder")}
        error={e.bairro?.message} {...r("bairro", { required: t("step2.bairroRequired") })} />
      <Input label={t("step2.cidadeLabel")} placeholder={t("step2.cidadePlaceholder")}
        error={e.cidade?.message} {...r("cidade", { required: t("step2.cidadeRequired") })} />
      <Input label={t("step2.estadoLabel")} placeholder={t("step2.estadoPlaceholder")} maxLength={2}
        error={e.estado?.message} {...r("estado", { required: t("step2.estadoRequired") })} />
    </div>
  );
}

function Step3({ r, e }) {
  const { t } = useTranslation("solicitar");
  return (
    <div className="space-y-4">
      <InfoBanner variant="info" icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }>
        {t("step3.infoBanner")}
      </InfoBanner>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="col-span-2">
        <Input label={t("step3.nomeContadorLabel")} placeholder={t("step3.nomeContadorPlaceholder")}
          error={e.nome_contador?.message}
          {...r("nome_contador", { required: t("step3.nomeContadorRequired") })} />
      </div>
      <Input label={t("step3.cpfLabel")} placeholder={t("step3.cpfPlaceholder")}
        error={e.cpf_contador?.message}
        {...r("cpf_contador", { required: t("step3.cpfRequired") })} />
      <Input label={t("step3.crcLabel")} placeholder={t("step3.crcPlaceholder")} {...r("crc")} />
      <Input label={t("step3.cnpjEscritorioLabel")} placeholder={t("step3.cnpjEscritorioPlaceholder")} {...r("cnpj_contador")} />
      <Input label={t("step3.emailContadorLabel")} type="email" placeholder={t("step3.emailContadorPlaceholder")}
        error={e.email_contador?.message}
        {...r("email_contador", {
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: t("step1.emailInvalid") },
        })} />
      <Input label={t("step3.telefoneFixoLabel")} placeholder={t("step3.telefoneFixoPlaceholder")} {...r("tel_fixo_contador")} />
      <Input label={t("step3.celularLabel")} placeholder={t("phone.placeholder")} {...r("tel_cel_contador")} />
    </div>
    </div>
  );
}

function Step4({ r, e, sv }) {
  const { t } = useTranslation("solicitar");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <CepInput name="cep_contador" label={t("step4.cepLabel")} register={r} errors={e} setValue={sv}
        fieldMap={{ logradouro: "end_contador", bairro: "bairro_contador", cidade: "cidade_contador", estado: "estado_contador" }} />
      <Input label={t("step4.numeroLabel")} placeholder={t("step4.numeroPlaceholder")} {...r("num_contador")} />
      <div className="col-span-2">
        <Input label={t("step4.enderecoLabel")} placeholder={t("step4.enderecoPlaceholder")} {...r("end_contador")} />
      </div>
      <Input label={t("step4.bairroLabel")} placeholder={t("step4.bairroPlaceholder")} {...r("bairro_contador")} />
      <Input label={t("step4.cidadeLabel")} placeholder={t("step4.cidadePlaceholder")} {...r("cidade_contador")} />
      <Input label={t("step4.estadoLabel")} placeholder={t("step4.estadoPlaceholder")} maxLength={2} {...r("estado_contador")} />
    </div>
  );
}

function Step5({ r, sv, watch }) {
  const { t } = useTranslation("solicitar");
  const CONTA_OPTIONS = [
    { value: "corrente",  label: t("options.conta.corrente") },
    { value: "poupanca",  label: t("options.conta.poupanca") },
    { value: "pagamento", label: t("options.conta.pagamento") },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <BankSelector setValue={sv} watch={watch} />
      <Select label={t("step5.tipoContaLabel")} options={CONTA_OPTIONS} {...r("tipo_conta")} />
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("step5.agenciaLabel")}</label>
        <div className="flex items-center gap-1.5">
          <input placeholder={t("step5.agenciaPlaceholder")} {...r("agencia")}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
          <span className="text-gray-400 font-bold select-none">-</span>
          <input placeholder={t("step5.dvPlaceholder")} {...r("dv_agencia")}
            className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("step5.contaLabel")}</label>
        <div className="flex items-center gap-1.5">
          <input placeholder={t("step5.contaPlaceholder")} {...r("conta")}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
          <span className="text-gray-400 font-bold select-none">-</span>
          <input placeholder={t("step5.dvPlaceholder")} {...r("dv_conta")}
            className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
        </div>
      </div>
    </div>
  );
}

function Step6({ r, watch }) {
  const { t } = useTranslation("solicitar");
  const CRT_OPTIONS = [
    { value: "1", label: t("options.crt.1") },
    { value: "2", label: t("options.crt.2") },
    { value: "3", label: t("options.crt.3") },
  ];
  const REGIME_OPTIONS = [
    { value: "1", label: t("options.regime.1") },
    { value: "2", label: t("options.regime.2") },
    { value: "3", label: t("options.regime.3") },
  ];
  const ST_OPTIONS = [
    { value: "1", label: t("options.st.1") },
    { value: "2", label: t("options.st.2") },
  ];
  const regime = watch("regime_tributario");
  const isSimples = regime === "1";
  return (
    <div className="space-y-4">
      <InfoBanner variant="warning" icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      }>
        {t("step6.infoBanner")}
      </InfoBanner>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="col-span-2">
        <Select label={t("step6.crtLabel")} options={CRT_OPTIONS} {...r("crt")} />
      </div>
      <Select label={t("step6.regimeLabel")} options={REGIME_OPTIONS} {...r("regime_tributario")} />
      <Select label={t("step6.condicaoStLabel")} options={ST_OPTIONS} {...r("condicao_st")} />
      {isSimples && (
        <>
          <Input label={t("step6.aliqSimplesLabel")} placeholder={t("step6.aliqSimplesPlaceholder")} {...r("aliq_simples")} />
          <Input label={t("step6.receitaBrutaLabel")} placeholder={t("step6.receitaBrutaPlaceholder")} {...r("receita_bruta")} />
        </>
      )}
    </div>
    </div>
  );
}

function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex shrink-0">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition-colors select-none"
      >
        i
      </button>
      {open && (
        <div className="absolute z-20 left-6 top-0 w-56 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2.5 shadow-2xl leading-relaxed pointer-events-none">
          {text}
          <div className="absolute -left-1 top-2 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

function Step7({ r, watch }) {
  const { t } = useTranslation("solicitar");
  const PAYMENT_METHODS = [
    { key: "dinheiro",        label: t("step7.methods.dinheiro.label"),        info: null },
    { key: "cheque",          label: t("step7.methods.cheque.label"),          info: null },
    { key: "cartao_pos",      label: t("step7.methods.cartao_pos.label"),      info: t("step7.methods.cartao_pos.info") },
    { key: "pagamento_prazo", label: t("step7.methods.pagamento_prazo.label"), info: null },
    { key: "pix",             label: t("step7.methods.pix.label"),             info: null },
    { key: "cartao_tef",      label: t("step7.methods.cartao_tef.label"),      info: t("step7.methods.cartao_tef.info") },
  ];
  const cartaoTef = watch("cartao_tef");
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
        {t("step7.heading")}
      </p>
      <div className="space-y-2">
        {PAYMENT_METHODS.map(({ key, label, info }) => (
          <label
            key={key}
            className="flex items-center gap-3 px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:border-orange-200 hover:bg-orange-50/40 transition-all group"
          >
            <input
              type="checkbox"
              {...r(key)}
              className="w-4 h-4 rounded accent-orange-500 cursor-pointer shrink-0"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 flex-1">
              {label}
            </span>
            {info && <InfoTooltip text={info} />}
          </label>
        ))}
      </div>
      {cartaoTef && (
        <div className="pt-1">
          <Input
            label={t("step7.integradoraLabel")}
            placeholder={t("step7.integradoraPlaceholder")}
            {...r("integradora")}
          />
        </div>
      )}
    </div>
  );
}

function Step8({ r, certFile, onCertChange }) {
  const { t } = useTranslation("solicitar");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label={t("step8.cscLabel")} placeholder={t("step8.cscPlaceholder")} {...r("csc")} />
        <Input label={t("step8.tokenLabel")} placeholder={t("step8.tokenPlaceholder")} {...r("token")} />
        <Input label={t("step8.ultimaSerieLabel")} placeholder={t("step8.ultimaSeriePlaceholder")} {...r("ultima_serie_nfce")} />
        <Input label={t("step8.serieNfeLabel")} placeholder={t("step8.serieNfePlaceholder")} {...r("serie_nfe")} />
        <Input label={t("step8.ultimaNfeLabel")} placeholder={t("step8.ultimaNfePlaceholder")} {...r("ultima_nfe_emitida")} />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          {t("step8.certificadoHeading")}
        </p>
        <label className="flex items-center gap-4 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-orange-400 transition-colors group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(245,99,22,0.08)" }}>
            <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">
              {certFile ? certFile.name : t("step8.selectCertificado")}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{t("step8.certExtensions")}</p>
          </div>
          <span className="text-xs text-gray-400 group-hover:text-orange-500 font-medium shrink-0 transition-colors">
            {certFile ? t("step8.change") : t("step8.choose")}
          </span>
          <input type="file" accept=".pfx,.p12,.cer,.crt" className="hidden"
            onChange={(e) => onCertChange(e.target.files?.[0] || null)} />
        </label>
        <div className="mt-3">
          <Input
            label={t("step8.senhaLabel")}
            type="password"
            placeholder={t("step8.senhaPlaceholder")}
            {...r("senha_certificado")}
          />
        </div>
      </div>
    </div>
  );
}


// ─── Confirmation ─────────────────────────────────────────────────────────────

function Confirmation({ getValues, certFile }) {
  const { t } = useTranslation("solicitar");
  const REGIME_LABEL = { "1": t("options.regime.1"), "2": t("options.regime.2"), "3": t("options.regime.3") };
  const ST_LABEL = { "1": t("options.st.1"), "2": t("options.st.2") };
  const v = getValues();
  const sections = [
    { title: t("confirmation.sections.empresa"), rows: [[t("confirmation.fields.razaoSocial"), v.razao_social], [t("confirmation.fields.cnpj"), v.cnpj], [t("confirmation.fields.email"), v.email], [t("confirmation.fields.celular"), v.telefone_celular], [t("confirmation.fields.responsavel"), v.responsavel]] },
    { title: t("confirmation.sections.endereco"), rows: [[t("confirmation.fields.cep"), v.cep], [t("confirmation.fields.endereco"), v.endereco ? `${v.endereco}, ${v.numero}` : ""], [t("confirmation.fields.cidadeUf"), v.cidade ? `${v.cidade} / ${v.estado}` : ""]] },
    { title: t("confirmation.sections.contabilidade"), rows: [[t("confirmation.fields.contador"), v.nome_contador], [t("confirmation.fields.cpf"), v.cpf_contador], [t("confirmation.fields.email"), v.email_contador]] },
    { title: t("confirmation.sections.banco"), rows: [[t("confirmation.fields.banco"), v.nome_banco], [t("confirmation.fields.agConta"), v.agencia ? `${v.agencia}-${v.dv_agencia || ""} / ${v.conta}-${v.dv_conta || ""}` : ""], [t("confirmation.fields.tipo"), v.tipo_conta]] },
    { title: t("confirmation.sections.fiscal"), rows: [[t("confirmation.fields.regime"), REGIME_LABEL[v.regime_tributario] || v.regime_tributario], [t("confirmation.fields.icms"), v.regime_icms], [t("confirmation.fields.condSt"), ST_LABEL[v.condicao_st] || v.condicao_st]] },
  ];
  return (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
      {sections.map((sec) => (
        <div key={sec.title} className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{sec.title}</p>
          </div>
          {sec.rows.filter(([, v]) => v).map(([label, val]) => (
            <div key={label} className="flex gap-3 px-4 py-2 border-t border-gray-50">
              <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
              <span className="text-sm text-gray-800 truncate">{val}</span>
            </div>
          ))}
        </div>
      ))}
      {certFile && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-700 truncate">{certFile.name}</p>
        </div>
      )}
    </div>
  );
}

// ─── Build payload ────────────────────────────────────────────────────────────

const digits = (v) => (v || "").replace(/\D/g, "") || null;
const up = (v) => v ? String(v).toUpperCase() : null;

function buildPayload(d) {
  return {
    cliente: { razao_social: up(d.razao_social), nome_fantasia: up(d.nome_fantasia), cnpj: d.cnpj.replace(/\D/g,""), ie: up(d.ie), email: d.email, telefone_fixo: digits(d.telefone_fixo), telefone_celular: digits(d.telefone_celular), responsavel: up(d.responsavel) },
    endereco: { cep: d.cep, endereco: up(d.endereco), numero: d.numero, bairro: up(d.bairro), cidade: up(d.cidade), estado: up(d.estado) },
    contabilidade: { nome_contador: up(d.nome_contador), cpf: d.cpf_contador, crc: up(d.crc), cnpj: d.cnpj_contador || null, cep: d.cep_contador || null, endereco: up(d.end_contador), numero: d.num_contador || null, bairro: up(d.bairro_contador), cidade: up(d.cidade_contador), estado: up(d.estado_contador), telefone_fixo: d.tel_fixo_contador || null, telefone_celular: d.tel_cel_contador || null, email: d.email_contador || null },
    dados_bancarios: { nome_banco: up(d.nome_banco), cnpj_banco: d.cnpj_banco || null, codigo_banco: d.codigo_banco || null, inscricao_estadual: up(d.ie_banco), agencia: d.agencia || null, dv_agencia: d.dv_agencia || null, conta: d.conta || null, dv_conta: d.dv_conta || null, tipo_conta: d.tipo_conta || null },
    dados_contabeis: { ramo_atividade: d.ramo_atividade || null, crt: d.crt || null, regime_tributario: d.regime_tributario || null, condicao_st: d.condicao_st || null, aliq_simples: d.aliq_simples || null, receita_bruta: d.receita_bruta || null, imposto_renda: d.imposto_renda || null, csll: d.csll || null },
    formas_pagamento: { dinheiro: !!d.dinheiro, cheque: !!d.cheque, cartao_pos: !!d.cartao_pos, pagamento_prazo: !!d.pagamento_prazo, pix: !!d.pix, cartao_tef: !!d.cartao_tef, integradora: up(d.integradora) },
    dados_fiscais: { csc: d.csc || null, token: d.token || null, ultima_serie_nfce: d.ultima_serie_nfce || null, serie_nfe: d.serie_nfe || null, ultima_nfe_emitida: d.ultima_nfe_emitida || null, senha_certificado: d.senha_certificado || null },
    adquirentes: [],
    implantacao: { status: "pendente" },
  };
}

// ─── Checklist Modal ──────────────────────────────────────────────────────────

function PreCheckModal({ onStart }) {
  const { t } = useTranslation("solicitar");
  const CHECKLIST_ITEMS = [
    { icon: "🔐", label: t("precheck.checklist.certificado.label"), detail: t("precheck.checklist.certificado.detail") },
    { icon: "🔑", label: t("precheck.checklist.csc.label"),         detail: t("precheck.checklist.csc.detail") },
    { icon: "📄", label: t("precheck.checklist.series.label"),      detail: t("precheck.checklist.series.detail") },
    { icon: "🏢", label: t("precheck.checklist.contabilidade.label"), detail: t("precheck.checklist.contabilidade.detail") },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }} className="px-7 py-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">📋</span>
            <h2 className="text-lg font-bold text-white leading-tight">
              {t("precheck.title")}
            </h2>
          </div>
          <p className="text-sm text-orange-100 leading-relaxed">
            {t("precheck.subtitle")}
          </p>
        </div>

        {/* Checklist */}
        <div className="px-7 py-5 space-y-3.5">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.label} className="flex items-start gap-3.5">
              <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="mx-7 mb-5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
          <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700 leading-relaxed">
            {t("precheck.tipPrefix")} <strong>*</strong>.
          </p>
        </div>

        {/* CTA */}
        <div className="px-7 pb-7">
          <button
            onClick={onStart}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}
          >
            {t("precheck.cta")}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Solicitar() {
  const { t } = useTranslation("solicitar");
  const navigate = useNavigate();
  const [showPreCheck, setShowPreCheck] = useState(true);
  const [step, setStep] = useState(0);
  const [certFile, setCertFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const STEP_META = t("steps.meta", { returnObjects: true });

  const { register: r, handleSubmit, getValues, trigger, setValue: sv, watch, formState: { errors: e } } =
    useForm({ mode: "onBlur" });

  const isConfirmation = step === TOTAL_STEPS;
  const progress = ((step) / TOTAL_STEPS) * 100;

  async function next() {
    const fields = STEP_REQUIRED[step] || [];
    const ok = fields.length ? await trigger(fields) : true;
    if (ok) setStep((s) => s + 1);
  }

  async function onSubmit() {
    setSubmitting(true);
    setApiError("");
    try {
      const { data: solicitacao } = await solicitacoesApi.criar(buildPayload(getValues()));
      if (certFile) await solicitacoesApi.uploadCertificado(solicitacao.id, certFile);
      navigate("/?enviado=1");
    } catch (err) {
      setApiError(err.message);
      setSubmitting(false);
    }
  }

  const meta = STEP_META[step] || { title: t("steps.confirmationTitle"), subtitle: t("steps.confirmationSubtitle") };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {showPreCheck && <PreCheckModal onStart={() => setShowPreCheck(false)} />}

      {/* ── Fixed header ── */}
      <header className="fixed top-0 inset-x-0 z-20 bg-white border-b border-gray-100">
        <div className="max-w-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt={t("header.logoAlt")} className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold text-gray-900">{t("header.brand")}</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {step + 1} <span className="text-gray-300">/</span> {TOTAL_STEPS + 1}
          </span>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            {t("header.cancel")}
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-100">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, backgroundColor: "#F56316" }}
          />
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-6 pt-20 pb-24">
        <div className="w-full max-w-xl my-auto">

          {/* Step label */}
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: "#F56316" }}>
              {isConfirmation ? t("steps.finalStepLabel") : t("steps.stepLabel", { n: step + 1 })}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{meta.title}</h1>
            <p className="text-sm text-gray-400 mt-1">{meta.subtitle}</p>
          </div>

          {/* Form content */}
          <form onSubmit={(e) => { e.preventDefault(); }}
            className="[&_input:not([type='email']):not([type='password'])]:uppercase">
            {step === 0  && <Step0 r={r} e={e} sv={sv} />}
            {step === 1  && <Step1 r={r} e={e} />}
            {step === 2  && <Step2 r={r} e={e} sv={sv} />}
            {step === 3  && <Step3 r={r} e={e} />}
            {step === 4  && <Step4 r={r} e={e} sv={sv} />}
            {step === 5  && <Step5 r={r} sv={sv} watch={watch} />}
            {step === 6  && <Step6 r={r} watch={watch} />}
            {step === 7  && <Step7 r={r} watch={watch} />}
            {step === 8  && <Step8 r={r} certFile={certFile} onCertChange={setCertFile} />}
            {step === 9  && <Confirmation getValues={getValues} certFile={certFile} />}
          </form>

          {apiError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {apiError}
            </div>
          )}
        </div>
      </main>

      {/* ── Fixed footer nav ── */}
      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-20">
        <div className="max-w-xl mx-auto px-6 h-16 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {t("footer.back")}
            </button>
          ) : (
            <span />
          )}

          {!isConfirmation ? (
            <button
              onClick={next}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: "#F56316" }}
            >
              {t("footer.continue")}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#F56316" }}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("footer.submitting")}
                </>
              ) : (
                <>
                  {t("footer.submit")}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
