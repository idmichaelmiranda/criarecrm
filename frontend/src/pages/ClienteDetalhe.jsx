import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Checkbox } from "../components/ui/Checkbox";
import { clientesApi, implantacoesApi, solicitacoesInstaladorApi } from "../services/api";
import { fmtDate, timeAgoFromUTC } from "../utils/dateUtils";
import { useAuth } from "../contexts/AuthContext";
import { useCep } from "../hooks/useCep";
import { maskPhone, maskCnpj, maskCpf } from "../hooks/useCnpj";
import { BANCOS_BR } from "../data/bancos";


const TABS = ["cadastro", "contabilidade", "operacional", "fiscal", "implantacoes"];

const PAYMENT_FIELDS = ["dinheiro", "cheque", "cartao_pos", "pagamento_prazo", "pix", "cartao_tef"];

const REGIME_KEYS = ["1", "2", "3"];
const CRT_KEYS    = ["1", "2", "3"];
const ST_KEYS      = ["1", "2"];
const CONTA_KEYS  = ["corrente", "poupanca", "pagamento"];

// ── Layout primitives ─────────────────────────────────────────────────────────

function Field({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm text-gray-800 break-words ${mono ? "font-mono text-xs" : ""}`}>
        {value || <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

function Grid({ children, cols = 3 }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""} gap-x-10 gap-y-6`}>
      {children}
    </div>
  );
}

