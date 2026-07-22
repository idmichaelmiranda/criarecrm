import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { solicitacoesApi } from "../services/api";
import { useCep } from "../hooks/useCep";
import { useCnpj } from "../hooks/useCnpj";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Checkbox } from "../components/ui/Checkbox";

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenSolicitacao(sol) {
  const e = sol.endereco || {};
  const ct = sol.contabilidade || {};
  const b = sol.dados_bancarios || {};
  const dc = sol.dados_contabeis || {};
  const fp = sol.formas_pagamento || {};
  const df = sol.dados_fiscais || {};
  const adqs = sol.adquirentes || [];
  return {
    razao_social: sol.razao_social || "",
    nome_fantasia: sol.nome_fantasia || "",
    cnpj: sol.cnpj || "",
    ie: sol.ie || "",
    email: sol.email || "",
    telefone_fixo: sol.telefone_fixo || "",
    telefone_celular: sol.telefone_celular || "",
    responsavel: sol.responsavel || "",
    cep: e.cep || "", endereco: e.endereco || "", numero: e.numero || "",
    bairro: e.bairro || "", cidade: e.cidade || "", estado: e.estado || "",
    nome_contador: ct.nome_contador || "", cpf_contador: ct.cpf || "",
    crc: ct.crc || "", cnpj_contador: ct.cnpj || "",
    cep_contador: ct.cep || "", end_contador: ct.endereco || "",
    num_contador: ct.numero || "", bairro_contador: ct.bairro || "",
    cidade_contador: ct.cidade || "", estado_contador: ct.estado || "",
    tel_fixo_contador: ct.telefone_fixo || "", tel_cel_contador: ct.telefone_celular || "",
    email_contador: ct.email || "",
    nome_banco: b.nome_banco || "", cnpj_banco: b.cnpj_banco || "",
    ie_banco: b.inscricao_estadual || "", agencia: b.agencia || "",
    dv_agencia: b.dv_agencia || "", conta: b.conta || "",
    dv_conta: b.dv_conta || "", tipo_conta: b.tipo_conta || "",
    ramo_atividade: dc.ramo_atividade || "", crt: dc.crt || "",
    regime_tributario: dc.regime_tributario || "", condicao_st: dc.condicao_st || "",
    aliq_simples: dc.aliq_simples || "", receita_bruta: dc.receita_bruta || "",
    imposto_renda: dc.imposto_renda || "", csll: dc.csll || "",
    dinheiro: !!fp.dinheiro, cheque_vista: !!fp.cheque_vista, cheque_prazo: !!fp.cheque_prazo,
    cartao_credito: !!fp.cartao_credito, cartao_debito: !!fp.cartao_debito,
    cartao_alimentacao: !!fp.cartao_alimentacao, cartao_refeicao: !!fp.cartao_refeicao,
    pix: !!fp.pix, pagamento_prazo: !!fp.pagamento_prazo,
    possui_tef: !!fp.possui_tef, integradora: fp.integradora || "",
    csc: df.csc || "", token: df.token || "",
    ultima_serie_nfce: df.ultima_serie_nfce || "", serie_nfe: df.serie_nfe || "",
    ultima_nfe_emitida: df.ultima_nfe_emitida || "", senha_certificado: df.senha_certificado || "",
    adq1_nome: adqs[0]?.nome || "", adq1_cnpj: adqs[0]?.cnpj || "", adq1_ie: adqs[0]?.inscricao_estadual || "",
    adq2_nome: adqs[1]?.nome || "", adq2_cnpj: adqs[1]?.cnpj || "", adq2_ie: adqs[1]?.inscricao_estadual || "",
    adq3_nome: adqs[2]?.nome || "", adq3_cnpj: adqs[2]?.cnpj || "", adq3_ie: adqs[2]?.inscricao_estadual || "",
  };
}

