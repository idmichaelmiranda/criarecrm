import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { instalacaosApi, usuariosApi, configuracoesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { fmtDate, fmtDateOnly } from "../utils/dateUtils";

function maskPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2)  return digits.length ? `(${digits}` : "";
  if (digits.length <= 6)  return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

const TIPO_LABEL = {
  pdv: "PDV Adicional",
  coletor: "Coletor Mobile",
  forca_vendas: "Força de Vendas",
  impressora: "Impressora",
  outro: "Outro",
};

const TIPO_COLOR = {
  pdv:          "bg-blue-100 text-blue-700",
  coletor:      "bg-purple-100 text-purple-700",
  forca_vendas: "bg-orange-100 text-orange-700",
  impressora:   "bg-teal-100 text-teal-700",
  outro:        "bg-gray-100 text-gray-600",
};

const STATUS_LABEL = {
  agendada:    "Agendada",
  em_execucao: "Em Execução",
  concluida:   "Concluída",
  cancelada:   "Cancelada",
};

const STATUS_COLOR = {
  agendada:    "bg-blue-100 text-blue-700",
  em_execucao: "bg-orange-100 text-orange-700",
  concluida:   "bg-green-100 text-green-700",
  cancelada:   "bg-gray-100 text-gray-500",
};

const STATUS_ACCENT = {
  agendada:    "bg-blue-400",
  em_execucao: "bg-orange-400",
  concluida:   "bg-green-500",
  cancelada:   "bg-gray-300",
};