function EditGrid({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function Divider({ title }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest pb-2 mb-5 border-b border-gray-100 mt-8">
      {title}
    </p>
  );
}

function Empty({ text }) {
  return <p className="text-sm text-gray-400 py-2">{text}</p>;
}

// ── Bank Selector ─────────────────────────────────────────────────────────────

function BankSelector({ setValue, watch }) {
  const { t } = useTranslation("clienteDetalhe");
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
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
        <span className="w-12 h-10 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-bold font-mono shrink-0 shadow-sm">
          {codigo || "—"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{nome}</p>
          {cnpj && <p className="text-xs text-gray-500 mt-0.5 font-mono">{cnpj}</p>}
        </div>
        <button type="button" onClick={clear}
          className="text-xs text-gray-600 hover:text-gray-800 px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors shrink-0 font-medium">
          {t("operacional.bankSelector.trocar")}
        </button>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 lg:col-span-3 relative" ref={ref}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("operacional.bankSelector.label")}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t("operacional.bankSelector.placeholder")}
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
              {t("operacional.bankSelector.nenhumEncontrado", { query })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CEP input with auto-lookup ────────────────────────────────────────────────

function EditCepInput({ name, label, register, errors, setValue, fieldMap, required }) {
  const { t } = useTranslation("clienteDetalhe");
  const { fetchCep, loading } = useCep();
  const { ref, onChange: regOnChange, ...rest } = register(name, required ? { required: t("validation.campoObrigatorio", { campo: label }) } : {});
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
          {t("cepBuscando")}
        </span>
      )}
    </div>
  );
}

// ── View tabs ─────────────────────────────────────────────────────────────────

function TabCadastro({ c }) {
  const { t } = useTranslation("clienteDetalhe");
  return (
    <>
      <Grid>
        <Field label={t("cadastro.view.razaoSocial")}  value={c.razao_social} />
        <Field label={t("cadastro.view.nomeFantasia")} value={c.nome_fantasia} />
        <Field label={t("cadastro.view.cnpj")}         value={c.cnpj} mono />
        <Field label={t("cadastro.view.ie")}           value={c.ie} mono />
        <Field label={t("cadastro.view.email")}        value={c.email} />
        <Field label={t("cadastro.view.responsavel")}  value={c.responsavel} />
        <Field label={t("cadastro.view.telefoneFixo")} value={c.telefone_fixo} mono />
        <Field label={t("cadastro.view.celular")}      value={c.telefone_celular} mono />
      </Grid>
      <Divider title={t("cadastro.view.endereco")} />
      {c.endereco ? (
        <Grid>
          <Field label={t("cadastro.view.cep")}      value={c.endereco.cep} mono />
          <Field label={t("cadastro.view.enderecoField")} value={c.endereco.endereco} />
          <Field label={t("cadastro.view.numero")}   value={c.endereco.numero} />
          <Field label={t("cadastro.view.bairro")}   value={c.endereco.bairro} />
          <Field label={t("cadastro.view.cidade")}   value={c.endereco.cidade} />
          <Field label={t("cadastro.view.estado")}   value={c.endereco.estado} />
        </Grid>
      ) : <Empty text={t("cadastro.view.enderecoVazio")} />}
    </>
  );
}

function TabContabilidade({ ct }) {
  const { t } = useTranslation("clienteDetalhe");
  if (!ct) return <Empty text={t("contabilidade.view.vazio")} />;
  return (
    <>
      <Grid>
        <Field label={t("contabilidade.view.nomeContador")} value={ct.nome_contador} />
        <Field label={t("contabilidade.view.cpf")}          value={ct.cpf} mono />
        <Field label={t("contabilidade.view.crc")}          value={ct.crc} />
        <Field label={t("contabilidade.view.cnpj")}         value={ct.cnpj} mono />
        <Field label={t("contabilidade.view.email")}        value={ct.email} />
        <Field label={t("contabilidade.view.telefoneFixo")} value={ct.telefone_fixo} mono />
        <Field label={t("contabilidade.view.celular")}      value={ct.telefone_celular} mono />
      </Grid>
      <Divider title={t("contabilidade.view.enderecoContador")} />
      <Grid>
        <Field label={t("contabilidade.view.cep")}      value={ct.cep} mono />
        <Field label={t("contabilidade.view.endereco")} value={ct.endereco} />
        <Field label={t("contabilidade.view.numero")}   value={ct.numero} />
        <Field label={t("contabilidade.view.bairro")}   value={ct.bairro} />
        <Field label={t("contabilidade.view.cidade")}   value={ct.cidade} />
        <Field label={t("contabilidade.view.estado")}   value={ct.estado} />
      </Grid>
    </>
  );
}

function TabOperacional({ b, p }) {
  const { t } = useTranslation("clienteDetalhe");
  const hasBanking = b && (b.nome_banco || b.agencia || b.conta);

  const match  = b?.nome_banco ? BANCOS_BR.find((bk) => bk.nome === b.nome_banco) : null;
  const codigo = b?.codigo_banco || match?.codigo || null;
  const cnpj   = b?.cnpj_banco   || match?.cnpj   || null;

  return (
    <>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest pb-2 mb-5 border-b border-gray-100">
        {t("operacional.view.dadosBancarios")}
      </p>
      {hasBanking ? (
        <Grid>
          <Field label={t("operacional.view.codBanco")}    value={codigo}       mono />
          <Field label={t("operacional.view.banco")}       value={b.nome_banco}      />
          <Field label={t("operacional.view.cnpjBanco")}   value={cnpj}         mono />
          <Field label={t("operacional.view.tipoConta")}   value={b.tipo_conta}      />
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{t("operacional.view.agencia")}</p>
            <p className="text-sm text-gray-800 font-mono">
              {b.agencia ? `${b.agencia}${b.dv_agencia ? `-${b.dv_agencia}` : ""}` : <span className="text-gray-300">—</span>}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{t("operacional.view.conta")}</p>
            <p className="text-sm text-gray-800 font-mono">
              {b.conta ? `${b.conta}${b.dv_conta ? `-${b.dv_conta}` : ""}` : <span className="text-gray-300">—</span>}
            </p>
          </div>
        </Grid>
      ) : (
        <Empty text={t("operacional.view.dadosBancariosVazio")} />
      )}

      <Divider title={t("operacional.view.formasPagamento")} />

      {p ? (
        <>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_FIELDS.map((key) => (
              <span key={key}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  p[key] ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${p[key] ? "bg-green-500" : "bg-gray-300"}`} />
                {t(`paymentFields.${key}`)}
              </span>
            ))}
          </div>
          {p.cartao_tef && p.integradora && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <Grid><Field label={t("operacional.view.integradoraTef")} value={p.integradora} /></Grid>
            </div>
          )}
        </>
      ) : (
        <Empty text={t("operacional.view.formasPagamentoVazio")} />
      )}
    </>
  );
}

function TabFiscalCompleto({ dc, df, clienteId }) {
  const { t } = useTranslation("clienteDetalhe");
  const [certInfo, setCertInfo]       = useState(null);
  const [showPass, setShowPass]       = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    clientesApi.infoCertificado(clienteId)
      .then(({ data }) => setCertInfo(data))
      .catch(() => setCertInfo({ exists: false }));
  }, [clienteId]);

  function baixar() {
    setDownloading(true);
    clientesApi.baixarCertificado(clienteId)
      .then(({ data }) => {
        const url = URL.createObjectURL(new Blob([data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = certInfo.filename;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {})
      .finally(() => setDownloading(false));
  }

  const isSimples = dc?.regime_tributario === "1";
  const crtLabel    = dc?.crt               && CRT_KEYS.includes(dc.crt)               ? t(`crtOptions.${dc.crt}`)                     : dc?.crt;
  const regimeLabel = dc?.regime_tributario && REGIME_KEYS.includes(dc.regime_tributario) ? t(`regimeOptions.${dc.regime_tributario}`) : dc?.regime_tributario;
  const stLabel     = dc?.condicao_st       && ST_KEYS.includes(dc.condicao_st)         ? t(`stOptions.${dc.condicao_st}`)              : dc?.condicao_st;

  return (
    <>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest pb-2 mb-5 border-b border-gray-100">
        {t("fiscal.view.regimeTributarioTitulo")}
      </p>
      {dc ? (
        <Grid>
          <Field label={t("fiscal.view.crt")}               value={crtLabel} />
          <Field label={t("fiscal.view.regimeTributario")}  value={regimeLabel} />
          <Field label={t("fiscal.view.condicaoSt")}        value={stLabel} />
          {isSimples && (
            <>
              <Field label={t("fiscal.view.aliqSimples")} value={dc.aliq_simples ? `${dc.aliq_simples}%` : null} />
              <Field label={t("fiscal.view.receitaBruta")} value={dc.receita_bruta ? `R$ ${dc.receita_bruta}` : null} />
            </>
          )}
        </Grid>
      ) : (
        <Empty text={t("fiscal.view.regimeVazio")} />
      )}

      {df ? (
        <>
          <Divider title={t("fiscal.view.nfe")} />
          <Grid cols={2}>
            <Field label={t("fiscal.view.serieNfe")}          value={df.serie_nfe} />
            <Field label={t("fiscal.view.ultimaNfeEmitida")} value={df.ultima_nfe_emitida} />
          </Grid>

          <Divider title={t("fiscal.view.nfce")} />
          <Grid>
            <Field label={t("fiscal.view.csc")}                value={df.csc} mono />
            <Field label={t("fiscal.view.token")}              value={df.token} mono />
            <Field label={t("fiscal.view.ultimaSerieNfce")} value={df.ultima_serie_nfce} />
          </Grid>

          <Divider title={t("fiscal.view.certificadoDigital")} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{t("fiscal.view.arquivo")}</p>
              {certInfo === null ? (
                <span className="text-xs text-gray-400 animate-pulse">{t("fiscal.view.verificando")}</span>
              ) : certInfo.exists ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-800 font-mono text-xs break-all">{certInfo.filename}</span>
                  <button onClick={baixar} disabled={downloading}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all disabled:opacity-60">
                    {downloading
                      ? <span className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                      : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    }
                    {downloading ? t("fiscal.view.baixando") : t("fiscal.view.baixar")}
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-300">—</span>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{t("fiscal.view.senha")}</p>
              {df.senha_certificado ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-gray-800">
                    {showPass ? df.senha_certificado : "•".repeat(Math.min(df.senha_certificado.length, 16))}
                  </span>
                  <button onClick={() => setShowPass((v) => !v)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded">
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
              ) : (
                <span className="text-sm text-gray-300">—</span>
              )}
            </div>
          </div>
        </>
      ) : (
        <Empty text={t("fiscal.view.dadosFiscaisVazio")} />
      )}
    </>
  );
}

// ── Edit tabs ─────────────────────────────────────────────────────────────────

function TabCadastroEdit({ r, fe, sv, cnpj }) {
  const { t } = useTranslation("clienteDetalhe");
  return (
    <>
      <EditGrid>
        <Input label={t("cadastro.edit.razaoSocial")} error={fe.razao_social?.message}
          {...r("razao_social", { required: t("validation.obrigatorio") })} />
        <Input label={t("cadastro.edit.nomeFantasia")} {...r("nome_fantasia")} />
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{t("cadastro.edit.cnpj")}</p>
          <p className="input-field bg-gray-50 text-gray-400 cursor-not-allowed select-none text-sm">{cnpj}</p>
        </div>
        <Input label={t("cadastro.edit.ie")} {...r("ie")} />
        <Input label={t("cadastro.edit.email")} type="email" error={fe.email?.message}
          {...r("email", { required: t("validation.obrigatorio"), pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: t("validation.emailInvalido") } })} />
        <Input label={t("cadastro.edit.responsavel")} {...r("responsavel")} />
        <Input label={t("cadastro.edit.telefoneFixo")} placeholder={t("cadastro.edit.telefoneFixoPlaceholder")} maxLength={15}
          {...r("telefone_fixo")} onChange={(e) => { e.target.value = maskPhone(e.target.value); r("telefone_fixo").onChange(e); }} />
        <Input label={t("cadastro.edit.celular")} placeholder={t("cadastro.edit.celularPlaceholder")} maxLength={15} error={fe.telefone_celular?.message}
          {...r("telefone_celular", { required: t("validation.obrigatorio") })} onChange={(e) => { e.target.value = maskPhone(e.target.value); r("telefone_celular", { required: t("validation.obrigatorio") }).onChange(e); }} />
      </EditGrid>
      <Divider title={t("cadastro.edit.endereco")} />
      <EditGrid>
        <EditCepInput name="cep" label={t("cadastro.edit.cep")} register={r} errors={fe} setValue={sv}
          fieldMap={{ logradouro: "endereco", bairro: "bairro", cidade: "cidade", estado: "estado" }} />
        <Input label={t("cadastro.edit.numero")} {...r("numero")} />
        <div className="sm:col-span-2 lg:col-span-1">
          <Input label={t("cadastro.edit.enderecoField")} {...r("endereco")} />
        </div>
        <Input label={t("cadastro.edit.bairro")} {...r("bairro")} />
        <Input label={t("cadastro.edit.cidade")} {...r("cidade")} />
        <Input label={t("cadastro.edit.estadoUf")} maxLength={2} {...r("estado")} />
      </EditGrid>
    </>
  );
}

function TabContabilidadeEdit({ r, fe, sv }) {
  const { t } = useTranslation("clienteDetalhe");
  return (
    <>
      <EditGrid>
        <div className="sm:col-span-2 lg:col-span-1">
          <Input label={t("contabilidade.edit.nomeContador")} error={fe.nome_contador?.message}
            {...r("nome_contador", { required: t("validation.obrigatorio") })} />
        </div>
        <Input label={t("contabilidade.edit.cpf")} placeholder={t("contabilidade.edit.cpfPlaceholder")} maxLength={14}
          {...r("cpf_contador")} onChange={(e) => { e.target.value = maskCpf(e.target.value); r("cpf_contador").onChange(e); }} />
        <Input label={t("contabilidade.edit.crc")} placeholder={t("contabilidade.edit.crcPlaceholder")} {...r("crc")} />
        <Input label={t("contabilidade.edit.cnpjEscritorio")} placeholder={t("contabilidade.edit.cnpjEscritorioPlaceholder")} maxLength={18}
          {...r("cnpj_contador")} onChange={(e) => { e.target.value = maskCnpj(e.target.value); r("cnpj_contador").onChange(e); }} />
        <Input label={t("contabilidade.edit.email")} type="email" {...r("email_contador")} />
        <Input label={t("contabilidade.edit.telefoneFixo")} placeholder={t("contabilidade.edit.telefoneFixoPlaceholder")} maxLength={15}
          {...r("tel_fixo_contador")} onChange={(e) => { e.target.value = maskPhone(e.target.value); r("tel_fixo_contador").onChange(e); }} />
        <Input label={t("contabilidade.edit.celular")} placeholder={t("contabilidade.edit.celularPlaceholder")} maxLength={15}
          {...r("tel_cel_contador")} onChange={(e) => { e.target.value = maskPhone(e.target.value); r("tel_cel_contador").onChange(e); }} />
      </EditGrid>
      <Divider title={t("contabilidade.edit.enderecoContador")} />
      <EditGrid>
        <EditCepInput name="cep_contador" label={t("contabilidade.edit.cep")} register={r} errors={fe} setValue={sv}
          fieldMap={{ logradouro: "end_contador", bairro: "bairro_contador", cidade: "cidade_contador", estado: "estado_contador" }} />
        <Input label={t("contabilidade.edit.numero")} {...r("num_contador")} />
        <div className="sm:col-span-2 lg:col-span-1">
          <Input label={t("contabilidade.edit.endereco")} {...r("end_contador")} />
        </div>
        <Input label={t("contabilidade.edit.bairro")} {...r("bairro_contador")} />
        <Input label={t("contabilidade.edit.cidade")} {...r("cidade_contador")} />
        <Input label={t("contabilidade.edit.estadoUf")} maxLength={2} {...r("estado_contador")} />
      </EditGrid>
    </>
  );
}

function TabOperacionalEdit({ r, sv, watch }) {
  const { t } = useTranslation("clienteDetalhe");
  const cartao_tef = watch("cartao_tef");
  const CONTA_OPTIONS = CONTA_KEYS.map((v) => ({ value: v, label: t(`contaOptions.${v}`) }));
  return (
    <>
      <EditGrid>
        <BankSelector setValue={sv} watch={watch} />
        <Select label={t("operacional.edit.tipoConta")} options={CONTA_OPTIONS} {...r("tipo_conta")} />
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("operacional.edit.agencia")}</label>
          <div className="flex items-center gap-1.5">
            <input placeholder={t("operacional.edit.agenciaPlaceholder")} {...r("agencia")}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
            <span className="text-gray-400 font-bold select-none">-</span>
            <input placeholder={t("operacional.edit.dvPlaceholder")} {...r("dv_agencia")}
              className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("operacional.edit.conta")}</label>
          <div className="flex items-center gap-1.5">
            <input placeholder={t("operacional.edit.contaPlaceholder")} {...r("conta")}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
            <span className="text-gray-400 font-bold select-none">-</span>
            <input placeholder={t("operacional.edit.dvPlaceholder")} {...r("dv_conta")}
              className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
          </div>
        </div>
      </EditGrid>
      <Divider title={t("operacional.edit.formasPagamento")} />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{t("operacional.edit.formasAceitas")}</p>
        {PAYMENT_FIELDS.map((key) => (
          <label key={key}
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:border-orange-200 hover:bg-orange-50/40 transition-all group"
          >
            <input type="checkbox" {...r(key)}
              className="w-4 h-4 rounded accent-orange-500 cursor-pointer shrink-0" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{t(`paymentFields.${key}`)}</span>
          </label>
        ))}
        {cartao_tef && (
          <div className="pt-2">
            <Input label={t("operacional.edit.integradoraTef")} placeholder={t("operacional.edit.integradoraTefPlaceholder")} {...r("integradora")} />
          </div>
        )}
      </div>
    </>
  );
}

function TabFiscalCompletoEdit({ r, watch }) {
  const { t } = useTranslation("clienteDetalhe");
  const regime    = watch("regime_tributario");
  const isSimples = regime === "1";
  const CRT_OPTIONS    = CRT_KEYS.map((v) => ({ value: v, label: t(`crtOptions.${v}`) }));
  const REGIME_OPTIONS = REGIME_KEYS.map((v) => ({ value: v, label: t(`regimeOptions.${v}`) }));
  const ST_OPTIONS     = ST_KEYS.map((v) => ({ value: v, label: t(`stOptions.${v}`) }));
  return (
    <>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest pb-2 mb-5 border-b border-gray-100">
        {t("fiscal.edit.regimeTributario")}
      </p>
      <EditGrid>
        <Select label={t("fiscal.edit.crtSelectLabel")} options={CRT_OPTIONS}    {...r("crt")} />
        <Select label={t("fiscal.edit.regime")}          options={REGIME_OPTIONS} {...r("regime_tributario")} />
        <Select label={t("fiscal.edit.condicaoSt")}      options={ST_OPTIONS}     {...r("condicao_st")} />
        {isSimples && (
          <>
            <Input label={t("fiscal.edit.aliqSimples")} placeholder={t("fiscal.edit.aliqSimplesPlaceholder")}      {...r("aliq_simples")} />
            <Input label={t("fiscal.edit.receitaBruta")} placeholder={t("fiscal.edit.receitaBrutaPlaceholder")} {...r("receita_bruta")} />
          </>
        )}
      </EditGrid>
      <Divider title={t("fiscal.edit.nfe")} />
      <EditGrid>
        <Input label={t("fiscal.edit.serieNfe")}          placeholder={t("fiscal.edit.serieNfePlaceholder")}      {...r("serie_nfe")} />
        <Input label={t("fiscal.edit.ultimaNfeEmitida")} placeholder={t("fiscal.edit.ultimaNfeEmitidaPlaceholder")} {...r("ultima_nfe_emitida")} />
      </EditGrid>
      <Divider title={t("fiscal.edit.nfce")} />
      <EditGrid>
        <Input label={t("fiscal.edit.csc")}               placeholder={t("fiscal.edit.cscPlaceholder")} {...r("csc")} />
        <Input label={t("fiscal.edit.token")}             placeholder={t("fiscal.edit.tokenPlaceholder")}      {...r("token")} />
        <Input label={t("fiscal.edit.ultimaSerieNfce")} placeholder={t("fiscal.edit.ultimaSerieNfcePlaceholder")}            {...r("ultima_serie_nfce")} />
      </EditGrid>
      <Divider title={t("fiscal.edit.certificadoDigital")} />
      <EditGrid>
        <Input label={t("fiscal.edit.senhaCertificado")} type="password" placeholder={t("fiscal.edit.senhaCertificadoPlaceholder")} {...r("senha_certificado")} />
      </EditGrid>
    </>
  );
}

// ── Implantações tab (read-only always) ───────────────────────────────────────

function TabImplantacoes({ implantacoes, loading }) {
  const { t } = useTranslation("clienteDetalhe");
  const navigate = useNavigate();

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-5 h-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
    </div>
  );

  if (implantacoes.length === 0) return (
    <div className="py-8 text-center">
      <p className="text-sm text-gray-400">{t("implantacoes.vazio")}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {implantacoes.map((impl) => (
        <div key={impl.id} onClick={() => navigate(`/admin/implantacoes/${impl.id}`)}
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 cursor-pointer transition-all group"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{impl.codigo}</span>
              <Badge status={impl.status} />
            </div>
            <p className="text-sm font-semibold text-gray-800 mt-1">{impl.nome}</p>
            {impl.consultor && <p className="text-xs text-gray-400 mt-0.5">{t("implantacoes.consultor", { nome: impl.consultor })}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-gray-800">{impl.progresso}%</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {t("implantacoes.sla", { data: impl.sla_limite ? fmtDate(impl.sla_limite) : "—" })}
            </div>
          </div>
          <span className="text-xs text-gray-300 group-hover:text-orange-400 transition-colors font-medium shrink-0">{t("implantacoes.abrir")}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFormDefaults(c) {
  return {
    razao_social:      c.razao_social        || "",
    nome_fantasia:     c.nome_fantasia        || "",
    ie:                c.ie                  || "",
    email:             c.email               || "",
    telefone_fixo:     c.telefone_fixo        || "",
    telefone_celular:  c.telefone_celular     || "",
    responsavel:       c.responsavel          || "",
    // endereco
    cep:     c.endereco?.cep     || "",
    endereco: c.endereco?.endereco || "",
    numero:  c.endereco?.numero  || "",
    bairro:  c.endereco?.bairro  || "",
    cidade:  c.endereco?.cidade  || "",
    estado:  c.endereco?.estado  || "",
    // contabilidade
    nome_contador:    c.contabilidade?.nome_contador    || "",
    cpf_contador:     c.contabilidade?.cpf              || "",
    crc:              c.contabilidade?.crc              || "",
    cnpj_contador:    c.contabilidade?.cnpj             || "",
    email_contador:   c.contabilidade?.email            || "",
    tel_fixo_contador: c.contabilidade?.telefone_fixo   || "",
    tel_cel_contador: c.contabilidade?.telefone_celular || "",
    cep_contador:     c.contabilidade?.cep              || "",
    end_contador:     c.contabilidade?.endereco         || "",
    num_contador:     c.contabilidade?.numero           || "",
    bairro_contador:  c.contabilidade?.bairro           || "",
    cidade_contador:  c.contabilidade?.cidade           || "",
    estado_contador:  c.contabilidade?.estado           || "",
    // bancario
    nome_banco:   c.dados_bancarios?.nome_banco   || "",
    cnpj_banco:   c.dados_bancarios?.cnpj_banco   || "",
    codigo_banco: c.dados_bancarios?.codigo_banco || "",
    agencia:      c.dados_bancarios?.agencia      || "",
    dv_agencia:   c.dados_bancarios?.dv_agencia   || "",
    conta:        c.dados_bancarios?.conta        || "",
    dv_conta:     c.dados_bancarios?.dv_conta     || "",
    tipo_conta:   c.dados_bancarios?.tipo_conta   || "",
    // regime
    crt:               c.dados_contabeis?.crt               || "",
    regime_tributario: c.dados_contabeis?.regime_tributario || "",
    condicao_st:       c.dados_contabeis?.condicao_st       || "",
    aliq_simples:      c.dados_contabeis?.aliq_simples      || "",
    receita_bruta:     c.dados_contabeis?.receita_bruta     || "",
    // pagamentos
    dinheiro:        c.formas_pagamento?.dinheiro        || false,
    cheque:          c.formas_pagamento?.cheque          || false,
    cartao_pos:      c.formas_pagamento?.cartao_pos      || false,
    pagamento_prazo: c.formas_pagamento?.pagamento_prazo || false,
    pix:             c.formas_pagamento?.pix             || false,
    cartao_tef:      c.formas_pagamento?.cartao_tef      || false,
    integradora:     c.formas_pagamento?.integradora     || "",
    // fiscal
    csc:               c.dados_fiscais?.csc               || "",
    token:             c.dados_fiscais?.token             || "",
    ultima_serie_nfce: c.dados_fiscais?.ultima_serie_nfce || "",
    serie_nfe:         c.dados_fiscais?.serie_nfe         || "",
    ultima_nfe_emitida: c.dados_fiscais?.ultima_nfe_emitida || "",
    senha_certificado: c.dados_fiscais?.senha_certificado || "",
  };
}

function buildUpdatePayload(d) {
  const n = (v) => (v === "" || v === undefined) ? null : v;
  return {
    razao_social:     d.razao_social,
    nome_fantasia:    n(d.nome_fantasia),
    ie:               n(d.ie),
    email:            d.email,
    telefone_fixo:    n(d.telefone_fixo),
    telefone_celular: d.telefone_celular,
    responsavel:      n(d.responsavel),
    endereco: {
      cep: d.cep, endereco: d.endereco, numero: d.numero,
      bairro: d.bairro, cidade: d.cidade, estado: d.estado?.toUpperCase(),
    },
    contabilidade: {
      nome_contador:    d.nome_contador,
      cpf:              n(d.cpf_contador),
      crc:              n(d.crc),
      cnpj:             n(d.cnpj_contador),
      email:            n(d.email_contador),
      telefone_fixo:    n(d.tel_fixo_contador),
      telefone_celular: n(d.tel_cel_contador),
      cep:              n(d.cep_contador),
      endereco:         n(d.end_contador),
      numero:           n(d.num_contador),
      bairro:           n(d.bairro_contador),
      cidade:           n(d.cidade_contador),
      estado:           d.estado_contador ? d.estado_contador.toUpperCase() : null,
    },
    dados_bancarios: {
      nome_banco: n(d.nome_banco), cnpj_banco: n(d.cnpj_banco), codigo_banco: n(d.codigo_banco),
      agencia: n(d.agencia), dv_agencia: n(d.dv_agencia),
      conta: n(d.conta), dv_conta: n(d.dv_conta), tipo_conta: n(d.tipo_conta),
    },
    dados_contabeis: {
      crt: n(d.crt), regime_tributario: n(d.regime_tributario),
      condicao_st: n(d.condicao_st), aliq_simples: n(d.aliq_simples), receita_bruta: n(d.receita_bruta),
    },
    formas_pagamento: {
      dinheiro:        !!d.dinheiro,
      cheque:          !!d.cheque,
      cartao_pos:      !!d.cartao_pos,
      pagamento_prazo: !!d.pagamento_prazo,
      pix:             !!d.pix,
      cartao_tef:      !!d.cartao_tef,
      integradora:     n(d.integradora),
    },
    dados_fiscais: {
      csc: n(d.csc), token: n(d.token),
      ultima_serie_nfce: n(d.ultima_serie_nfce),
      serie_nfe: n(d.serie_nfe), ultima_nfe_emitida: n(d.ultima_nfe_emitida),
      senha_certificado: n(d.senha_certificado),
    },
  };
}

function IconDatabase() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path strokeLinecap="round" d="M3 5v5c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
      <path strokeLinecap="round" d="M3 10v5c0 1.657 4.03 3 9 3s9-1.343 9-3v-5" />
    </svg>
  );
}

const IMPL_STATUS_ACTIVE = ["em_andamento", "aguardando", "pendente", "em_revisao"];

function ImplantacaoBadge({ implantacoes, loading, onClick }) {
  const { t } = useTranslation("clienteDetalhe");
  if (loading || implantacoes.length === 0) return null;

  const ativas = implantacoes.filter((i) => IMPL_STATUS_ACTIVE.includes(i.status));

  if (ativas.length > 0) {
    return (
      <button onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        {t("implantacaoBadge.ativas", { count: ativas.length })}
      </button>
    );
  }

  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      {t("implantacaoBadge.total", { count: implantacoes.length })}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClienteDetalhe() {
  const { t } = useTranslation("clienteDetalhe");
  const { id }   = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState("cadastro");
  const [cliente, setCliente]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [gerandoBase, setGerandoBase]       = useState(false);
  const [baseErro, setBaseErro]             = useState(null);
  const [modalAmbiente, setModalAmbiente]   = useState(false);
  const [gerandoChave, setGerandoChave]     = useState(false);
  const [chaveGerada, setChaveGerada]       = useState(null);
  const [chaveErro, setChaveErro]           = useState(null);
  const [implantacoes, setImplantacoes]     = useState([]);
  const [implLoading, setImplLoading]       = useState(true);
  const [solicitacoesInstalador, setSolicitacoesInstalador] = useState([]);
  const [acatandoSolicitacao, setAcatandoSolicitacao]       = useState(null);

  const { register: r, handleSubmit, reset, setValue: sv, watch,
    formState: { errors: fe } } = useForm();

  useEffect(() => {
    clientesApi.obter(id)
      .then(({ data }) => setCliente(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    implantacoesApi.listar()
      .then(({ data }) => setImplantacoes(data.filter((i) => i.cliente_id === parseInt(id))))
      .catch(() => {})
      .finally(() => setImplLoading(false));
  }, [id]);

  useEffect(() => {
    if (!hasPermission("instalador.aprovar")) return;
    const fetchSolicitacoes = () =>
      solicitacoesInstaladorApi.listar({ cliente_id: id, status: "pendente" })
        .then(({ data }) => setSolicitacoesInstalador(data))
        .catch(() => {});
    fetchSolicitacoes();
    const interval = setInterval(fetchSolicitacoes, 10_000);
    return () => clearInterval(interval);
  }, [id, hasPermission]);

  async function handleAprovarSolicitacao(solId) {
    setAcatandoSolicitacao(solId);
    try {
      await solicitacoesInstaladorApi.aprovar(solId);
      setSolicitacoesInstalador((prev) => prev.filter((s) => s.id !== solId));
    } catch (err) {
      setBaseErro(err.message || t("errors.aprovarSolicitacao"));
    } finally {
      setAcatandoSolicitacao(null);
    }
  }

  async function handleRecusarSolicitacao(solId) {
    setAcatandoSolicitacao(solId);
    try {
      await solicitacoesInstaladorApi.recusar(solId);
      setSolicitacoesInstalador((prev) => prev.filter((s) => s.id !== solId));
    } catch (err) {
      setBaseErro(err.message || t("errors.recusarSolicitacao"));
    } finally {
      setAcatandoSolicitacao(null);
    }
  }

  function startEdit() {
    reset(buildFormDefaults(cliente));
    setIsEditing(true);
    setSaveError(null);
  }

  function cancelEdit() {
    setIsEditing(false);
    setSaveError(null);
  }

  async function onSave(formData) {
    setSaving(true);
    setSaveError(null);
    try {
      const { data } = await clientesApi.atualizar(id, buildUpdatePayload(formData));
      setCliente(data);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message || t("errors.salvar"));
    } finally {
      setSaving(false);
    }
  }

  function handleGerarBase() {
    setBaseErro(null);
    setModalAmbiente(true);
  }

  function confirmarAmbiente(ambiente) {
    setModalAmbiente(false);
    setGerandoBase(true);
    setBaseErro(null);
    clientesApi.gerarBase(id, ambiente)
      .then(({ data }) => {
        const cnpjClean = cliente.cnpj.replace(/[\.\-\/]/g, "");
        const sufixo = ambiente === 1 ? "prod" : "homolog";
        const url = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `bdsia_${cnpjClean}_${sufixo}.sql`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => setBaseErro(err.message || t("errors.gerarBase")))
      .finally(() => setGerandoBase(false));
  }

  function handleGerarChaveApi() {
    if (chaveGerada && !confirm(t("confirm.novaChave"))) return;
    setChaveErro(null);
    setGerandoChave(true);
    clientesApi.gerarChaveApi(id)
      .then(({ data }) => setChaveGerada(data.chave_api))
      .catch((err) => setChaveErro(err.message || t("errors.gerarChaveApi")))
      .finally(() => setGerandoChave(false));
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center py-40">
        <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={() => navigate("/admin/clientes")} className="text-xs text-gray-400 hover:underline">
          {t("errors.voltarClientes")}
        </button>
      </div>
    </Layout>
  );

  if (!cliente) return null;

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button onClick={() => navigate("/admin/clientes")}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("header.breadcrumbClientes")}
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 font-medium truncate max-w-[200px]">{cliente.razao_social}</span>
        {isEditing && (
          <span className="ml-1 text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
            {t("header.editando")}
          </span>
        )}
      </div>

      {/* Solicitação(ões) de instalação pendentes via Assistente Criare */}
      {solicitacoesInstalador.length > 0 && (
        <div className="mb-5 space-y-2">
          {solicitacoesInstalador.map((sol) => (
            <div key={sol.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div className="flex-1 min-w-[220px]">
                <p className="text-sm font-semibold text-amber-800">
                  {t("requestBanner.titulo", { cnpj: sol.cnpj })}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {t("requestBanner.tempo", { criada: timeAgoFromUTC(sol.criadoEm), expira: timeAgoFromUTC(sol.expiraEm) })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleRecusarSolicitacao(sol.id)}
                  disabled={acatandoSolicitacao === sol.id}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-red-600 bg-white hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50"
                >
                  {t("requestBanner.recusar")}
                </button>
                <button
                  onClick={() => handleAprovarSolicitacao(sol.id)}
                  disabled={acatandoSolicitacao === sol.id}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {acatandoSolicitacao === sol.id ? t("requestBanner.aguarde") : t("requestBanner.aprovar")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-white text-lg font-bold"
              style={{ background: "linear-gradient(135deg, #253261, #1B2240)" }}>
              {cliente.razao_social.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{cliente.razao_social}</h1>
              {cliente.nome_fantasia && <p className="text-sm text-gray-400 mt-0.5">{cliente.nome_fantasia}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <span className="text-xs font-mono text-gray-500">{cliente.cnpj}</span>
                <span className="text-xs text-gray-500">{cliente.email}</span>
                {cliente.telefone_celular && <span className="text-xs text-gray-500">{cliente.telefone_celular}</span>}
              </div>
              <div className="mt-2">
                <ImplantacaoBadge
                  implantacoes={implantacoes}
                  loading={implLoading}
                  onClick={() => setActiveTab("implantacoes")}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            <p className="text-xs text-gray-400">
              {t("header.cadastroEm", { data: fmtDate(cliente.created_at) })}
            </p>

            {isEditing ? (
              <div className="flex items-center gap-2">
                <button onClick={cancelEdit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                  {t("header.cancelar")}
                </button>
                <button onClick={handleSubmit(onSave)} disabled={saving}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {saving ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {saving ? t("header.salvando") : t("header.salvar")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={startEdit}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t("header.editar")}
                </button>
                <button onClick={handleGerarBase} disabled={gerandoBase}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-indigo-100">
                  {gerandoBase ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-indigo-400 animate-spin" />
                  ) : <IconDatabase />}
                  {gerandoBase ? t("header.gerando") : t("header.gerarBase")}
                </button>
                <button onClick={handleGerarChaveApi} disabled={gerandoChave}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-indigo-100">
                  {gerandoChave ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-indigo-400 animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  )}
                  {gerandoChave ? t("header.gerando") : t("header.chaveApi")}
                </button>
              </div>
            )}

            {saveError && <p className="text-xs text-red-500 max-w-[240px] text-right">{saveError}</p>}
            {baseErro  && <p className="text-xs text-red-500 max-w-[200px] text-right">{baseErro}</p>}
            {chaveErro && <p className="text-xs text-red-500 max-w-[200px] text-right">{chaveErro}</p>}
          </div>
        </div>
      </div>

      {/* Tabbed card */}
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${isEditing ? "border-orange-200" : "border-gray-100"}`}>
        {/* Tab bar */}
        <div className="border-b border-gray-100 overflow-x-auto">
          <div className="flex min-w-max px-2">
            {TABS.map((tabId) => (
              <button key={tabId} onClick={() => setActiveTab(tabId)}
                className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tabId
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                }`}
              >
                {t(`tabs.${tabId}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === "cadastro" && (
            isEditing
              ? <TabCadastroEdit r={r} fe={fe} sv={sv} cnpj={cliente.cnpj} />
              : <TabCadastro c={cliente} />
          )}
          {activeTab === "contabilidade" && (
            isEditing
              ? <TabContabilidadeEdit r={r} fe={fe} sv={sv} />
              : <TabContabilidade ct={cliente.contabilidade} />
          )}
          {activeTab === "operacional" && (
            isEditing
              ? <TabOperacionalEdit r={r} sv={sv} watch={watch} />
              : <TabOperacional b={cliente.dados_bancarios} p={cliente.formas_pagamento} />
          )}
          {activeTab === "fiscal" && (
            isEditing
              ? <TabFiscalCompletoEdit r={r} watch={watch} />
              : <TabFiscalCompleto dc={cliente.dados_contabeis} df={cliente.dados_fiscais} clienteId={id} />
          )}
          {activeTab === "implantacoes" && (
            <TabImplantacoes implantacoes={implantacoes} loading={implLoading} />
          )}
        </div>
      </div>

      {/* ── Modal: seleção de ambiente para geração de base ── */}
      {modalAmbiente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-base font-semibold text-gray-900">{t("modalAmbiente.titulo")}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {t("modalAmbiente.subtitulo")}{" "}
                <span className="font-medium text-gray-700">{cliente.razao_social}</span>.
              </p>
            </div>

            <div className="px-6 py-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => confirmarAmbiente(1)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">{t("modalAmbiente.producao")}</p>
                </div>
              </button>

              <button
                onClick={() => confirmarAmbiente(2)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">{t("modalAmbiente.homologacao")}</p>
                </div>
              </button>
            </div>

            <div className="px-6 pb-5">
              <button
                onClick={() => setModalAmbiente(false)}
                className="w-full py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {t("modalAmbiente.cancelar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: chave de API gerada ── */}
      {chaveGerada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-base font-semibold text-gray-900">{t("modalChave.titulo")}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {t("modalChave.subtitulo")}{" "}
                <span className="font-medium text-gray-700">{cliente.razao_social}</span>.
                {" "}{t("modalChave.aviso")}
              </p>
            </div>

            <div className="px-6 py-4">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <code className="text-xs font-mono text-gray-700 break-all flex-1">{chaveGerada}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(chaveGerada)}
                  className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {t("modalChave.copiar")}
                </button>
              </div>
            </div>

            <div className="px-6 pb-5">
              <button
                onClick={() => setChaveGerada(null)}
                className="w-full py-2 rounded-xl text-sm text-white bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                {t("modalChave.fechar")}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
