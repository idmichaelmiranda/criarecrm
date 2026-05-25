import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { solicitacoesApi } from "../services/api";
import { useCep } from "../hooks/useCep";
import { useCnpj } from "../hooks/useCnpj";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Checkbox } from "../components/ui/Checkbox";
import { BANCOS_BR } from "../data/bancos";

// ─── Config ───────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 9;

const STEP_META = [
  { title: "Dados da Empresa",    subtitle: "Identificação do estabelecimento" },
  { title: "Contato",             subtitle: "Responsável e meios de contato" },
  { title: "Endereço",            subtitle: "Localização do estabelecimento" },
  { title: "Contabilidade",       subtitle: "Dados do escritório contábil" },
  { title: "Endereço do Contador",subtitle: "Localização do escritório contábil" },
  { title: "Dados Bancários",     subtitle: "Conta corrente para operações" },
  { title: "Regime Tributário",   subtitle: "Configurações fiscais e contábeis" },
  { title: "Formas de Pagamento", subtitle: "Meios aceitos e integração TEF" },
  { title: "Dados NFe / NFCe",    subtitle: "Emissão de documentos fiscais e certificado digital" },
];

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

const RAMO_OPTIONS = [
  { value: "comercio",  label: "Comércio" },
  { value: "industria", label: "Indústria" },
];

const CRT_OPTIONS = [
  { value: "1", label: "1 - Simples Nacional" },
  { value: "2", label: "2 - Simples Nacional - Excesso de sublimite de receita bruta" },
  { value: "3", label: "3 - Regime Normal" },
];

const REGIME_OPTIONS = [
  { value: "1", label: "Simples Nacional" },
  { value: "2", label: "Lucro Presumido" },
  { value: "3", label: "Lucro Real" },
];
const REGIME_LABEL = { "1": "Simples Nacional", "2": "Lucro Presumido", "3": "Lucro Real" };

const ST_OPTIONS = [
  { value: "1", label: "Informante Substituto" },
  { value: "2", label: "Informante Substituído" },
];
const ST_LABEL = { "1": "Informante Substituto", "2": "Informante Substituído" };
const CONTA_OPTIONS = [
  { value: "corrente",         label: "Conta Corrente" },
  { value: "poupanca",         label: "Conta Poupança" },
  { value: "pagamento",        label: "Conta Pagamento" },
];

// ─── CNPJ field ───────────────────────────────────────────────────────────────

function CnpjInput({ register, errors, setValue }) {
  const { fetchCnpj, status } = useCnpj();
  const { ref, onChange: regOnChange, ...rest } = register("cnpj", { required: "CNPJ obrigatório" });

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          ref={ref}
          label="CNPJ *"
          placeholder="00.000.000/0001-00"
          error={errors.cnpj?.message}
          onChange={(e) => { regOnChange(e); fetchCnpj(e.target.value, setValue); }}
          {...rest}
        />
        {status === "loading" && (
          <span className="absolute right-3 top-8 flex items-center gap-1.5 text-[11px] text-orange-500">
            <span className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            Consultando...
          </span>
        )}
      </div>

      {status === "found" && (
        <div className="flex items-center gap-1.5 text-[11px] text-green-600">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Dados preenchidos automaticamente pela Receita Federal
        </div>
      )}
      {status === "not_found" && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          CNPJ não encontrado na Receita Federal
        </div>
      )}
    </div>
  );
}

// ─── CEP field ────────────────────────────────────────────────────────────────

function CepInput({ name, label, register, errors, setValue, fieldMap, required }) {
  const { fetchCep, loading } = useCep();
  const { ref, onChange: regOnChange, ...rest } = register(name, {
    ...(required ? { required: "CEP obrigatório" } : {}),
  });
  return (
    <div className="relative">
      <Input
        ref={ref}
        label={label}
        placeholder="00000-000"
        maxLength={9}
        error={errors[name]?.message}
        onChange={(e) => { regOnChange(e); fetchCep(e.target.value, setValue, fieldMap); }}
        {...rest}
      />
      {loading && (
        <span className="absolute right-3 top-8 text-[11px] text-orange-500 animate-pulse">
          Buscando...
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
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

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
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-2 relative" ref={ref}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Banco</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por nome ou código — ex: Bradesco ou 237"
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
              Nenhum banco encontrado para "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step0({ r, e, sv }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <CnpjInput register={r} errors={e} setValue={sv} />
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
  );
}

function Step1({ r, e }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Input label="E-mail *" type="email" placeholder="contato@empresa.com.br"
          error={e.email?.message}
          {...r("email", {
            required: "E-mail obrigatório",
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: "Informe um e-mail válido" },
          })} />
      </div>
      <Input label="Celular *" placeholder="(11) 99999-9999"
        error={e.telefone_celular?.message}
        {...r("telefone_celular", { required: "Celular obrigatório" })} />
      <Input label="Telefone Fixo" placeholder="(11) 3333-3333" {...r("telefone_fixo")} />
    </div>
  );
}

