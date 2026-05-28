import { useState, useEffect, useRef } from "react";
import { Layout } from "../components/layout/Layout";
import { configuracoesApi, instalacaosApi, templatesApi } from "../services/api";
import { fmtDateTime } from "../utils/dateUtils";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconDatabase() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path strokeLinecap="round" d="M3 5v5c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
      <path strokeLinecap="round" d="M3 10v5c0 1.657 4.03 3 9 3s9-1.343 9-3v-5" />
    </svg>
  );
}

function IconEmail() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

const formatDate = fmtDateTime;

// ── Layout primitives ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-6 pb-5 border-b border-gray-100">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldGroup({ label }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
  );
}

function InfoField({ label, value, mono = false, highlight = false }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${mono ? "font-mono" : ""} ${highlight ? "text-indigo-600" : "text-gray-800"}`}>
        {value || <span className="text-gray-300 font-normal">—</span>}
      </p>
    </div>
  );
}

function Alert({ type, children }) {
  const styles = {
    error:   "text-red-700 bg-red-50 border-red-200",
    success: "text-green-700 bg-green-50 border-green-200",
    warning: "text-amber-700 bg-amber-50 border-amber-200",
  };
  return (
    <div className={`flex items-start gap-2 text-xs border rounded-lg px-3 py-2.5 ${styles[type]}`}>
      {type === "success" && <IconCheck />}
      <span>{children}</span>
    </div>
  );
}

const LBL = "block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1";
const INP = "input-field text-sm w-full";

// ── Base Zerada ───────────────────────────────────────────────────────────────

function BaseZeradaSection() {
  const [info, setInfo]           = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [dragOver, setDragOver]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [versao, setVersao]       = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess]     = useState(null);
  const [error, setError]         = useState(null);
  const inputRef = useRef(null);

  function fetchInfo() {
    setLoadingInfo(true);
    configuracoesApi.infoBase()
      .then(({ data }) => setInfo(data))
      .catch(() => setInfo({ exists: false }))
      .finally(() => setLoadingInfo(false));
  }

  useEffect(() => { fetchInfo(); }, []);

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }

  function pickFile(file) {
    setSuccess(null); setError(null);
    if (!file.name.toLowerCase().endsWith(".sql")) {
      setError("Selecione um arquivo .sql"); return;
    }
    setSelected(file);
  }

  async function handleUpload() {
    if (!selected) return;
    setUploading(true); setError(null); setSuccess(null);
    try {
      const { data } = await configuracoesApi.uploadBase(selected, versao);
      setSuccess(data); setSelected(null); setVersao(""); fetchInfo();
    } catch (err) {
      setError(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <SectionHeader
        icon={<IconDatabase />}
        title="Base Zerada do Sistema"
        subtitle="Arquivo SQL executado na instalação de cada cliente. Mantenha sempre atualizado com a última versão liberada."
      />

      {/* Arquivo atual */}
      <div className="mb-6">
        <FieldGroup label="Arquivo atual" />
        {loadingInfo ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
            Carregando…
          </div>
        ) : info?.exists ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <InfoField label="Arquivo"             value="base_zerada.sql" mono />
            <InfoField label="Tamanho"             value={formatBytes(info.size)} />
            <InfoField label="Última atualização"  value={formatDate(info.updated_at)} />
            <InfoField label="Versão SIA"          value={info.versao ? `v${info.versao}` : null} highlight={!!info.versao} />
          </div>
        ) : (
          <Alert type="warning">Nenhum arquivo encontrado. Faça o upload abaixo.</Alert>
        )}
      </div>

      <div className="h-px bg-gray-100 mb-6" />

      {/* Upload */}
      <FieldGroup label={info?.exists ? "Substituir arquivo" : "Enviar arquivo"} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !selected && inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          dragOver  ? "border-indigo-400 bg-indigo-50/60"
          : selected ? "border-indigo-300 bg-indigo-50/30 cursor-default"
          : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50/60"
        }`}
      >
        <input ref={inputRef} type="file" accept=".sql" className="hidden"
          onChange={(e) => { if (e.target.files[0]) pickFile(e.target.files[0]); }} />

        {selected ? (
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{selected.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(selected.size)}</p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setSelected(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors shrink-0">
              Trocar
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <span className="text-gray-300 mb-3"><IconUpload /></span>
            <p className="text-sm font-medium text-gray-600">
              Arraste o arquivo aqui ou{" "}
              <span className="text-indigo-600 font-semibold">clique para selecionar</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Somente arquivos .sql</p>
          </div>
        )}
      </div>

      {selected && !success && (
        <div className="mt-4">
          <label className={LBL}>Versão SIA</label>
          <div className="flex items-center gap-3">
            <div className="relative max-w-[240px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none pointer-events-none">v</span>
              <input type="text" value={versao} onChange={(e) => setVersao(e.target.value)}
                placeholder="Ex: 117, 118.2, 2.5.1" className="input-field pl-7 text-sm w-full" />
            </div>
            <p className="text-xs text-gray-400">Informe a versão para controle</p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {error   && <Alert type="error">{error}</Alert>}
        {success && (
          <Alert type="success">
            <span><span className="font-semibold">base_zerada.sql</span> atualizado com sucesso — {formatBytes(success.size)} em {formatDate(success.updated_at)}{success.versao && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">v{success.versao}</span>}</span>
          </Alert>
        )}
      </div>

      {selected && !success && (
        <div className="mt-4 flex justify-end">
          <button onClick={handleUpload} disabled={uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {uploading
              ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            }
            {uploading ? "Enviando…" : "Enviar novo arquivo"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Email SMTP ────────────────────────────────────────────────────────────────

function EmailSection() {
  const BLANK = { host: "", port: 587, user: "", password: "", from_email: "", from_name: "CriareCRM", use_tls: true, frontend_url: "" };
  const [form, setForm]     = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");

  useEffect(() => {
    configuracoesApi.getEmail()
      .then(({ data }) => setForm((f) => ({ ...BLANK, ...data })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
    setSuccess(""); setError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSuccess(""); setError("");
    try {
      await configuracoesApi.saveEmail(form);
      setSuccess("Configuração salva com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestar() {
    setTesting(true); setSuccess(""); setError("");
    try {
      const { data } = await configuracoesApi.testarEmail({ ...form, test_email: testEmail || undefined });
      setSuccess(data.message);
    } catch (err) {
      setError(err.message || "Falha no envio do email de teste.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <SectionHeader
        icon={<IconEmail />}
        title="Configuração de Email (SMTP)"
        subtitle="Necessário para enviar o link de revisão ao cliente quando uma triagem for recusada."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
          Carregando…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">

          {/* Servidor SMTP */}
          <div>
            <FieldGroup label="Servidor SMTP" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={LBL}>Host</label>
                <input className={INP} placeholder="smtp.gmail.com"
                  value={form.host} onChange={(e) => set("host", e.target.value)} />
              </div>
              <div>
                <label className={LBL}>Porta</label>
                <input className={INP} type="number" placeholder="587"
                  value={form.port} onChange={(e) => set("port", Number(e.target.value))} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input type="checkbox" id="use_tls" checked={form.use_tls}
                onChange={(e) => set("use_tls", e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer" />
              <label htmlFor="use_tls" className="text-sm text-gray-600 cursor-pointer select-none">
                Usar TLS (STARTTLS na porta 587) — desmarque para SSL na porta 465
              </label>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Autenticação */}
          <div>
            <FieldGroup label="Autenticação" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LBL}>Usuário (email de login)</label>
                <input className={INP} placeholder="usuario@gmail.com"
                  value={form.user} onChange={(e) => set("user", e.target.value)} />
              </div>
              <div>
                <label className={LBL}>Senha / App Password</label>
                <input className={INP} type="password" placeholder="••••••••"
                  value={form.password} onChange={(e) => set("password", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Remetente */}
          <div>
            <FieldGroup label="Remetente e URL do sistema" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LBL}>Nome do remetente</label>
                <input className={INP} placeholder="CriareCRM"
                  value={form.from_name} onChange={(e) => set("from_name", e.target.value)} />
              </div>
              <div>
                <label className={LBL}>Email do remetente</label>
                <input className={INP} type="email" placeholder="noreply@suaempresa.com"
                  value={form.from_email} onChange={(e) => set("from_email", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={LBL}>URL pública do sistema</label>
                <input className={INP} placeholder="https://crm.suaempresa.com"
                  value={form.frontend_url} onChange={(e) => set("frontend_url", e.target.value)} />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Link enviado ao cliente:{" "}
                  <span className="font-mono text-gray-500">
                    {form.frontend_url || "http://localhost:5173"}/revisao/TOKEN
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Feedback */}
          {(error || success) && (
            <Alert type={error ? "error" : "success"}>{error || success}</Alert>
          )}

          {/* Ações */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {saving ? "Salvando…" : "Salvar configuração"}
            </button>

            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <input className="input-field text-sm flex-1" type="email"
                placeholder="Email para teste"
                value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              <button type="button" onClick={handleTestar} disabled={testing || !form.host}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                {testing ? "Enviando…" : "Enviar teste"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Produtos de Instalação ────────────────────────────────────────────────────

function IconProducts() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V11" />
    </svg>
  );
}

function toSlug(nome) {
  return nome.toLowerCase()
    .normalize("NFD").replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function ProdutosInstalacaoSection() {
  const [produtos, setProdutos]   = useState([]);
  const [todosTemplates, setTodosTemplates] = useState([]); // templates de instalação para o dropdown
  const [loading, setLoading]     = useState(true);
  const [savingId, setSavingId]   = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [newNome, setNewNome]   = useState("");
  const [newCor, setNewCor]     = useState("#6366f1");
  const [saving, setSaving]     = useState(false);
  const [edits, setEdits]       = useState({});

  async function load() {
    setLoading(true);
    try {
      const [{ data: prods }, { data: tmpl }] = await Promise.all([
        instalacaosApi.tipos(),
        templatesApi.listar(),
      ]);
      setProdutos(prods);
      setTodosTemplates(tmpl.filter((t) => t.tipo?.startsWith("instalacao_")));
    } catch {
      setError("Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleAtivo(p) {
    setSavingId(p.id);
    setError("");
    try {
      await templatesApi.atualizar(p.id, { ativo: !p.ativo });
      setProdutos((prev) => prev.map((x) => x.id === p.id ? { ...x, ativo: !x.ativo } : x));
    } catch (err) {
      setError(err.message || "Erro ao atualizar.");
    } finally {
      setSavingId(null);
    }
  }

  async function saveEdit(p) {
    const edit = edits[p.id] || {};
    const nome = edit.nome !== undefined ? edit.nome : p.nome;
    const cor  = edit.cor  !== undefined ? edit.cor  : p.cor;
    const templateId = edit.checklist_template_id !== undefined
      ? edit.checklist_template_id
      : p.checklist_template_id;
    setSavingId(p.id);
    setError("");
    try {
      if (nome !== p.nome) await templatesApi.atualizar(p.id, { nome_produto: nome });
      if (cor !== p.cor) {
        const { data: full } = await templatesApi.obter(p.id);
        if (full.etapas.length > 0) {
          await templatesApi.atualizarEtapa(full.etapas[0].id, { cor });
        } else {
          await templatesApi.adicionarEtapa(p.id, { nome: "Principal", ordem: 1, sla_dias: 7, cor });
        }
      }
      if (templateId !== p.checklist_template_id) {
        await templatesApi.atualizar(p.id, { checklist_template_id: templateId || null });
      }
      setProdutos((prev) => prev.map((x) =>
        x.id === p.id ? { ...x, nome, cor, checklist_template_id: templateId || null } : x
      ));
      setEdits((e) => { const c = { ...e }; delete c[p.id]; return c; });
    } catch (err) {
      setError(err.message || "Erro ao salvar.");
    } finally {
      setSavingId(null);
    }
  }

  async function deletar(p) {
    if (!confirm(`Remover "${p.nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(p.id);
    setError("");
    try {
      await templatesApi.deletar(p.id);
      setProdutos((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err.message || "Erro ao remover.");
    } finally {
      setDeletingId(null);
    }
  }

  const TAREFAS_PADRAO = [
    "Levantamento de requisitos",
    "Instalação e configuração",
    "Testes e validação",
    "Aprovação do cliente",
  ];

  async function handleCreate(e) {
    e.preventDefault();
    if (!newNome.trim()) return;
    setSaving(true);
    setError("");
    try {
      const tipo = `instalacao_${toSlug(newNome.trim())}`;
      const { data: created } = await templatesApi.criar({ nome: newNome.trim(), nome_produto: newNome.trim(), tipo, ativo: true });
      const { data: etapa } = await templatesApi.adicionarEtapa(created.id, {
        nome: "Checklist de Instalação", ordem: 1, sla_dias: 7, cor: newCor,
      });
      for (let i = 0; i < TAREFAS_PADRAO.length; i++) {
        await templatesApi.adicionarTarefa(etapa.id, {
          titulo: TAREFAS_PADRAO[i], obrigatoria: true, ordem: i + 1,
        });
      }
      setNewNome(""); setNewCor("#6366f1"); setCreating(false);
      await load();
      setSuccess(`Produto "${created.nome}" criado com sucesso com ${TAREFAS_PADRAO.length} tarefas padrão.`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Erro ao criar produto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        icon={<IconProducts />}
        title="Produtos de Instalação"
        subtitle="Gerencie os tipos de produto disponíveis ao criar instalações. Edite o nome, a cor e ative ou desative cada produto. O checklist detalhado é configurado em Templates."
      />

      {(error || success) && (
        <div className="mb-4">
          <Alert type={error ? "error" : "success"}>{error || success}</Alert>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
          Carregando…
        </div>
      ) : (
        <div className="space-y-2">
          {produtos.map((p) => {
            const edit = edits[p.id] || {};
            const nomeCur = edit.nome !== undefined ? edit.nome : p.nome;
            const corCur  = edit.cor  !== undefined ? edit.cor  : p.cor;
            const dirty   = edit.nome !== undefined || edit.cor !== undefined || edit.checklist_template_id !== undefined;
            const isSaving = savingId === p.id;
            const templateCur = edit.checklist_template_id !== undefined
              ? edit.checklist_template_id
              : (p.checklist_template_id ?? "");
            const templateSelecionado = todosTemplates.find((t) => t.id === templateCur);

            return (
              <div key={p.id} className={`flex flex-col gap-2 px-4 py-3 rounded-xl border transition-all ${dirty ? "border-indigo-200 bg-indigo-50/30" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                {/* Main row */}
                <div className="flex items-center gap-3">
                  {/* Color picker */}
                  <div className="relative shrink-0 w-7 h-7">
                    <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm overflow-hidden" style={{ background: corCur }}>
                      <input type="color" value={corCur} title="Alterar cor"
                        onChange={(e) => setEdits((ed) => ({ ...ed, [p.id]: { ...(ed[p.id] || {}), cor: e.target.value } }))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>

                  {/* Nome inline edit */}
                  <input type="text" value={nomeCur}
                    onChange={(e) => setEdits((ed) => ({ ...ed, [p.id]: { ...(ed[p.id] || {}), nome: e.target.value } }))}
                    className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none px-1 py-0.5 transition-colors min-w-0" />

                  {/* Task count */}
                  <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">{p.n_tarefas} tarefa{p.n_tarefas !== 1 ? "s" : ""}</span>

                  {/* Ativo toggle */}
                  <button type="button" onClick={() => toggleAtivo(p)} disabled={isSaving}
                    title={p.ativo ? "Ativo — clique para desativar" : "Inativo — clique para ativar"}
                    className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${p.ativo ? "bg-green-400" : "bg-gray-200"} disabled:opacity-50`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${p.ativo ? "left-[18px]" : "left-0.5"}`} />
                  </button>

                  {dirty ? (
                    <>
                      <button type="button" onClick={() => saveEdit(p)} disabled={isSaving}
                        className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors disabled:opacity-50 shrink-0">
                        {isSaving ? "…" : "Salvar"}
                      </button>
                      <button type="button" onClick={() => setEdits((ed) => { const c = { ...ed }; delete c[p.id]; return c; })}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => deletar(p)} disabled={deletingId === p.id}
                      title="Remover produto"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50">
                      {deletingId === p.id
                        ? <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
                        : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      }
                    </button>
                  )}
                </div>

                {/* Template selector row */}
                <div className="flex items-center gap-2 pl-10">
                  <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">Template checklist:</span>
                  <select
                    value={templateCur}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setEdits((ed) => ({ ...ed, [p.id]: { ...(ed[p.id] || {}), checklist_template_id: val } }));
                    }}
                    className="text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-indigo-400 flex-1 max-w-xs">
                    <option value="">Usar próprio template</option>
                    {todosTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                  {templateSelecionado && (
                    <span className="text-[11px] text-indigo-500 shrink-0">✓ vinculado</span>
                  )}
                </div>
              </div>
            );
          })}

          {produtos.length === 0 && (
            <div className="text-sm text-gray-400 text-center py-8">Nenhum produto cadastrado. Adicione o primeiro abaixo.</div>
          )}

          {/* Create row */}
          {creating ? (
            <form onSubmit={handleCreate} className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/20">
              <div className="relative shrink-0 w-7 h-7">
                <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm overflow-hidden" style={{ background: newCor }}>
                  <input type="color" value={newCor} onChange={(e) => setNewCor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
              </div>
              <input type="text" value={newNome} onChange={(e) => setNewNome(e.target.value)}
                placeholder="Nome do produto…" autoFocus
                className="flex-1 text-sm text-gray-800 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-500 px-1 py-0.5 min-w-0" />
              <button type="submit" disabled={saving || !newNome.trim()}
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors disabled:opacity-50 shrink-0">
                {saving ? "Criando…" : "Criar"}
              </button>
              <button type="button" onClick={() => { setCreating(false); setNewNome(""); setNewCor("#6366f1"); }}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
                Cancelar
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/20 transition-all text-sm font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Adicionar produto
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Integração ERP ────────────────────────────────────────────────────────────

function IconErp() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ErpSection() {
  const BLANK = { base_url: "", api_token: "", timeout: 10 };
  const [form, setForm]       = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");

  useEffect(() => {
    configuracoesApi.getErp()
      .then(({ data }) => setForm({ ...BLANK, ...data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
    setSuccess(""); setError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.base_url.trim()) { setError("Informe a URL base do ERP."); return; }
    setSaving(true); setSuccess(""); setError("");
    try {
      await configuracoesApi.saveErp(form);
      setSuccess("Configuração salva com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestar() {
    if (!form.base_url.trim()) { setError("Informe a URL base antes de testar."); return; }
    setTesting(true); setSuccess(""); setError("");
    try {
      const { data } = await configuracoesApi.testarErp(form);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message || "Falha ao conectar ao ERP.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <SectionHeader
        icon={<IconErp />}
        title="Integração ERP — Consulta de Clientes"
        subtitle="Os clientes listados no módulo de Instalações são buscados diretamente do ERP via API. Configure a URL e o token de acesso abaixo."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
          Carregando…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">

          {/* Endpoint info */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Endpoint consultado</p>
            <p className="text-sm font-mono text-gray-700 break-all">
              <span className="text-gray-400">{form.base_url || "<URL base>"}</span>
              <span className="text-indigo-600">/api/gerente/v2/CheckClient</span>
            </p>
          </div>

          {/* Conexão */}
          <div>
            <FieldGroup label="Conexão" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={LBL}>URL base do ERP *</label>
                <input
                  className={INP}
                  placeholder="http://criaresuporte1.no-ip.info:9000"
                  value={form.base_url}
                  onChange={(e) => set("base_url", e.target.value)}
                />
                <p className="text-[11px] text-gray-400 mt-1">Sem barra no final</p>
              </div>
              <div>
                <label className={LBL}>Timeout (segundos)</label>
                <input
                  className={INP}
                  type="number"
                  min={3} max={60}
                  value={form.timeout}
                  onChange={(e) => set("timeout", Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Autenticação */}
          <div>
            <FieldGroup label="Autenticação" />
            <div>
              <label className={LBL}>Token de acesso (Bearer)</label>
              <input
                className={INP}
                type="password"
                placeholder="Deixe em branco se a API não exige autenticação"
                value={form.api_token}
                onChange={(e) => set("api_token", e.target.value)}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Enviado como <span className="font-mono">Authorization: Bearer &lt;token&gt;</span>
              </p>
            </div>
          </div>

          {/* Feedback */}
          {(error || success) && (
            <Alert type={error ? "error" : "success"}>{error || success}</Alert>
          )}

          {/* Ações */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {saving ? "Salvando…" : "Salvar configuração"}
            </button>
            <button type="button" onClick={handleTestar} disabled={testing || saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {testing
                ? <span className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
              }
              {testing ? "Testando…" : "Testar conexão"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Sidebar nav config ────────────────────────────────────────────────────────

const NAV = [
  {
    group: "Sistema",
    items: [
      { key: "base",  label: "Base Zerada",   icon: <IconDatabase />, desc: "Arquivo SQL de instalação" },
    ],
  },
  {
    group: "Notificações",
    items: [
      { key: "email", label: "Email (SMTP)",  icon: <IconEmail />,    desc: "Configuração do servidor de e-mail" },
    ],
  },
  {
    group: "Instalações",
    items: [
      { key: "produtos", label: "Produtos",   icon: <IconProducts />, desc: "Tipos de produto para instalações" },
    ],
  },
  {
    group: "Integrações",
    items: [
      { key: "erp", label: "Integração ERP", icon: <IconErp />, desc: "Consulta de clientes via API externa" },
    ],
  },
];

const SECTIONS = {
  base:     <BaseZeradaSection />,
  email:    <EmailSection />,
  produtos: <ProdutosInstalacaoSection />,
  erp:      <ErpSection />,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Configuracoes() {
  const [active, setActive] = useState("base");

  return (
    <Layout>
      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gerencie os parâmetros e integrações do sistema</p>
      </div>

      <div className="flex gap-6 items-start">

        {/* ── Sidebar nav ── */}
        <nav className="w-52 shrink-0">
          {NAV.map(({ group, items }) => (
            <div key={group} className="mb-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-1">
                {group}
              </p>
              {items.map((item) => {
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActive(item.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    }`}
                  >
                    <span className={`shrink-0 transition-colors ${isActive ? "text-indigo-500" : "text-gray-400"}`}>
                      {item.icon}
                    </span>
                    <span className={`text-sm font-medium ${isActive ? "text-indigo-700" : ""}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Content panel ── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {SECTIONS[active]}
        </div>

      </div>
    </Layout>
  );
}
