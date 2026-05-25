import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { clientesApi } from "../../services/api";
import { useCep } from "../../hooks/useCep";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Checkbox } from "../ui/Checkbox";
import { Button } from "../ui/Button";

function maskPhone(value) {
  const d = (value || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : "";
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  "Empresa",
  "Contabilidade",
  "Banco & Contábil",
  "Pagamento & NFe",
  "Adquirentes",
  "Confirmação",
];

const STEP_FIELDS = [
  ["razao_social", "cnpj", "telefone_celular", "email", "cep", "endereco", "numero", "bairro", "cidade", "estado"],
  ["nome_contador", "cpf_contador"],
  [],
  [],
  [],
  [],
];

const REGIME_OPTIONS = [
  { value: "1", label: "Simples Nacional" },
  { value: "2", label: "Lucro Presumido" },
  { value: "3", label: "Lucro Real" },
  { value: "4", label: "MEI" },
];

const ICMS_OPTIONS = [
  { value: "tributado", label: "Tributado Integralmente" },
  { value: "isento", label: "Isento" },
  { value: "substituto", label: "Substituto Tributário" },
  { value: "nao_contribuinte", label: "Não Contribuinte" },
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

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
      {STEPS.map((label, idx) => (
        <div key={label} className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                idx < current
                  ? "bg-brand-600 text-white"
                  : idx === current
                  ? "bg-brand-600 text-white ring-4 ring-brand-100"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {idx < current ? "✓" : idx + 1}
            </div>
            <span className={`text-[10px] font-medium whitespace-nowrap ${idx === current ? "text-brand-600" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`h-px w-6 mb-4 ${idx < current ? "bg-brand-500" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div className="col-span-full mb-1 mt-4 first:mt-0">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-2">
        {children}
      </h3>
    </div>
  );
}

// ─── CEP Input with auto-fill ─────────────────────────────────────────────────

function CepInput({ label, name, register, errors, setValue, fieldMap, required = false }) {
  const { fetchCep, loading } = useCep();

  const { ref, onChange: regOnChange, ...regProps } = register(name, {
    ...(required ? { required: "CEP obrigatório" } : {}),
  });

  function handleChange(e) {
    regOnChange(e);
    fetchCep(e.target.value, setValue, fieldMap);
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        label={label}
        placeholder="00000-000"
        maxLength={9}
        onChange={handleChange}
        error={errors[name]?.message}
        {...regProps}
      />
      {loading && (
        <span className="absolute right-3 top-8 text-xs text-brand-500 animate-pulse">
          Buscando...
        </span>
      )}
    </div>
  );
}

// ─── Step 1 — Empresa ────────────────────────────────────────────────────────

function Step1({ register, errors, setValue }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SectionTitle>Dados da Empresa</SectionTitle>

      <Input label="CNPJ *" placeholder="00.000.000/0001-00" error={errors.cnpj?.message}
        {...register("cnpj", { required: "CNPJ obrigatório" })} />
      <Input label="Inscrição Estadual" placeholder="Opcional" {...register("ie")} />

      <div className="sm:col-span-2">
        <Input label="Razão Social *" placeholder="Ex: Empresa LTDA" error={errors.razao_social?.message}
          {...register("razao_social", { required: "Razão social obrigatória" })} />
      </div>
      <Input label="Nome Fantasia" placeholder="Ex: Empresa" {...register("nome_fantasia")} />
      <Input label="Responsável" placeholder="Nome do responsável" {...register("responsavel")} />
      <Input label="E-mail *" type="email" placeholder="contato@empresa.com.br"
        error={errors.email?.message}
        {...register("email", { required: "E-mail obrigatório" })} />
      <Input label="Telefone Fixo" placeholder="(11) 3333-3333" {...phoneRegister("telefone_fixo")} />
      <Input label="Celular *" placeholder="(11) 99999-9999" error={errors.telefone_celular?.message}
        {...phoneRegister("telefone_celular", { required: "Celular obrigatório" })} />

      <SectionTitle>Endereço</SectionTitle>

      <CepInput label="CEP *" name="cep" register={register} errors={errors} setValue={setValue} required
        fieldMap={{ logradouro: "endereco", bairro: "bairro", cidade: "cidade", estado: "estado" }} />
      <div className="sm:col-span-2">
        <Input label="Endereço *" placeholder="Rua, Avenida..." error={errors.endereco?.message}
          {...register("endereco", { required: "Endereço obrigatório" })} />
      </div>
      <Input label="Número *" placeholder="Ex: 123" error={errors.numero?.message}
        {...register("numero", { required: "Número obrigatório" })} />
      <Input label="Bairro *" placeholder="Ex: Centro" error={errors.bairro?.message}
        {...register("bairro", { required: "Bairro obrigatório" })} />
      <Input label="Cidade *" placeholder="Ex: São Paulo" error={errors.cidade?.message}
        {...register("cidade", { required: "Cidade obrigatória" })} />
      <Input label="Estado (UF) *" placeholder="SP" maxLength={2} error={errors.estado?.message}
        {...register("estado", { required: "Estado obrigatório" })} />
    </div>
  );
}

// ─── Step 2 — Contabilidade ──────────────────────────────────────────────────

function Step2({ register, errors, setValue }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SectionTitle>Dados da Contabilidade</SectionTitle>

      <div className="sm:col-span-2">
        <Input label="Nome do Contador *" placeholder="Nome completo" error={errors.nome_contador?.message}
          {...register("nome_contador", { required: "Nome obrigatório" })} />
      </div>
      <Input label="CPF *" placeholder="000.000.000-00" error={errors.cpf_contador?.message}
        {...register("cpf_contador", { required: "CPF obrigatório" })} />
      <Input label="CRC" placeholder="Ex: CRC-SP 123456" {...register("crc")} />
      <Input label="CNPJ" placeholder="00.000.000/0001-00" {...register("cnpj_contador")} />
      <Input label="E-mail" placeholder="contador@escritorio.com.br" {...register("email_contador")} />
      <Input label="Telefone Fixo" placeholder="(11) 3333-3333" {...phoneRegister("tel_fixo_contador")} />
      <Input label="Celular" placeholder="(11) 99999-9999" {...phoneRegister("tel_cel_contador")} />

      <SectionTitle>Endereço do Escritório</SectionTitle>

      <CepInput label="CEP" name="cep_contador" register={register} errors={errors} setValue={setValue}
        fieldMap={{ logradouro: "end_contador", bairro: "bairro_contador", cidade: "cidade_contador", estado: "estado_contador" }} />
      <div className="sm:col-span-2">
        <Input label="Endereço" placeholder="Rua, Avenida..." {...register("end_contador")} />
      </div>
      <Input label="Número" placeholder="Ex: 123" {...register("num_contador")} />
      <Input label="Bairro" placeholder="Ex: Centro" {...register("bairro_contador")} />
      <Input label="Cidade" placeholder="Ex: São Paulo" {...register("cidade_contador")} />
      <Input label="Estado (UF)" placeholder="SP" maxLength={2} {...register("estado_contador")} />
    </div>
  );
}

// ─── Step 3 — Bancário + Contábil ────────────────────────────────────────────

function Step3({ register, errors }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SectionTitle>Dados Bancários</SectionTitle>

      <div className="sm:col-span-2">
        <Input label="Nome do Banco" placeholder="Ex: Banco do Brasil" {...register("nome_banco")} />
      </div>
      <Input label="CNPJ do Banco" placeholder="00.000.000/0001-00" {...register("cnpj_banco")} />
      <Input label="Inscrição Estadual" placeholder="Opcional" {...register("ie_banco")} />
      <Input label="Agência" placeholder="Ex: 1234" {...register("agencia")} />
      <Input label="DV Agência" placeholder="Ex: 5" {...register("dv_agencia")} />
      <Input label="Conta" placeholder="Ex: 12345-6" {...register("conta")} />
      <Input label="DV Conta" placeholder="Ex: 7" {...register("dv_conta")} />
      <Select label="Tipo de Conta" options={CONTA_OPTIONS} {...register("tipo_conta")} />

      <SectionTitle>Dados Contábeis</SectionTitle>

      <Select label="Regime Tributário" options={REGIME_OPTIONS} {...register("regime_tributario")} />
      <Select label="Regime ICMS" options={ICMS_OPTIONS} {...register("regime_icms")} />
      <Select label="Condição ST" options={ST_OPTIONS} {...register("condicao_st")} />
      <Input label="Imposto de Renda (%)" placeholder="Ex: 1,5" {...register("imposto_renda")} />
      <Input label="CSLL (%)" placeholder="Ex: 1,0" {...register("csll")} />
    </div>
  );
}

// ─── Step 4 — Pagamento + NFe ─────────────────────────────────────────────────

function Step4({ register, watch }) {
  const possuiTef = watch("possui_tef");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SectionTitle>Formas de Pagamento</SectionTitle>

      <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <Checkbox label="Dinheiro" {...register("dinheiro")} />
        <Checkbox label="Cheque à Vista" {...register("cheque_vista")} />
        <Checkbox label="Cheque a Prazo" {...register("cheque_prazo")} />
        <Checkbox label="Cartão de Crédito" {...register("cartao_credito")} />
        <Checkbox label="Cartão de Débito" {...register("cartao_debito")} />
        <Checkbox label="Cartão Alimentação" {...register("cartao_alimentacao")} />
        <Checkbox label="Cartão Refeição" {...register("cartao_refeicao")} />
        <Checkbox label="Pix (chave CNPJ)" {...register("pix")} />
        <Checkbox label="Pagamento a Prazo" {...register("pagamento_prazo")} />
      </div>

      <SectionTitle>Integração de Pagamento Eletrônico</SectionTitle>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Checkbox label="Possui TEF?" {...register("possui_tef")} />
      </div>
      {possuiTef && (
        <Input label="Integradora TEF" placeholder="Ex: Sitef, Pay&Go..." {...register("integradora")} />
      )}

      <SectionTitle>Dados NFCe / NF-e</SectionTitle>

      <Input label="CSC" placeholder="Código de segurança" {...register("csc")} />
      <Input label="Token NFCe" placeholder="Token da SEFAZ" {...register("token")} />
      <Input label="Última Série NFCe" placeholder="Ex: 001" {...register("ultima_serie_nfce")} />
      <Input label="Série NF-e" placeholder="Ex: 1" {...register("serie_nfe")} />
      <Input label="Última NF-e Emitida" placeholder="Ex: 000001" {...register("ultima_nfe_emitida")} />
    </div>
  );
}

// ─── Step 5 — Adquirentes + Certificado ──────────────────────────────────────

function Step5({ register, certFile, onCertChange }) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <SectionTitle>Dados da Adquirente (Credenciadora de Cartão)</SectionTitle>

      {[1, 2, 3].map((n) => (
        <div key={n} className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="sm:col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Adquirente {n}
          </p>
          <Input label="Nome" placeholder="Ex: Cielo, Stone..." {...register(`adq${n}_nome`)} />
          <Input label="CNPJ" placeholder="00.000.000/0001-00" {...register(`adq${n}_cnpj`)} />
          <Input label="Inscrição Estadual" placeholder="Opcional" {...register(`adq${n}_ie`)} />
        </div>
      ))}

      <div>
        <SectionTitle>Certificado Digital</SectionTitle>
        <div className="mt-3 flex items-center gap-4 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-400 transition-colors">
          <div className="text-3xl">🔐</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">
              {certFile ? certFile.name : "Nenhum arquivo selecionado"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Arquivo .pfx ou .p12 do certificado digital A1
            </p>
          </div>
          <label className="btn-secondary cursor-pointer text-xs px-3 py-2">
            Selecionar arquivo
            <input
              type="file"
              accept=".pfx,.p12,.cer,.crt"
              className="hidden"
              onChange={(e) => onCertChange(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Step 6 — Confirmação ─────────────────────────────────────────────────────

function Step6({ getValues, certFile }) {
  const v = getValues();

  const sections = [
    {
      title: "Empresa",
      rows: [
        ["Razão Social", v.razao_social],
        ["CNPJ", v.cnpj],
        ["E-mail", v.email],
        ["Celular", v.telefone_celular],
        ["Responsável", v.responsavel],
        ["Endereço", v.endereco ? `${v.endereco}, ${v.numero} — ${v.bairro}, ${v.cidade}/${v.estado}` : ""],
      ],
    },
    {
      title: "Contabilidade",
      rows: [
        ["Contador", v.nome_contador],
        ["CPF", v.cpf_contador],
        ["CRC", v.crc],
        ["E-mail", v.email_contador],
      ],
    },
    {
      title: "Banco",
      rows: [
        ["Banco", v.nome_banco],
        ["Agência / Conta", v.agencia ? `${v.agencia}${v.dv_agencia ? `-${v.dv_agencia}` : ""} / ${v.conta}${v.dv_conta ? `-${v.dv_conta}` : ""}` : ""],
        ["Tipo", v.tipo_conta],
      ],
    },
    {
      title: "Dados Contábeis",
      rows: [
        ["Regime Tributário", v.regime_tributario],
        ["Regime ICMS", v.regime_icms],
        ["Condição ST", v.condicao_st],
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Revise todos os dados antes de enviar.</p>
      {sections.map((sec) => (
        <div key={sec.title} className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{sec.title}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {sec.rows.filter(([, val]) => val).map(([label, val]) => (
              <div key={label} className="flex gap-3 px-4 py-2.5 bg-white">
                <span className="text-xs font-semibold text-gray-400 w-32 shrink-0 pt-0.5">{label}</span>
                <span className="text-sm text-gray-800">{val}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {certFile && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-xl">🔐</span>
          <p className="text-sm text-green-700 font-medium">{certFile.name}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

function buildPayload(data) {
  return {
    cliente: {
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia || null,
      cnpj: data.cnpj,
      ie: data.ie || null,
      email: data.email,
      telefone_fixo: data.telefone_fixo?.replace(/\D/g, "") || null,
      telefone_celular: data.telefone_celular?.replace(/\D/g, "") || null,
      responsavel: data.responsavel || null,
    },
    endereco: {
      cep: data.cep,
      endereco: data.endereco,
      numero: data.numero,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: (data.estado || "").toUpperCase(),
    },
    contabilidade: {
      nome_contador: data.nome_contador,
      cpf: data.cpf_contador,
      crc: data.crc || null,
      cnpj: data.cnpj_contador || null,
      cep: data.cep_contador || null,
      endereco: data.end_contador || null,
      numero: data.num_contador || null,
      bairro: data.bairro_contador || null,
      cidade: data.cidade_contador || null,
      estado: data.estado_contador ? data.estado_contador.toUpperCase() : null,
      telefone_fixo: data.tel_fixo_contador?.replace(/\D/g, "") || null,
      telefone_celular: data.tel_cel_contador?.replace(/\D/g, "") || null,
      email: data.email_contador || null,
    },
    dados_bancarios: {
      nome_banco: data.nome_banco || null,
      cnpj_banco: data.cnpj_banco || null,
      inscricao_estadual: data.ie_banco || null,
      agencia: data.agencia || null,
      dv_agencia: data.dv_agencia || null,
      conta: data.conta || null,
      dv_conta: data.dv_conta || null,
      tipo_conta: data.tipo_conta || null,
    },
    dados_contabeis: {
      regime_tributario: data.regime_tributario || null,
      regime_icms: data.regime_icms || null,
      condicao_st: data.condicao_st || null,
      imposto_renda: data.imposto_renda || null,
      csll: data.csll || null,
    },
    formas_pagamento: {
      dinheiro: !!data.dinheiro,
      cheque_vista: !!data.cheque_vista,
      cheque_prazo: !!data.cheque_prazo,
      cartao_credito: !!data.cartao_credito,
      cartao_debito: !!data.cartao_debito,
      cartao_alimentacao: !!data.cartao_alimentacao,
      cartao_refeicao: !!data.cartao_refeicao,
      pix: !!data.pix,
      pagamento_prazo: !!data.pagamento_prazo,
      possui_tef: !!data.possui_tef,
      integradora: data.integradora || null,
    },
    dados_fiscais: {
      csc: data.csc || null,
      token: data.token || null,
      ultima_serie_nfce: data.ultima_serie_nfce || null,
      serie_nfe: data.serie_nfe || null,
      ultima_nfe_emitida: data.ultima_nfe_emitida || null,
    },
    adquirentes: [
      data.adq1_nome ? { nome: data.adq1_nome, cnpj: data.adq1_cnpj || null, inscricao_estadual: data.adq1_ie || null } : null,
      data.adq2_nome ? { nome: data.adq2_nome, cnpj: data.adq2_cnpj || null, inscricao_estadual: data.adq2_ie || null } : null,
      data.adq3_nome ? { nome: data.adq3_nome, cnpj: data.adq3_cnpj || null, inscricao_estadual: data.adq3_ie || null } : null,
    ].filter(Boolean),
    implantacao: { status: "pendente" },
  };
}

export function MultiStepForm({ onSuccess }) {
  const [step, setStep] = useState(0);
  const [certFile, setCertFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const navigate = useNavigate();

  const { register, handleSubmit, getValues, trigger, setValue, watch, formState: { errors } } =
    useForm({ mode: "onBlur" });

  function phoneRegister(name, options = {}) {
    const reg = register(name, options);
    return {
      ...reg,
      onChange: (e) => {
        e.target.value = maskPhone(e.target.value);
        return reg.onChange(e);
      },
    };
  }

  async function nextStep() {
    const fields = STEP_FIELDS[step];
    const valid = fields.length === 0 ? true : await trigger(fields);
    if (valid) setStep((s) => s + 1);
  }

  async function onSubmit(data) {
    setSubmitting(true);
    setApiError("");
    try {
      const payload = buildPayload(data);
      const { data: cliente } = await clientesApi.criar(payload);
      if (certFile) {
        await clientesApi.uploadCertificado(cliente.id, certFile);
      }
      if (onSuccess) onSuccess();
      else navigate("/clientes");
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isLast = step === STEPS.length - 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepIndicator current={step} />

      <div className="min-h-[380px]">
        {step === 0 && <Step1 register={register} errors={errors} setValue={setValue} />}
        {step === 1 && <Step2 register={register} errors={errors} setValue={setValue} />}
        {step === 2 && <Step3 register={register} errors={errors} />}
        {step === 3 && <Step4 register={register} errors={errors} watch={watch} />}
        {step === 4 && <Step5 register={register} certFile={certFile} onCertChange={setCertFile} />}
        {step === 5 && <Step6 getValues={getValues} certFile={certFile} />}
      </div>

      {apiError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {apiError}
        </div>
      )}

      <div className="flex justify-between mt-8 pt-5 border-t border-gray-100">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
            ← Voltar
          </Button>
        ) : (
          <span />
        )}
        {!isLast ? (
          <Button type="button" onClick={nextStep}>
            Próximo →
          </Button>
        ) : (
          <Button type="submit" loading={submitting}>
            Enviar Solicitação
          </Button>
        )}
      </div>
    </form>
  );
}