function buildPayload(d) {
  return {
    cliente: {
      razao_social: d.razao_social, nome_fantasia: d.nome_fantasia || null,
      cnpj: d.cnpj, ie: d.ie || null, email: d.email,
      telefone_fixo: d.telefone_fixo || null, telefone_celular: d.telefone_celular,
      responsavel: d.responsavel || null,
    },
    endereco: {
      cep: d.cep, endereco: d.endereco, numero: d.numero,
      bairro: d.bairro, cidade: d.cidade, estado: (d.estado || "").toUpperCase(),
    },
    contabilidade: {
      nome_contador: d.nome_contador, cpf: d.cpf_contador, crc: d.crc || null,
      cnpj: d.cnpj_contador || null, cep: d.cep_contador || null,
      endereco: d.end_contador || null, numero: d.num_contador || null,
      bairro: d.bairro_contador || null, cidade: d.cidade_contador || null,
      estado: d.estado_contador ? d.estado_contador.toUpperCase() : null,
      telefone_fixo: d.tel_fixo_contador || null, telefone_celular: d.tel_cel_contador || null,
      email: d.email_contador || null,
    },
    dados_bancarios: {
      nome_banco: d.nome_banco || null, cnpj_banco: d.cnpj_banco || null,
      inscricao_estadual: d.ie_banco || null, agencia: d.agencia || null,
      dv_agencia: d.dv_agencia || null, conta: d.conta || null,
      dv_conta: d.dv_conta || null, tipo_conta: d.tipo_conta || null,
    },
    dados_contabeis: {
      ramo_atividade: d.ramo_atividade || null, crt: d.crt || null,
      regime_tributario: d.regime_tributario || null, condicao_st: d.condicao_st || null,
      aliq_simples: d.aliq_simples || null, receita_bruta: d.receita_bruta || null,
      imposto_renda: d.imposto_renda || null, csll: d.csll || null,
    },
    formas_pagamento: {
      dinheiro: !!d.dinheiro, cheque_vista: !!d.cheque_vista, cheque_prazo: !!d.cheque_prazo,
      cartao_credito: !!d.cartao_credito, cartao_debito: !!d.cartao_debito,
      cartao_alimentacao: !!d.cartao_alimentacao, cartao_refeicao: !!d.cartao_refeicao,
      pix: !!d.pix, pagamento_prazo: !!d.pagamento_prazo,
      possui_tef: !!d.possui_tef, integradora: d.integradora || null,
    },
    dados_fiscais: {
      csc: d.csc || null, token: d.token || null,
      ultima_serie_nfce: d.ultima_serie_nfce || null, serie_nfe: d.serie_nfe || null,
      ultima_nfe_emitida: d.ultima_nfe_emitida || null, senha_certificado: d.senha_certificado || null,
    },
    adquirentes: [
      d.adq1_nome ? { nome: d.adq1_nome, cnpj: d.adq1_cnpj || null, inscricao_estadual: d.adq1_ie || null } : null,
      d.adq2_nome ? { nome: d.adq2_nome, cnpj: d.adq2_cnpj || null, inscricao_estadual: d.adq2_ie || null } : null,
      d.adq3_nome ? { nome: d.adq3_nome, cnpj: d.adq3_cnpj || null, inscricao_estadual: d.adq3_ie || null } : null,
    ].filter(Boolean),
    implantacao: { status: "pendente" },
  };
}

// ── Sub-componentes de form ───────────────────────────────────────────────────

function SectionCard({ id, title, children, disabled = false }) {
  const { t } = useTranslation("revisao");
  return (
    <div id={id} className={`rounded-2xl border shadow-sm overflow-hidden transition-opacity ${
      disabled ? "border-gray-100 bg-gray-50 opacity-55" : "bg-white border-gray-100"
    }`}>
      <div className={`px-6 py-4 border-b flex items-center justify-between ${
        disabled ? "border-gray-100 bg-gray-100/60" : "border-gray-100 bg-gray-50/60"
      }`}>
        <h3 className={`text-sm font-bold ${disabled ? "text-gray-400" : "text-gray-800"}`}>{title}</h3>
        {disabled && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t("section.readOnlyBadge")}
          </span>
        )}
      </div>
      <div className={`p-6 ${disabled ? "pointer-events-none select-none" : ""}`}>{children}</div>
    </div>
  );
}