function Step2({ r, e, sv }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CepInput name="cep" label="CEP *" register={r} errors={e} setValue={sv} required
        fieldMap={{ logradouro: "endereco", bairro: "bairro", cidade: "cidade", estado: "estado" }} />
      <Input label="Número *" placeholder="Ex: 123"
        error={e.numero?.message} {...r("numero", { required: "Número obrigatório" })} />
      <div className="col-span-2">
        <Input label="Endereço *" placeholder="Rua, Avenida..."
          error={e.endereco?.message} {...r("endereco", { required: "Endereço obrigatório" })} />
      </div>
      <Input label="Bairro *" placeholder="Ex: Centro"
        error={e.bairro?.message} {...r("bairro", { required: "Bairro obrigatório" })} />
      <Input label="Cidade *" placeholder="Ex: São Paulo"
        error={e.cidade?.message} {...r("cidade", { required: "Cidade obrigatória" })} />
      <Input label="Estado (UF) *" placeholder="SP" maxLength={2}
        error={e.estado?.message} {...r("estado", { required: "Estado obrigatório" })} />
    </div>
  );
}

function Step3({ r, e }) {
  return (
    <div className="space-y-4">
      <InfoBanner variant="info" icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }>
        Solicite estas informações diretamente com o escritório de contabilidade da empresa antes de prosseguir.
      </InfoBanner>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Input label="Nome do Contador *" placeholder="Nome completo"
          error={e.nome_contador?.message}
          {...r("nome_contador", { required: "Nome obrigatório" })} />
      </div>
      <Input label="CPF *" placeholder="000.000.000-00"
        error={e.cpf_contador?.message}
        {...r("cpf_contador", { required: "CPF obrigatório" })} />
      <Input label="CRC" placeholder="CRC-SP 123456" {...r("crc")} />
      <Input label="CNPJ do Escritório" placeholder="00.000.000/0001-00" {...r("cnpj_contador")} />
      <Input label="E-mail do Contador" type="email" placeholder="contador@escritorio.com.br"
        error={e.email_contador?.message}
        {...r("email_contador", {
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: "Informe um e-mail válido" },
        })} />
      <Input label="Telefone Fixo" placeholder="(11) 3333-3333" {...r("tel_fixo_contador")} />
      <Input label="Celular" placeholder="(11) 99999-9999" {...r("tel_cel_contador")} />
    </div>
    </div>
  );
}

function Step4({ r, e, sv }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CepInput name="cep_contador" label="CEP" register={r} errors={e} setValue={sv}
        fieldMap={{ logradouro: "end_contador", bairro: "bairro_contador", cidade: "cidade_contador", estado: "estado_contador" }} />
      <Input label="Número" placeholder="Ex: 123" {...r("num_contador")} />
      <div className="col-span-2">
        <Input label="Endereço" placeholder="Rua, Avenida..." {...r("end_contador")} />
      </div>
      <Input label="Bairro" placeholder="Ex: Centro" {...r("bairro_contador")} />
      <Input label="Cidade" placeholder="Ex: São Paulo" {...r("cidade_contador")} />
      <Input label="Estado (UF)" placeholder="SP" maxLength={2} {...r("estado_contador")} />
    </div>
  );
}

function Step5({ r, sv, watch }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <BankSelector setValue={sv} watch={watch} />
      <Select label="Tipo de Conta" options={CONTA_OPTIONS} {...r("tipo_conta")} />
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Agência</label>
        <div className="flex items-center gap-1.5">
          <input placeholder="1234" {...r("agencia")}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
          <span className="text-gray-400 font-bold select-none">-</span>
          <input placeholder="DV" {...r("dv_agencia")}
            className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Conta</label>
        <div className="flex items-center gap-1.5">
          <input placeholder="12345" {...r("conta")}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
          <span className="text-gray-400 font-bold select-none">-</span>
          <input placeholder="DV" {...r("dv_conta")}
            className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
        </div>
      </div>
    </div>
  );
}