const PRIORIDADE_COLOR = {
  alta:    "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

const ATIVAS_STATUSES   = ["agendada", "em_execucao"];
const HISTORICO_STATUSES = ["concluida", "cancelada"];

const TABS = [
  { key: "ativas",    label: "Ativas"    },
  { key: "historico", label: "Histórico" },
  { key: "todos",     label: "Todas"     },
];

function ProgBar({ value }) {
  const color = value === 100 ? "bg-green-500" : value > 50 ? "bg-blue-500" : value > 0 ? "bg-orange-400" : "bg-gray-200";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div className={`h-2.5 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function Avatar({ nome, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        className="w-6 h-6 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = (nome || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = [
    "bg-violet-100 text-violet-600",
    "bg-blue-100 text-blue-600",
    "bg-teal-100 text-teal-600",
    "bg-orange-100 text-orange-600",
    "bg-pink-100 text-pink-600",
  ];
  const color = colors[(nome || "").charCodeAt(0) % colors.length];
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

function dataRelativa(dataStr) {
  if (!dataStr) return null;
  const d = new Date(dataStr + "T00:00:00");
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((d - hoje) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d atraso`, cls: "text-red-600 font-semibold" };
  if (diff === 0) return { label: "Hoje", cls: "text-orange-600 font-semibold" };
  if (diff === 1) return { label: "Amanhã", cls: "text-yellow-600 font-semibold" };
  if (diff <= 7) return { label: `${diff}d`, cls: "text-yellow-600" };
  return { label: `${diff}d`, cls: "text-gray-400" };
}

// ── Tipo helpers ──────────────────────────────────────────────────────────────

function normalizeTipo(t) {
  return t.startsWith("instalacao_") ? t : `instalacao_${t}`;
}

// ── Modal Nova Instalação ─────────────────────────────────────────────────────

function UserAvatar({ nome, avatarUrl, size = "md" }) {
  const dim = size === "sm" ? "w-6 h-6 text-[9px]" : "w-8 h-8 text-[11px]";
  if (avatarUrl) return <img src={avatarUrl} alt={nome} className={`${dim} rounded-full object-cover shrink-0`} />;
  const initials = (nome || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const palette = ["bg-violet-100 text-violet-600","bg-blue-100 text-blue-600","bg-teal-100 text-teal-600","bg-orange-100 text-orange-600","bg-pink-100 text-pink-600"];
  const color = palette[(nome || "").charCodeAt(0) % palette.length];
  return <div className={`${dim} rounded-full flex items-center justify-center font-bold shrink-0 ${color}`}>{initials}</div>;
}

function ResponsavelPicker({ usuarios, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = usuarios.find((u) => String(u.id) === String(value)) || null;

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const btnBase = "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-lg bg-white hover:border-orange-400 focus:outline-none focus:border-orange-400 transition-colors"
      >
        {selected ? (
          <>
            <UserAvatar nome={selected.nome} avatarUrl={selected.avatar_url} size="sm" />
            <span className="flex-1 text-left text-sm text-gray-700 truncate">{selected.nome}</span>
          </>
        ) : (
          <>
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <span className="flex-1 text-left text-sm text-gray-400">Sem responsável</span>
          </>
        )}
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden py-1">
          {/* Sem responsável */}
          <button type="button" onClick={() => { onChange(""); setOpen(false); }}
            className={`${btnBase} ${!value ? "bg-orange-50" : ""}`}>
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <span className="flex-1 text-left text-gray-500">Sem responsável</span>
            {!value && <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
          </button>

          {usuarios.length > 0 && <div className="border-t border-gray-100 my-1" />}

          {usuarios.map((u) => {
            const isSelected = String(u.id) === String(value);
            return (
              <button key={u.id} type="button" onClick={() => { onChange(String(u.id)); setOpen(false); }}
                className={`${btnBase} ${isSelected ? "bg-orange-50" : ""}`}>
                <UserAvatar nome={u.nome} avatarUrl={u.avatar_url} />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{u.nome}</p>
                  {u.grupo_nome && <p className="text-[10px] text-gray-400 truncate">{u.grupo_nome}</p>}
                </div>
                {isSelected && <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-2 mb-3 border-b border-gray-100">
      {children}
    </p>
  );
}

function NovaInstalacaoModal({ onClose, onCreated, tiposConfig = [] }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({
    cliente_id: "",
    cliente_nome: "",
    cliente_cnpj: "",
    tipos: [],
    prioridade: "normal",
    responsavel_id: "",
    data_agendada: new Date().toISOString().slice(0, 10),
    contato_nome: "",
    contato_telefone: "",
    observacoes: "",
  });
  const [quantidades, setQuantidades] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ERP client lookup by CNPJ
  const [cnpjInput, setCnpjInput]       = useState("");
  const [clienteFound, setClienteFound] = useState(null);   // {id, nome, cnpj} or false
  const [clienteLoading, setClienteLoading] = useState(false);
  const [clienteError, setClienteError]     = useState("");
  const cnpjRef = useRef(null);

  useEffect(() => {
    usuariosApi.listar().then(({ data }) => setUsuarios(data.filter((u) => u.ativo))).catch(() => {});
  }, []);

  async function buscarCliente() {
    const cnpj = cnpjInput.trim();
    if (!cnpj) return;
    setClienteLoading(true);
    setClienteError("");
    setClienteFound(null);
    try {
      const { data } = await configuracoesApi.erpClientes(cnpj);
      if (data.length > 0) {
        setClienteFound(data[0]);
      } else {
        setClienteFound(false);
        setClienteError("CNPJ não encontrado ou cliente inativo no ERP.");
      }
    } catch (err) {
      setClienteFound(false);
      setClienteError(err.message || "Erro ao consultar ERP.");
    } finally {
      setClienteLoading(false);
    }
  }

  function selectCliente(c) {
    // ERP may not return an id — fall back to cnpj so the field is always truthy
    setForm((f) => ({ ...f, cliente_id: c.id || c.cnpj || c.nome, cliente_nome: c.nome, cliente_cnpj: c.cnpj }));
  }

  function clearCliente() {
    setForm((f) => ({ ...f, cliente_id: "", cliente_nome: "", cliente_cnpj: "" }));
    setCnpjInput("");
    setClienteFound(null);
    setClienteError("");
    setTimeout(() => cnpjRef.current?.focus(), 50);
  }

  function toggleTipo(key) {
    setForm((f) => ({
      ...f,
      tipos: f.tipos.includes(key) ? f.tipos.filter((t) => t !== key) : [...f.tipos, key],
    }));
    // Initialize quantity to 1 on first selection; preserve if reselected
    setQuantidades((q) => ({ [key]: 1, ...q }));
  }

  function changeQty(key, delta, e) {
    e.stopPropagation();
    setQuantidades((q) => ({ ...q, [key]: Math.max(1, Math.min(99, (q[key] || 1) + delta)) }));
  }

  const totalQty = form.tipos.reduce((s, t) => s + (quantidades[t] || 1), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.cliente_nome) { setError("Selecione o cliente."); return; }
    if (form.tipos.length === 0) { setError("Selecione ao menos um tipo de produto."); return; }
    setSaving(true);
    setError("");
    try {
      // Resolve ERP client → CRM cliente_id (upsert by CNPJ)
      const { data: resolved } = await configuracoesApi.erpResolveCliente({
        id: form.cliente_id,
        nome: form.cliente_nome,
        cnpj: form.cliente_cnpj,
      });

      const { data } = await instalacaosApi.criar({
        tipos: form.tipos,
        cliente_id: resolved.cliente_id,
        quantidade: totalQty,
        prioridade: form.prioridade,
        responsavel_id: form.responsavel_id ? parseInt(form.responsavel_id) : null,
        data_agendada: form.data_agendada || null,
        contato_nome: form.contato_nome || null,
        contato_telefone: form.contato_telefone || null,
        observacoes: form.observacoes || null,
      });
      onCreated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">Nova Instalação</h2>
            <p className="text-xs text-gray-400 mt-0.5">Preencha os dados e selecione os produtos</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 shrink-0">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        {/* Two-column body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="grid grid-cols-[1fr_300px] flex-1 min-h-0 overflow-y-auto">

            {/* ── Coluna esquerda: campos ── */}
            <div className="px-6 py-5 space-y-5 border-r border-gray-100">

              {/* CLIENTE */}
              <div>
                <SectionLabel>Cliente</SectionLabel>
                {form.cliente_nome ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 border-indigo-300 bg-indigo-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{form.cliente_nome}</p>
                      {form.cliente_cnpj && <p className="text-[11px] text-gray-400 font-mono">{form.cliente_cnpj}</p>}
                    </div>
                    <button type="button" onClick={clearCliente}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-white/60 transition-colors shrink-0">
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input ref={cnpjRef} type="text" value={cnpjInput}
                        onChange={(e) => { setCnpjInput(e.target.value); setClienteFound(null); setClienteError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscarCliente())}
                        placeholder="Digite o CNPJ do cliente…"
                        className={`${inputCls} flex-1 font-mono`} autoComplete="off" />
                      <button type="button" onClick={buscarCliente} disabled={clienteLoading || !cnpjInput.trim()}
                        className="px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors shrink-0 flex items-center gap-1.5">
                        {clienteLoading
                          ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                        Buscar
                      </button>
                    </div>
                    {clienteFound && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-green-200 bg-green-50">
                        <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-green-600">{clienteFound.nome.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{clienteFound.nome}</p>
                          {clienteFound.cnpj && <p className="text-[10px] text-gray-400 font-mono">{clienteFound.cnpj}</p>}
                        </div>
                        <button type="button" onClick={() => selectCliente(clienteFound)}
                          className="px-2.5 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors shrink-0">
                          Selecionar
                        </button>
                      </div>
                    )}
                    {clienteError && (
                      <p className="text-xs text-red-500 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {clienteError}
                      </p>
                    )}
                    {!clienteFound && !clienteError && (
                      <p className="text-[11px] text-gray-400">Digite o CNPJ e clique em Buscar para consultar o ERP.</p>
                    )}
                  </div>
                )}
              </div>

              {/* CONTATO DA VISITA */}
              <div>
                <SectionLabel>Contato da Visita</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nome</label>
                    <input type="text" value={form.contato_nome}
                      onChange={(e) => setForm((f) => ({ ...f, contato_nome: e.target.value }))}
                      placeholder="Quem vai receber"
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Telefone</label>
                    <input type="tel" value={form.contato_telefone}
                      onChange={(e) => setForm((f) => ({ ...f, contato_telefone: maskPhone(e.target.value) }))}
                      placeholder="(00) 00000-0000"
                      className={inputCls} />
                  </div>
                </div>
              </div>

              {/* AGENDAMENTO */}
              <div>
                <SectionLabel>Agendamento</SectionLabel>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data Agendada</label>
                    <input type="date" value={form.data_agendada}
                      onChange={(e) => setForm((f) => ({ ...f, data_agendada: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Prioridade</label>
                    <select value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))} className={inputCls}>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Responsável pela execução</label>
                  <ResponsavelPicker
                    usuarios={usuarios}
                    value={form.responsavel_id}
                    onChange={(v) => setForm((f) => ({ ...f, responsavel_id: v }))}
                  />
                </div>
              </div>

              {/* OBSERVAÇÕES */}
              <div>
                <SectionLabel>Observações</SectionLabel>
                <textarea value={form.observacoes} rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Informações adicionais sobre a instalação…"
                  className={`${inputCls} resize-none`} />
              </div>
            </div>

            {/* ── Coluna direita: produtos ── */}
            <div className="px-5 py-5 bg-gray-50/50">
              <SectionLabel>
                Produtos{form.tipos.length === 0
                  ? <span className="ml-1 text-red-400 normal-case font-normal tracking-normal"> *</span>
                  : <span className="ml-1.5 bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full normal-case tracking-normal">{totalQty} un.</span>
                }
              </SectionLabel>
              <div className="space-y-2">
                {tiposConfig.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                    <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
                    Carregando produtos…
                  </div>
                ) : tiposConfig.filter((tc) => tc.ativo).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum produto ativo. Configure em Configurações.</p>
                ) : (
                  tiposConfig.filter((tc) => tc.ativo).map((chip) => {
                    const active = form.tipos.includes(chip.tipo);
                    const qty = quantidades[chip.tipo] || 1;
                    const cor = chip.cor || "#6366f1";
                    const chipStyle = active ? {
                      background: cor, borderColor: cor, color: "white", borderWidth: "2px", borderStyle: "solid",
                    } : {
                      background: `${cor}1a`, borderColor: `${cor}66`, color: cor, borderWidth: "2px", borderStyle: "solid",
                    };
                    return (
                      <div key={chip.tipo} onClick={() => toggleTipo(chip.tipo)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-all hover:opacity-90"
                        style={chipStyle}>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active ? "border-white/80 bg-white/20" : "border-current opacity-60"}`}>
                          {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="flex-1 text-sm font-medium">{chip.nome}</span>
                        {active && (
                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={(e) => changeQty(chip.tipo, -1, e)} disabled={qty <= 1}
                              className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/35 disabled:opacity-30 flex items-center justify-center font-bold text-sm leading-none transition-colors">−</button>
                            <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
                            <button type="button" onClick={(e) => changeQty(chip.tipo, +1, e)}
                              className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center font-bold text-sm leading-none transition-colors">+</button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {form.tipos.length > 0 && (
                <div className="mt-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {form.tipos.map((t) => {
                      const chip = tiposConfig.find((c) => c.tipo === t);
                      const cor = chip?.cor || "#6366f1";
                      const nome = chip?.nome || TIPO_LABEL[t] || t;
                      return (
                        <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                          style={{ background: `${cor}1a`, borderColor: `${cor}66`, color: cor }}>
                          {quantidades[t] || 1}× {nome}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {totalQty} un. · {form.tipos.length} tipo{form.tipos.length !== 1 ? "s" : ""}
                    {form.tipos.length > 1 && " · checklists por produto"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || form.tipos.length === 0 || !form.cliente_nome}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {saving ? "Criando…" : `Criar Instalação${totalQty > 1 ? ` (${totalQty} un.)` : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Instalacoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [all, setAll] = useState([]);
  const [tiposConfig, setTiposConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ativas");
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [filtroAtrasadas, setFiltroAtrasadas] = useState(false);
  const [filtroMeus, setFiltroMeus] = useState(false);
  const [filtroSemResponsavel, setFiltroSemResponsavel] = useState(
    () => searchParams.get("sem_responsavel") === "1"
  );

  // Quando vem do dashboard com sem_responsavel=1, força tab "ativas"
  useEffect(() => {
    if (searchParams.get("sem_responsavel") === "1") {
      setTab("ativas");
    }
  }, []);

  const tiposMap = Object.fromEntries(tiposConfig.map((t) => [t.tipo, t]));

  async function load() {
    setLoading(true);
    try {
      const { data } = await instalacaosApi.listar();
      setAll(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    instalacaosApi.tipos().then(({ data }) => setTiposConfig(data)).catch(() => {});
  }, []);

  function getTipos(inst) {
    return inst.tipos?.length > 0 ? inst.tipos : [inst.tipo];
  }

  function isAtrasada(i) {
    if (i.status === "concluida" || i.status === "cancelada" || i.finalizado_em) return false;
    if (!i.data_agendada) return false;
    const agendada = new Date(i.data_agendada + "T00:00:00");
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return agendada < hoje;
  }

  const filtered = all
    .filter((i) => {
      if (tab === "ativas"    && !ATIVAS_STATUSES.includes(i.status))    return false;
      if (tab === "historico" && !HISTORICO_STATUSES.includes(i.status)) return false;
      if (tipoFiltro !== "todos" && !getTipos(i).map(normalizeTipo).includes(tipoFiltro)) return false;
      if (filtroAtrasadas && !isAtrasada(i)) return false;
      if (filtroSemResponsavel && i.responsavel_id) return false;
      if (filtroMeus && i.responsavel_id !== user?.id) return false;
      if (search) {
        const q = search.toLowerCase();
        const nome = (i.cliente_nome || "").toLowerCase();
        const cod = (i.codigo || "").toLowerCase();
        if (!nome.includes(q) && !cod.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (isAtrasada(b) ? 1 : 0) - (isAtrasada(a) ? 1 : 0));

  // Base para KPIs e counts respeita o filtro "Minhas instalações"
  const kpiBase = filtroMeus ? all.filter((i) => i.responsavel_id === user?.id) : all;

  const counts = {
    ativas:    kpiBase.filter((i) => ATIVAS_STATUSES.includes(i.status)).length,
    historico: kpiBase.filter((i) => HISTORICO_STATUSES.includes(i.status)).length,
    todos:     kpiBase.length,
  };

  // KPIs
  const kpiAgendadas  = kpiBase.filter((i) => i.status === "agendada").length;
  const kpiExecucao   = kpiBase.filter((i) => i.status === "em_execucao").length;
  const kpiConcluidas = kpiBase.filter((i) => i.status === "concluida").length;
  const kpiAtrasadas  = kpiBase.filter(isAtrasada).length;

  return (
    <Layout>
      {showModal && (
        <NovaInstalacaoModal
          tiposConfig={tiposConfig}
          onClose={() => setShowModal(false)}
          onCreated={(inst) => {
            setShowModal(false);
            navigate(`/instalacoes/${inst.id}`);
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Instalações</h1>
          <p className="text-sm text-gray-400 mt-0.5">PDVs adicionais, coletores, força de vendas e mais</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova Instalação
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Agendadas",   value: kpiAgendadas,  color: "text-blue-600",   bg: "bg-blue-50",   icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", tab: "ativas" },
          { label: "Em Execução", value: kpiExecucao,   color: "text-orange-600", bg: "bg-orange-50", icon: "M13 10V3L4 14h7v7l9-11h-7z", tab: "ativas" },
          { label: "Concluídas",  value: kpiConcluidas, color: "text-green-600",  bg: "bg-green-50",  icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", tab: "historico" },
          { label: "Atrasadas",   value: kpiAtrasadas,  color: "text-red-600",    bg: filtroAtrasadas ? "bg-red-200" : "bg-red-50",    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", tab: null, atrasadas: true },
        ].map((k) => (
          <button
            key={k.label}
            onClick={() => {
              if (k.atrasadas) { setFiltroAtrasadas((v) => !v); setTab("todos"); }
              else if (k.tab) { setTab(k.tab); setFiltroAtrasadas(false); }
            }}
            className={`${k.bg} rounded-xl p-4 text-left transition-all hover:shadow-sm cursor-pointer ${k.atrasadas && kpiAtrasadas > 0 ? "ring-2 ring-red-300" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">{k.label}</span>
              <svg className={`w-4 h-4 ${k.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={k.icon} />
              </svg>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center gap-1 px-4 pt-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap mb-1 ${
                tab === t.key ? "bg-orange-50 text-orange-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                tab === t.key ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"
              }`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
        {/* Legenda das cores laterais */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-50 flex-wrap">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">Legenda:</span>
          {[
            { color: "bg-blue-400",   label: "Agendada" },
            { color: "bg-orange-400", label: "Em Execução" },
            { color: "bg-green-500",  label: "Concluída" },
            { color: "bg-gray-300",   label: "Cancelada" },
            { color: "bg-red-500",    label: "Atrasada" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />
              <span className="text-[11px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 pb-3 pt-2 border-t border-gray-50">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente ou código…"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 transition"
            />
          </div>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-400 transition text-gray-600"
          >
            <option value="todos">Todos os tipos</option>
            {tiposConfig.length > 0
              ? tiposConfig.map((t) => <option key={t.tipo} value={t.tipo}>{t.nome}</option>)
              : Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)
            }
          </select>

          <button
            onClick={() => setFiltroMeus((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${
              filtroMeus
                ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-500"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Minhas instalações
            {filtroMeus && (
              <span className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-white/25 text-[10px] font-bold">
                {filtered.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Chip: filtro sem responsável ativo */}
      {filtroSemResponsavel && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Sem responsável
            <button
              onClick={() => { setFiltroSemResponsavel(false); setSearchParams({}); }}
              className="ml-1 hover:text-orange-900 transition-colors"
            >✕</button>
          </span>
          <span className="text-xs text-gray-400">{filtered.length} instalaç{filtered.length !== 1 ? "ões" : "ão"} encontrada{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">Nenhuma instalação encontrada.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <th className="p-0 w-1" />
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 w-40">Progresso</th>
                <th className="text-left px-4 py-3">Responsável</th>
                <th className="text-left px-4 py-3">Agendado</th>
                <th className="text-left px-4 py-3">Concluído</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((inst) => {
                const agendado = dataRelativa(inst.data_agendada);
                const atrasada = isAtrasada(inst);
                const concluida = inst.status === "concluida";
                const accentColor = atrasada ? "bg-red-500" : (STATUS_ACCENT[inst.status] || "bg-gray-200");
                const rowBg = atrasada
                  ? "bg-red-50/50 hover:bg-red-50"
                  : concluida
                  ? "bg-green-50/30 hover:bg-green-50/60"
                  : "hover:bg-orange-50/40";
                return (
                  <tr
                    key={inst.id}
                    onClick={() => navigate(`/instalacoes/${inst.id}`)}
                    className={`cursor-pointer transition-colors group border-b border-gray-100 last:border-0 ${rowBg}`}
                  >
                    {/* Acento lateral colorido por status */}
                    <td className={`p-0 ${accentColor}`} style={{ width: "4px", minWidth: "4px" }} />

                    {/* Cliente */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 leading-tight">{inst.cliente_nome || "—"}</span>
                        {atrasada && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse shrink-0" />
                            ATRASADA
                          </span>
                        )}
                        {inst.prioridade !== "normal" && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORIDADE_COLOR[inst.prioridade]}`}>
                            {inst.prioridade === "urgente" ? "URGENTE" : "ALTA"}
                          </span>
                        )}
                        {inst.quantidade > 1 && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">×{inst.quantidade}</span>
                        )}
                      </div>
                      {/* Código + CNPJ na linha secundária */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{inst.codigo}</span>
                        {inst.cliente_cnpj && (
                          <span className="text-[11px] text-gray-400">{inst.cliente_cnpj}</span>
                        )}
                      </div>
                    </td>

                    {/* Tipo */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {getTipos(inst).map((t) => {
                          const td = tiposMap[normalizeTipo(t)];
                          const cor = td?.cor;
                          return (
                            <span key={t}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cor ? "" : (TIPO_COLOR[t] || "bg-gray-100 text-gray-600")}`}
                              style={cor ? { background: `${cor}22`, color: cor } : undefined}>
                              {td?.nome || TIPO_LABEL[t] || t}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[inst.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          inst.status === "concluida"   ? "bg-green-500" :
                          inst.status === "em_execucao" ? "bg-orange-500" :
                          inst.status === "agendada"    ? "bg-blue-500" : "bg-gray-400"
                        }`} />
                        {STATUS_LABEL[inst.status] || inst.status}
                      </span>
                    </td>

                    {/* Progresso */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1">
                          <ProgBar value={inst.progresso} />
                        </div>
                        <span className={`text-xs font-semibold w-9 text-right shrink-0 tabular-nums ${
                          inst.progresso === 100 ? "text-green-600" : "text-gray-400"
                        }`}>
                          {inst.progresso}%
                        </span>
                      </div>
                    </td>

                    {/* Responsável com avatar */}
                    <td className="px-4 py-4">
                      {inst.responsavel_nome ? (
                        <div className="flex items-center gap-2">
                          <Avatar nome={inst.responsavel_nome} avatarUrl={inst.responsavel_avatar_url} />
                          <span className="text-sm text-gray-600 truncate max-w-[120px]">{inst.responsavel_nome}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>

                    {/* Agendado */}
                    <td className="px-4 py-4">
                      {agendado ? (
                        <span className={`text-xs font-medium ${agendado.cls}`}>{agendado.label}</span>
                      ) : inst.data_agendada ? (
                        <span className="text-xs text-gray-500">{fmtDateOnly(inst.data_agendada)}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Concluído */}
                    <td className="px-4 py-4">
                      {inst.data_conclusao ? (
                        <span className="text-xs font-medium text-green-700">{fmtDateOnly(inst.data_conclusao)}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Seta */}
                    <td className="px-4 py-4">
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
