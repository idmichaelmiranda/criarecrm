import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { solicitacoesApi } from "../services/api";
import { useCep } from "../hooks/useCep";
import { useCnpj } from "../hooks/useCnpj";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Checkbox } from "../components/ui/Checkbox";

// ── Opções ────────────────────────────────────────────────────────────────────

const RAMO_OPTIONS = [
  { value: "comercio", label: "Comércio" },
  { value: "industria", label: "Indústria" },
];
const CRT_OPTIONS = [
  { value: "1", label: "1 - Simples Nacional" },
  { value: "2", label: "2 - Simples Nacional - Excesso de sublimite" },
  { value: "3", label: "3 - Regime Normal" },
];
const REGIME_OPTIONS = [
  { value: "1", label: "Simples Nacional" },
  { value: "2", label: "Lucro Presumido" },
  { value: "3", label: "Lucro Real" },
];
const ST_OPTIONS = [
  { value: "1", label: "Informante Substituto" },
  { value: "2", label: "Informante Substituído" },
];
const CONTA_OPTIONS = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Conta Poupança" },
  { value: "pagamento", label: "Conta Pagamento" },
];

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
            Não precisa alterar
          </span>
        )}
      </div>
      <div className={`p-6 ${disabled ? "pointer-events-none select-none" : ""}`}>{children}</div>
    </div>
  );
}

function CepField({ name, label, register, errors, setValue, fieldMap, required }) {
  const { fetchCep, loading } = useCep();
  const { ref, onChange: regOnChange, ...rest } = register(name, required ? { required: "CEP obrigatório" } : {});
  return (
    <div className="relative">
      <Input ref={ref} label={label} placeholder="00000-000" maxLength={9}
        error={errors[name]?.message}
        onChange={(e) => { regOnChange(e); fetchCep(e.target.value, setValue, fieldMap); }}
        {...rest} />
      {loading && <span className="absolute right-3 top-8 text-[11px] text-orange-500 animate-pulse">Buscando...</span>}
    </div>
  );
}

// ── Telas de estado ───────────────────────────────────────────────────────────

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#F56316" }}>
            <span className="text-white text-xs font-black">C</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">CriareCRM</span>
          <span className="text-gray-300 text-xs">•</span>
          <span className="text-gray-500 text-xs">Revisão de solicitação</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin mb-4" />
        <p className="text-sm">Carregando sua solicitação...</p>
      </div>
    </PageShell>
  );
}

function ErrorScreen({ code, message }) {
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
          {code === 410 ? "Link expirado" : "Link inválido"}
        </h2>
        <p className="text-sm text-gray-500 max-w-sm">{message}</p>
        <p className="text-xs text-gray-400 mt-4">
          Entre em contato com nossa equipe se precisar de ajuda.
        </p>
      </div>
    </PageShell>
  );
}