function CepField({ name, label, register, errors, setValue, fieldMap, required }) {
  const { t } = useTranslation("revisao");
  const { fetchCep, loading } = useCep();
  const { ref, onChange: regOnChange, ...rest } = register(name, required ? { required: t("cep.required") } : {});
  return (
    <div className="relative">
      <Input ref={ref} label={label} placeholder={t("cep.placeholder")} maxLength={9}
        error={errors[name]?.message}
        onChange={(e) => { regOnChange(e); fetchCep(e.target.value, setValue, fieldMap); }}
        {...rest} />
      {loading && <span className="absolute right-3 top-8 text-[11px] text-orange-500 animate-pulse">{t("cep.searching")}</span>}
    </div>
  );
}

// ── Telas de estado ───────────────────────────────────────────────────────────

function PageShell({ children }) {
  const { t } = useTranslation("revisao");
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#F56316" }}>
            <span className="text-white text-xs font-black">C</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">{t("header.brand")}</span>
          <span className="text-gray-300 text-xs">•</span>
          <span className="text-gray-500 text-xs">{t("header.pageLabel")}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

function LoadingScreen() {
  const { t } = useTranslation("revisao");
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin mb-4" />
        <p className="text-sm">{t("loading.message")}</p>
      </div>
    </PageShell>
  );
}

function ErrorScreen({ code, message }) {
  const { t } = useTranslation("revisao");
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          {code === 410 ? t("error.expiredTitle") : t("error.invalidTitle")}
        </h2>
        <p className="text-sm text-gray-500 max-w-sm">{message}</p>
        <p className="text-xs text-gray-400 mt-4">
          {t("error.contactSupport")}
        </p>
      </div>
    </PageShell>
  );
}