function Step6({ r, watch }) {
  const regime = watch("regime_tributario");
  const isSimples = regime === "1";
  return (
    <div className="space-y-4">
      <InfoBanner variant="warning" icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      }>
        Em caso de dúvidas sobre estas informações, consulte o contador responsável pela empresa antes de preencher.
      </InfoBanner>
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

const PAYMENT_METHODS = [
  { key: "dinheiro",        label: "Dinheiro",    info: null },
  { key: "cheque",          label: "Cheque",      info: null },
  { key: "cartao_pos",      label: "Cartão-POS",  info: "Terminal físico (maquininha). Aceita crédito e débito nas bandeiras cadastradas junto à adquirente." },
  { key: "pagamento_prazo", label: "Prazo",       info: null },
  { key: "pix",             label: "PIX",         info: null },
  { key: "cartao_tef",      label: "Cartão-TEF",  info: "Integração via software com a integradora (ex: Sitef). Aceita crédito e débito sem maquininha separada — o sistema comunica diretamente com a operadora." },
];

function Step7({ r, watch }) {
  const cartaoTef = watch("cartao_tef");
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
        Selecione as formas de pagamento aceitas
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
            label="Integradora TEF"
            placeholder="Ex: Sitef, Tef Dedicado, PayGo..."
            {...r("integradora")}
          />
        </div>
      )}
    </div>
  );
}

function Step8({ r, certFile, onCertChange }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Input label="CSC" placeholder="Código de segurança" {...r("csc")} />
        <Input label="Token NFCe" placeholder="Token da SEFAZ" {...r("token")} />
        <Input label="Última Série NFCe" placeholder="Ex: 001" {...r("ultima_serie_nfce")} />
        <Input label="Série NF-e" placeholder="Ex: 1" {...r("serie_nfe")} />
        <Input label="Última NF-e Emitida" placeholder="Ex: 000001" {...r("ultima_nfe_emitida")} />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Certificado Digital
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
              {certFile ? certFile.name : "Selecionar certificado A1"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">.pfx ou .p12</p>
          </div>
          <span className="text-xs text-gray-400 group-hover:text-orange-500 font-medium shrink-0 transition-colors">
            {certFile ? "Trocar" : "Escolher"}
          </span>
          <input type="file" accept=".pfx,.p12,.cer,.crt" className="hidden"
            onChange={(e) => onCertChange(e.target.files?.[0] || null)} />
        </label>
        <div className="mt-3">
          <Input
            label="Senha do Certificado"
            type="password"
            placeholder="Senha do arquivo .pfx / .p12"
            {...r("senha_certificado")}
          />
        </div>
      </div>
    </div>
  );
}


// ─── Confirmation ─────────────────────────────────────────────────────────────