function SuccessScreen({ razaoSocial }) {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Dados enviados!</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          As informações de <strong>{razaoSocial}</strong> foram atualizadas com sucesso.
          Nossa equipe irá analisar novamente e você será notificado em breve.
        </p>
      </div>
    </PageShell>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Revisao() {
  const { token } = useParams();
  const [loadState, setLoadState] = useState("loading"); // loading | error | ready | success
  const [errorInfo, setErrorInfo] = useState({ code: 404, message: "" });
  const [solicitacao, setSolicitacao] = useState(null);
  const [certFile, setCertFile] = useState(null);
  const [certCurrentName, setCertCurrentName] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const certInputRef = useRef(null);

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
      setSubmitError(err.message || "Erro ao enviar. Tente novamente.");
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
            <p className="text-sm font-bold text-red-700 mb-1">Sua solicitação precisa de ajustes</p>
            <p className="text-xs text-red-600 leading-relaxed font-medium">
              Motivo: {solicitacao?.motivo_recusa}
            </p>
            <p className="text-xs text-red-500 mt-2">
              Corrija os campos indicados abaixo e clique em <strong>Enviar correção</strong>.
              Nossa equipe será notificada automaticamente.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Empresa */}
        <SectionCard id="empresa" title="Dados da Empresa" disabled={!secaoEditavel("empresa")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="CNPJ *" placeholder="00.000.000/0001-00"
                error={e.cnpj?.message} {...r("cnpj", { required: "CNPJ obrigatório" })} />
            </div>
            <Input label="Inscrição Estadual" placeholder="Opcional" {...r("ie")} />
            <Select label="Ramo de Atividade" options={RAMO_OPTIONS} {...r("ramo_atividade")} />
            <div className="col-span-2">
              <Input label="Razão Social *" placeholder="Ex: Empresa Comércio LTDA"
                error={e.razao_social?.message} {...r("razao_social", { required: "Razão social obrigatória" })} />
            </div>
            <Input label="Nome Fantasia" placeholder="Como é conhecido" {...r("nome_fantasia")} />
            <Input label="Responsável" placeholder="Nome do responsável" {...r("responsavel")} />
          </div>
        </SectionCard>

        {/* Contato */}
        <SectionCard id="contato" title="Contato" disabled={!secaoEditavel("contato")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="E-mail *" type="email" placeholder="contato@empresa.com.br"
                error={e.email?.message}
                {...r("email", { required: "E-mail obrigatório", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: "E-mail inválido" } })} />
            </div>
            <Input label="Celular *" placeholder="(11) 99999-9999"
              error={e.telefone_celular?.message} {...r("telefone_celular", { required: "Celular obrigatório" })} />
            <Input label="Telefone Fixo" placeholder="(11) 3333-3333" {...r("telefone_fixo")} />
          </div>
        </SectionCard>

        {/* Endereço */}
        <SectionCard id="endereco" title="Endereço" disabled={!secaoEditavel("endereco")}>
          <div className="grid grid-cols-2 gap-3">
            <CepField name="cep" label="CEP *" register={register} errors={e} setValue={sv} required
              fieldMap={{ logradouro: "endereco", bairro: "bairro", cidade: "cidade", estado: "estado" }} />
            <Input label="Número *" placeholder="Ex: 123" error={e.numero?.message}
              {...r("numero", { required: "Número obrigatório" })} />
            <div className="col-span-2">
              <Input label="Endereço *" placeholder="Rua, Avenida..." error={e.endereco?.message}
                {...r("endereco", { required: "Endereço obrigatório" })} />
            </div>
            <Input label="Bairro *" placeholder="Ex: Centro" error={e.bairro?.message}
              {...r("bairro", { required: "Bairro obrigatório" })} />
            <Input label="Cidade *" placeholder="Ex: São Paulo" error={e.cidade?.message}
              {...r("cidade", { required: "Cidade obrigatória" })} />
            <Input label="Estado (UF) *" placeholder="SP" maxLength={2} error={e.estado?.message}
              {...r("estado", { required: "Estado obrigatório" })} />
          </div>
        </SectionCard>

        {/* Contabilidade */}
        <SectionCard id="contabilidade" title="Contabilidade" disabled={!secaoEditavel("contabilidade")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Nome do Contador *" placeholder="Nome completo"
                error={e.nome_contador?.message} {...r("nome_contador", { required: "Nome obrigatório" })} />
            </div>
            <Input label="CPF *" placeholder="000.000.000-00"
              error={e.cpf_contador?.message} {...r("cpf_contador", { required: "CPF obrigatório" })} />
            <Input label="CRC" placeholder="CRC-SP 123456" {...r("crc")} />
            <Input label="CNPJ do Escritório" placeholder="00.000.000/0001-00" {...r("cnpj_contador")} />
            <Input label="E-mail do Contador" type="email" {...r("email_contador")} />
            <Input label="Telefone Fixo" placeholder="(11) 3333-3333" {...r("tel_fixo_contador")} />
            <Input label="Celular" placeholder="(11) 99999-9999" {...r("tel_cel_contador")} />
            <CepField name="cep_contador" label="CEP do Escritório" register={register} errors={e} setValue={sv}
              fieldMap={{ logradouro: "end_contador", bairro: "bairro_contador", cidade: "cidade_contador", estado: "estado_contador" }} />
            <Input label="Número" placeholder="Ex: 100" {...r("num_contador")} />
            <div className="col-span-2">
              <Input label="Endereço" placeholder="Rua, Avenida..." {...r("end_contador")} />
            </div>
            <Input label="Bairro" {...r("bairro_contador")} />
            <Input label="Cidade" {...r("cidade_contador")} />
            <Input label="Estado (UF)" maxLength={2} {...r("estado_contador")} />
          </div>
        </SectionCard>

        {/* Dados Bancários */}
        <SectionCard id="banco" title="Dados Bancários" disabled={!secaoEditavel("banco")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Nome do Banco" placeholder="Ex: Banco do Brasil" {...r("nome_banco")} />
            </div>
            <Input label="CNPJ do Banco" placeholder="00.000.000/0001-00" {...r("cnpj_banco")} />
            <Select label="Tipo de Conta" options={CONTA_OPTIONS} {...r("tipo_conta")} />
            <Input label="Agência" placeholder="1234" {...r("agencia")} />
            <Input label="DV Agência" placeholder="5" {...r("dv_agencia")} />
            <Input label="Conta" placeholder="12345" {...r("conta")} />
            <Input label="DV Conta" placeholder="6" {...r("dv_conta")} />
          </div>
        </SectionCard>

        {/* Regime Tributário */}
        <SectionCard id="regime" title="Regime Tributário" disabled={!secaoEditavel("regime")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Select label="CRT — Código de Regime Tributário" options={CRT_OPTIONS} {...r("crt")} />
            </div>
            <Select label="Regime" options={REGIME_OPTIONS} {...r("regime_tributario")} />
            <Select label="Condição ST" options={ST_OPTIONS} {...r("condicao_st")} />
            {isSimples && (
              <>
                <Input label="Alíq. do Simples Nacional (%)" placeholder="Ex: 4,00" {...r("aliq_simples")} />
                <Input label="Receita Bruta (R$)" placeholder="Ex: 360000,00" {...r("receita_bruta")} />
              </>
            )}
          </div>
        </SectionCard>

        {/* Formas de Pagamento */}
        <SectionCard id="pagamento" title="Formas de Pagamento" disabled={!secaoEditavel("pagamento")}>
          <div className="grid grid-cols-3 gap-2.5 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-4">
            <Checkbox label="Dinheiro" {...r("dinheiro")} />
            <Checkbox label="Cheque à Vista" {...r("cheque_vista")} />
            <Checkbox label="Cheque a Prazo" {...r("cheque_prazo")} />
            <Checkbox label="Cartão de Crédito" {...r("cartao_credito")} />
            <Checkbox label="Cartão de Débito" {...r("cartao_debito")} />
            <Checkbox label="Alimentação" {...r("cartao_alimentacao")} />
            <Checkbox label="Cartão Refeição" {...r("cartao_refeicao")} />
            <Checkbox label="Pix (CNPJ)" {...r("pix")} />
            <Checkbox label="A Prazo" {...r("pagamento_prazo")} />
          </div>
          <div className="flex items-center gap-4">
            <Checkbox label="Possui TEF?" {...r("possui_tef")} />
            {possuiTef && (
              <div className="flex-1">
                <Input label="" placeholder="Nome da integradora (ex: Sitef)" {...r("integradora")} />
              </div>
            )}
          </div>
        </SectionCard>

        {/* Dados NFe / NFCe */}
        <SectionCard id="fiscal" title="Dados NFe / NFCe" disabled={!secaoEditavel("fiscal")}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CSC" placeholder="Código de segurança" {...r("csc")} />
            <Input label="Token NFCe" placeholder="Token da SEFAZ" {...r("token")} />
            <Input label="Última Série NFCe" placeholder="Ex: 001" {...r("ultima_serie_nfce")} />
            <Input label="Série NF-e" placeholder="Ex: 1" {...r("serie_nfe")} />
            <Input label="Última NF-e Emitida" placeholder="Ex: 000001" {...r("ultima_nfe_emitida")} />
          </div>
        </SectionCard>

        {/* Certificado Digital */}
        <SectionCard id="certificado" title="Certificado Digital" disabled={!secaoEditavel("certificado")}>
          {certCurrentName && !certFile && (
            <div className="flex items-center gap-2 p-3 mb-3 bg-blue-50 border border-blue-100 rounded-xl">
              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs text-blue-700 truncate">Certificado atual: <strong>{certCurrentName}</strong></span>
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
                {certFile ? certFile.name : certCurrentName ? "Substituir certificado A1" : "Selecionar certificado A1"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">.pfx ou .p12</p>
            </div>
            <span className="text-xs text-gray-400 group-hover:text-orange-500 font-medium shrink-0 transition-colors">
              {certFile ? "Trocar" : "Escolher"}
            </span>
            <input ref={certInputRef} type="file" accept=".pfx,.p12,.cer,.crt" className="hidden"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
          </label>
          <div className="mt-3">
            <Input label="Senha do Certificado" type="password"
              placeholder="Senha do arquivo .pfx / .p12" {...r("senha_certificado")} />
          </div>
        </SectionCard>

        {/* Adquirentes */}
        <SectionCard id="adquirentes" title="Adquirentes / Credenciadoras" disabled={!secaoEditavel("adquirentes")}>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span>Nome</span><span>CNPJ</span><span>Insc. Estadual</span>
            </div>
            {[1, 2, 3].map((n) => (
              <div key={n} className="grid grid-cols-3 gap-2 px-3 py-2 border-t border-gray-100">
                <input placeholder="Ex: Cielo" className="input-field py-1.5 text-sm" {...r(`adq${n}_nome`)} />
                <input placeholder="00.000.000/0001-00" className="input-field py-1.5 text-sm" {...r(`adq${n}_cnpj`)} />
                <input placeholder="Opcional" className="input-field py-1.5 text-sm" {...r(`adq${n}_ie`)} />
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
            {submitting ? "Enviando..." : "Enviar correção"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