function SuccessScreen({ razaoSocial }) {
  const { t } = useTranslation("revisao");
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">{t("success.title")}</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          {t("success.prefix")} <strong>{razaoSocial}</strong> {t("success.suffix")}
        </p>
      </div>
    </PageShell>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Revisao() {
  const { t } = useTranslation("revisao");
  const { token } = useParams();
  const [loadState, setLoadState] = useState("loading"); // loading | error | ready | success
  const [errorInfo, setErrorInfo] = useState({ code: 404, message: "" });
  const [solicitacao, setSolicitacao] = useState(null);
  const [certFile, setCertFile] = useState(null);
  const [certCurrentName, setCertCurrentName] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const certInputRef = useRef(null);

  const RAMO_OPTIONS = [
    { value: "comercio", label: t("options.ramo.comercio") },
    { value: "industria", label: t("options.ramo.industria") },
  ];
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
  const CONTA_OPTIONS = [
    { value: "corrente", label: t("options.conta.corrente") },
    { value: "poupanca", label: t("options.conta.poupanca") },
    { value: "pagamento", label: t("options.conta.pagamento") },
  ];

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm({ defaultValues: {} });

  const r = (name, opts) => register(name, opts);
  const e = errors;
  const sv = setValue;

  useEffect(() => {
    solicitacoesApi.obterRevisao(token)
      .then(({ data }) => {
        setSolicitacao(data);
        setCertCurrentName(
          data.certificado_path
            ? data.certificado_path.replace(/\\/g, "/").split("/").pop()
            : null
        );
        const flat = flattenSolicitacao(data);
        Object.entries(flat).forEach(([k, v]) => setValue(k, v));
        setLoadState("ready");
      })
      .catch((err) => {
        const status = err.response?.status || 404;
        setErrorInfo({ code: status, message: err.message });
        setLoadState("error");
      });
  }, [token]);

  const regime = watch("regime_tributario");
  const possuiTef = watch("possui_tef");
  const isSimples = regime === "1";

  // Se campos_correcao está preenchido, apenas as seções listadas ficam editáveis
  const camposCorrecao = solicitacao?.campos_correcao || [];
  const hasFilter = camposCorrecao.length > 0;
  function secaoEditavel(key) { return !hasFilter || camposCorrecao.includes(key); }

  async function onSubmit(data) {
    setSubmitting(true);
    setSubmitError("");
    try {
      // 1. Upload do certificado primeiro (se novo arquivo selecionado), antes de invalidar o token
      if (certFile) {
        await solicitacoesApi.uploadCertRevisao(token, certFile);
      }
      // 2. Submete os dados corrigidos (invalida o token)
      await solicitacoesApi.submitRevisao(token, buildPayload(data));
      setLoadState("success");
    } catch (err) {
      setSubmitError(err.message || t("submit.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === "loading") return <LoadingScreen />;
  if (loadState === "error") return <ErrorScreen {...errorInfo} />;
  if (loadState === "success") return <SuccessScreen razaoSocial={solicitacao?.razao_social} />;

  return (
    <PageShell>
      {/* Banner de motivo da recusa */}
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-red-700 mb-1">{t("rejectionBanner.title")}</p>
            <p className="text-xs text-red-600 leading-relaxed font-medium">
              {t("rejectionBanner.reasonPrefix")} {solicitacao?.motivo_recusa}
            </p>
            <p className="text-xs text-red-500 mt-2">
              {t("rejectionBanner.instructionPrefix")} <strong>{t("rejectionBanner.instructionButton")}</strong>.
              {" "}{t("rejectionBanner.instructionSuffix")}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Empresa */}
        <SectionCard id="empresa" title={t("sections.empresa.title")} disabled={!secaoEditavel("empresa")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label={t("sections.empresa.cnpjLabel")} placeholder={t("sections.empresa.cnpjPlaceholder")}
                error={e.cnpj?.message} {...r("cnpj", { required: t("sections.empresa.cnpjRequired") })} />
            </div>
            <Input label={t("sections.empresa.ieLabel")} placeholder={t("sections.empresa.ieOptional")} {...r("ie")} />
            <Select label={t("sections.empresa.ramoLabel")} options={RAMO_OPTIONS} {...r("ramo_atividade")} />
            <div className="col-span-2">
              <Input label={t("sections.empresa.razaoSocialLabel")} placeholder={t("sections.empresa.razaoSocialPlaceholder")}
                error={e.razao_social?.message} {...r("razao_social", { required: t("sections.empresa.razaoSocialRequired") })} />
            </div>
            <Input label={t("sections.empresa.nomeFantasiaLabel")} placeholder={t("sections.empresa.nomeFantasiaPlaceholder")} {...r("nome_fantasia")} />
            <Input label={t("sections.empresa.responsavelLabel")} placeholder={t("sections.empresa.responsavelPlaceholder")} {...r("responsavel")} />
          </div>
        </SectionCard>

        {/* Contato */}
        <SectionCard id="contato" title={t("sections.contato.title")} disabled={!secaoEditavel("contato")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label={t("sections.contato.emailLabel")} type="email" placeholder={t("sections.contato.emailPlaceholder")}
                error={e.email?.message}
                {...r("email", { required: t("sections.contato.emailRequired"), pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: t("sections.contato.emailInvalid") } })} />
            </div>
            <Input label={t("sections.contato.celularLabel")} placeholder={t("sections.contato.celularPlaceholder")}
              error={e.telefone_celular?.message} {...r("telefone_celular", { required: t("sections.contato.celularRequired") })} />
            <Input label={t("sections.contato.telefoneFixoLabel")} placeholder={t("sections.contato.telefoneFixoPlaceholder")} {...r("telefone_fixo")} />
          </div>
        </SectionCard>

        {/* Endereço */}
        <SectionCard id="endereco" title={t("sections.endereco.title")} disabled={!secaoEditavel("endereco")}>
          <div className="grid grid-cols-2 gap-3">
            <CepField name="cep" label={t("sections.endereco.cepLabel")} register={register} errors={e} setValue={sv} required
              fieldMap={{ logradouro: "endereco", bairro: "bairro", cidade: "cidade", estado: "estado" }} />
            <Input label={t("sections.endereco.numeroLabel")} placeholder={t("sections.endereco.numeroPlaceholder")} error={e.numero?.message}
              {...r("numero", { required: t("sections.endereco.numeroRequired") })} />
            <div className="col-span-2">
              <Input label={t("sections.endereco.enderecoLabel")} placeholder={t("sections.endereco.enderecoPlaceholder")} error={e.endereco?.message}
                {...r("endereco", { required: t("sections.endereco.enderecoRequired") })} />
            </div>
            <Input label={t("sections.endereco.bairroLabel")} placeholder={t("sections.endereco.bairroPlaceholder")} error={e.bairro?.message}
              {...r("bairro", { required: t("sections.endereco.bairroRequired") })} />
            <Input label={t("sections.endereco.cidadeLabel")} placeholder={t("sections.endereco.cidadePlaceholder")} error={e.cidade?.message}
              {...r("cidade", { required: t("sections.endereco.cidadeRequired") })} />
            <Input label={t("sections.endereco.estadoLabel")} placeholder={t("sections.endereco.estadoPlaceholder")} maxLength={2} error={e.estado?.message}
              {...r("estado", { required: t("sections.endereco.estadoRequired") })} />
          </div>
        </SectionCard>

        {/* Contabilidade */}
        <SectionCard id="contabilidade" title={t("sections.contabilidade.title")} disabled={!secaoEditavel("contabilidade")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label={t("sections.contabilidade.nomeContadorLabel")} placeholder={t("sections.contabilidade.nomeContadorPlaceholder")}
                error={e.nome_contador?.message} {...r("nome_contador", { required: t("sections.contabilidade.nomeContadorRequired") })} />
            </div>
            <Input label={t("sections.contabilidade.cpfLabel")} placeholder={t("sections.contabilidade.cpfPlaceholder")}
              error={e.cpf_contador?.message} {...r("cpf_contador", { required: t("sections.contabilidade.cpfRequired") })} />
            <Input label={t("sections.contabilidade.crcLabel")} placeholder={t("sections.contabilidade.crcPlaceholder")} {...r("crc")} />
            <Input label={t("sections.contabilidade.cnpjEscritorioLabel")} placeholder={t("sections.contabilidade.cnpjEscritorioPlaceholder")} {...r("cnpj_contador")} />
            <Input label={t("sections.contabilidade.emailContadorLabel")} type="email" {...r("email_contador")} />
            <Input label={t("sections.contabilidade.telefoneFixoLabel")} placeholder={t("sections.contabilidade.telefoneFixoPlaceholder")} {...r("tel_fixo_contador")} />
            <Input label={t("sections.contabilidade.celularLabel")} placeholder={t("sections.contabilidade.celularPlaceholder")} {...r("tel_cel_contador")} />
            <CepField name="cep_contador" label={t("sections.contabilidade.cepEscritorioLabel")} register={register} errors={e} setValue={sv}
              fieldMap={{ logradouro: "end_contador", bairro: "bairro_contador", cidade: "cidade_contador", estado: "estado_contador" }} />
            <Input label={t("sections.contabilidade.numeroLabel")} placeholder={t("sections.contabilidade.numeroPlaceholder")} {...r("num_contador")} />
            <div className="col-span-2">
              <Input label={t("sections.contabilidade.enderecoLabel")} placeholder={t("sections.contabilidade.enderecoPlaceholder")} {...r("end_contador")} />
            </div>
            <Input label={t("sections.contabilidade.bairroLabel")} {...r("bairro_contador")} />
            <Input label={t("sections.contabilidade.cidadeLabel")} {...r("cidade_contador")} />
            <Input label={t("sections.contabilidade.estadoLabel")} maxLength={2} {...r("estado_contador")} />
          </div>
        </SectionCard>

        {/* Dados Bancários */}
        <SectionCard id="banco" title={t("sections.banco.title")} disabled={!secaoEditavel("banco")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label={t("sections.banco.nomeBancoLabel")} placeholder={t("sections.banco.nomeBancoPlaceholder")} {...r("nome_banco")} />
            </div>
            <Input label={t("sections.banco.cnpjBancoLabel")} placeholder={t("sections.banco.cnpjBancoPlaceholder")} {...r("cnpj_banco")} />
            <Select label={t("sections.banco.tipoContaLabel")} options={CONTA_OPTIONS} {...r("tipo_conta")} />
            <Input label={t("sections.banco.agenciaLabel")} placeholder={t("sections.banco.agenciaPlaceholder")} {...r("agencia")} />
            <Input label={t("sections.banco.dvAgenciaLabel")} placeholder={t("sections.banco.dvAgenciaPlaceholder")} {...r("dv_agencia")} />
            <Input label={t("sections.banco.contaLabel")} placeholder={t("sections.banco.contaPlaceholder")} {...r("conta")} />
            <Input label={t("sections.banco.dvContaLabel")} placeholder={t("sections.banco.dvContaPlaceholder")} {...r("dv_conta")} />
          </div>
        </SectionCard>

        {/* Regime Tributário */}
        <SectionCard id="regime" title={t("sections.regime.title")} disabled={!secaoEditavel("regime")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Select label={t("sections.regime.crtLabel")} options={CRT_OPTIONS} {...r("crt")} />
            </div>
            <Select label={t("sections.regime.regimeLabel")} options={REGIME_OPTIONS} {...r("regime_tributario")} />
            <Select label={t("sections.regime.condicaoStLabel")} options={ST_OPTIONS} {...r("condicao_st")} />
            {isSimples && (
              <>
                <Input label={t("sections.regime.aliqSimplesLabel")} placeholder={t("sections.regime.aliqSimplesPlaceholder")} {...r("aliq_simples")} />
                <Input label={t("sections.regime.receitaBrutaLabel")} placeholder={t("sections.regime.receitaBrutaPlaceholder")} {...r("receita_bruta")} />
              </>
            )}
          </div>
        </SectionCard>

        {/* Formas de Pagamento */}
        <SectionCard id="pagamento" title={t("sections.pagamento.title")} disabled={!secaoEditavel("pagamento")}>
          <div className="grid grid-cols-3 gap-2.5 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-4">
            <Checkbox label={t("sections.pagamento.dinheiro")} {...r("dinheiro")} />
            <Checkbox label={t("sections.pagamento.chequeVista")} {...r("cheque_vista")} />
            <Checkbox label={t("sections.pagamento.chequePrazo")} {...r("cheque_prazo")} />
            <Checkbox label={t("sections.pagamento.cartaoCredito")} {...r("cartao_credito")} />
            <Checkbox label={t("sections.pagamento.cartaoDebito")} {...r("cartao_debito")} />
            <Checkbox label={t("sections.pagamento.alimentacao")} {...r("cartao_alimentacao")} />
            <Checkbox label={t("sections.pagamento.cartaoRefeicao")} {...r("cartao_refeicao")} />
            <Checkbox label={t("sections.pagamento.pix")} {...r("pix")} />
            <Checkbox label={t("sections.pagamento.aPrazo")} {...r("pagamento_prazo")} />
          </div>
          <div className="flex items-center gap-4">
            <Checkbox label={t("sections.pagamento.possuiTef")} {...r("possui_tef")} />
            {possuiTef && (
              <div className="flex-1">
                <Input label="" placeholder={t("sections.pagamento.integradoraPlaceholder")} {...r("integradora")} />
              </div>
            )}
          </div>
        </SectionCard>

        {/* Dados NFe / NFCe */}
        <SectionCard id="fiscal" title={t("sections.fiscal.title")} disabled={!secaoEditavel("fiscal")}>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("sections.fiscal.cscLabel")} placeholder={t("sections.fiscal.cscPlaceholder")} {...r("csc")} />
            <Input label={t("sections.fiscal.tokenLabel")} placeholder={t("sections.fiscal.tokenPlaceholder")} {...r("token")} />
            <Input label={t("sections.fiscal.ultimaSerieLabel")} placeholder={t("sections.fiscal.ultimaSeriePlaceholder")} {...r("ultima_serie_nfce")} />
            <Input label={t("sections.fiscal.serieNfeLabel")} placeholder={t("sections.fiscal.serieNfePlaceholder")} {...r("serie_nfe")} />
            <Input label={t("sections.fiscal.ultimaNfeLabel")} placeholder={t("sections.fiscal.ultimaNfePlaceholder")} {...r("ultima_nfe_emitida")} />
          </div>
        </SectionCard>

        {/* Certificado Digital */}
        <SectionCard id="certificado" title={t("sections.certificado.title")} disabled={!secaoEditavel("certificado")}>
          {certCurrentName && !certFile && (
            <div className="flex items-center gap-2 p-3 mb-3 bg-blue-50 border border-blue-100 rounded-xl">
              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs text-blue-700 truncate">{t("sections.certificado.currentPrefix")} <strong>{certCurrentName}</strong></span>
            </div>
          )}
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
                {certFile ? certFile.name : certCurrentName ? t("sections.certificado.replaceCertificado") : t("sections.certificado.selectCertificado")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{t("sections.certificado.certExtensions")}</p>
            </div>
            <span className="text-xs text-gray-400 group-hover:text-orange-500 font-medium shrink-0 transition-colors">
              {certFile ? t("sections.certificado.change") : t("sections.certificado.choose")}
            </span>
            <input ref={certInputRef} type="file" accept=".pfx,.p12,.cer,.crt" className="hidden"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
          </label>
          <div className="mt-3">
            <Input label={t("sections.certificado.senhaLabel")} type="password"
              placeholder={t("sections.certificado.senhaPlaceholder")} {...r("senha_certificado")} />
          </div>
        </SectionCard>

        {/* Adquirentes */}
        <SectionCard id="adquirentes" title={t("sections.adquirentes.title")} disabled={!secaoEditavel("adquirentes")}>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span>{t("sections.adquirentes.nome")}</span><span>{t("sections.adquirentes.cnpj")}</span><span>{t("sections.adquirentes.ie")}</span>
            </div>
            {[1, 2, 3].map((n) => (
              <div key={n} className="grid grid-cols-3 gap-2 px-3 py-2 border-t border-gray-100">
                <input placeholder={t("sections.adquirentes.nomePlaceholder")} className="input-field py-1.5 text-sm" {...r(`adq${n}_nome`)} />
                <input placeholder={t("sections.adquirentes.cnpjPlaceholder")} className="input-field py-1.5 text-sm" {...r(`adq${n}_cnpj`)} />
                <input placeholder={t("sections.adquirentes.iePlaceholder")} className="input-field py-1.5 text-sm" {...r(`adq${n}_ie`)} />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Feedback de submit */}
        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* Botão de envio */}
        <div className="flex justify-end pb-8">
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{ background: submitting ? "#ccc" : "#F56316" }}>
            {submitting && (
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {submitting ? t("submit.sending") : t("submit.button")}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