function Confirmation({ getValues, certFile }) {
  const v = getValues();
  const sections = [
    { title: "Empresa", rows: [["Razão Social", v.razao_social], ["CNPJ", v.cnpj], ["E-mail", v.email], ["Celular", v.telefone_celular], ["Responsável", v.responsavel]] },
    { title: "Endereço", rows: [["CEP", v.cep], ["Endereço", v.endereco ? `${v.endereco}, ${v.numero}` : ""], ["Cidade/UF", v.cidade ? `${v.cidade} / ${v.estado}` : ""]] },
    { title: "Contabilidade", rows: [["Contador", v.nome_contador], ["CPF", v.cpf_contador], ["E-mail", v.email_contador]] },
    { title: "Banco", rows: [["Banco", v.nome_banco], ["Ag / Conta", v.agencia ? `${v.agencia}-${v.dv_agencia || ""} / ${v.conta}-${v.dv_conta || ""}` : ""], ["Tipo", v.tipo_conta]] },
    { title: "Fiscal", rows: [["Regime", REGIME_LABEL[v.regime_tributario] || v.regime_tributario], ["ICMS", v.regime_icms], ["Cond. ST", ST_LABEL[v.condicao_st] || v.condicao_st]] },
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

function buildPayload(d) {
  return {
    cliente: { razao_social: d.razao_social, nome_fantasia: d.nome_fantasia || null, cnpj: d.cnpj, ie: d.ie || null, email: d.email, telefone_fixo: d.telefone_fixo || null, telefone_celular: d.telefone_celular, responsavel: d.responsavel || null },
    endereco: { cep: d.cep, endereco: d.endereco, numero: d.numero, bairro: d.bairro, cidade: d.cidade, estado: (d.estado || "").toUpperCase() },
    contabilidade: { nome_contador: d.nome_contador, cpf: d.cpf_contador, crc: d.crc || null, cnpj: d.cnpj_contador || null, cep: d.cep_contador || null, endereco: d.end_contador || null, numero: d.num_contador || null, bairro: d.bairro_contador || null, cidade: d.cidade_contador || null, estado: d.estado_contador ? d.estado_contador.toUpperCase() : null, telefone_fixo: d.tel_fixo_contador || null, telefone_celular: d.tel_cel_contador || null, email: d.email_contador || null },
    dados_bancarios: { nome_banco: d.nome_banco || null, cnpj_banco: d.cnpj_banco || null, codigo_banco: d.codigo_banco || null, inscricao_estadual: d.ie_banco || null, agencia: d.agencia || null, dv_agencia: d.dv_agencia || null, conta: d.conta || null, dv_conta: d.dv_conta || null, tipo_conta: d.tipo_conta || null },
    dados_contabeis: { ramo_atividade: d.ramo_atividade || null, crt: d.crt || null, regime_tributario: d.regime_tributario || null, condicao_st: d.condicao_st || null, aliq_simples: d.aliq_simples || null, receita_bruta: d.receita_bruta || null, imposto_renda: d.imposto_renda || null, csll: d.csll || null },
    formas_pagamento: { dinheiro: !!d.dinheiro, cheque: !!d.cheque, cartao_pos: !!d.cartao_pos, pagamento_prazo: !!d.pagamento_prazo, pix: !!d.pix, cartao_tef: !!d.cartao_tef, integradora: d.integradora || null },
    dados_fiscais: { csc: d.csc || null, token: d.token || null, ultima_serie_nfce: d.ultima_serie_nfce || null, serie_nfe: d.serie_nfe || null, ultima_nfe_emitida: d.ultima_nfe_emitida || null, senha_certificado: d.senha_certificado || null },
    adquirentes: [],
    implantacao: { status: "pendente" },
  };
}

// ─── Checklist Modal ──────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  {
    icon: "🔐",
    label: "Certificado Digital A1",
    detail: "Arquivo .pfx ou .p12 e a senha de acesso",
  },
  {
    icon: "🔑",
    label: "CSC e TOKEN NFCe",
    detail: "Código de Segurança do Contribuinte e Token da SEFAZ",
  },
  {
    icon: "📄",
    label: "Séries de Documentos Fiscais",
    detail: "Série da NF-e e última série do NFCe utilizada",
  },
  {
    icon: "🏢",
    label: "Dados da Contabilidade",
    detail: "Nome, CPF, CNPJ, CRC, e-mail, telefone e endereço completo do contador",
  },
];

function PreCheckModal({ onStart }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }} className="px-7 py-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">📋</span>
            <h2 className="text-lg font-bold text-white leading-tight">
              Antes de começar
            </h2>
          </div>
          <p className="text-sm text-orange-100 leading-relaxed">
            Tenha as informações abaixo em mãos para preencher o formulário com agilidade e sem interrupções.
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
            Você poderá pular campos opcionais e retornar depois. Os dados obrigatórios estão marcados com <strong>*</strong>.
          </p>
        </div>

        {/* CTA */}
        <div className="px-7 pb-7">
          <button
            onClick={onStart}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #F56316, #d94f0d)" }}
          >
            Estou pronto — iniciar preenchimento →
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Solicitar() {
  const navigate = useNavigate();
  const [showPreCheck, setShowPreCheck] = useState(true);
  const [step, setStep] = useState(0);
  const [certFile, setCertFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

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

  const meta = STEP_META[step] || { title: "Confirmação", subtitle: "Revise os dados antes de enviar" };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {showPreCheck && <PreCheckModal onStart={() => setShowPreCheck(false)} />}

      {/* ── Fixed header ── */}
      <header className="fixed top-0 inset-x-0 z-20 bg-white border-b border-gray-100">
        <div className="max-w-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="CriareTI" className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold text-gray-900">CriareTI</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {step + 1} <span className="text-gray-300">/</span> {TOTAL_STEPS + 1}
          </span>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            Cancelar
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
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-24">
        <div className="w-full max-w-xl">

          {/* Step label */}
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: "#F56316" }}>
              {isConfirmation ? "Etapa final" : `Etapa ${step + 1}`}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{meta.title}</h1>
            <p className="text-sm text-gray-400 mt-1">{meta.subtitle}</p>
          </div>

          {/* Form content */}
          <form onSubmit={(e) => { e.preventDefault(); }}>
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
              Voltar
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
              Continuar
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
                  Enviando...
                </>
              ) : (
                <>
                  Enviar Solicitação
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
