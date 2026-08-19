import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { Badge } from "../components/ui/Badge";
import { implantacoesApi } from "../services/api";
import { ImplantacaoEditForm } from "../components/implantacoes/EditPanel";
import { fmtDate, fmtDateTime } from "../utils/dateUtils";
import i18n from "../i18n";

// Cidade chega em CAIXA ALTA do cadastro — normaliza pra não competir
// visualmente com o CNPJ (que é mono/minúsculo) na mesma linha do card.
function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/(^|[\s/-])\S/g, (c) => c.toUpperCase());
}

// Contagem de progresso por item-folha — portado de ImplantacaoDetalhe.jsx pra
// bater exatamente com o número mostrado na tela completa da mesma implantação
// (tarefa com subitens conta os subitens, não a tarefa-pai, senão conta dobrado).
function buildSubsIndex(checklist) {
  const idx = {};
  for (const item of checklist || []) {
    if (item.parent_id) {
      (idx[item.parent_id] = idx[item.parent_id] || []).push(item);
    }
  }
  return idx;
}

function leafProgress(rootItems, subsIndex) {
  let total = 0, done = 0;
  for (const item of rootItems || []) {
    if (item.arquivado) continue;
    const subs = (subsIndex && subsIndex[item.id]) || item.subitens || [];
    const activeSubs = subs.filter((s) => !s.arquivado && s.status !== "nao_aplicavel");
    if (activeSubs.length > 0) {
      total += activeSubs.length;
      done  += activeSubs.filter((s) => s.status === "concluido").length;
    } else if (item.status !== "nao_aplicavel") {
      total += 1;
      if (item.status === "concluido") done += 1;
    }
  }
  return { total, done };
}

// Mesma seleção de item-folha do leafProgress, mas devolvendo os itens pendentes
// em si (com o nome da etapa) em vez de só a contagem — usado pra listar "o que
// falta" na aba Atividades, sem precisar abrir o Kanban.
function pendingLeafItems(etapas, subsIndex) {
  const result = [];
  for (const e of etapas || []) {
    for (const item of e.itens || []) {
      if (item.arquivado) continue;
      const subs = (subsIndex && subsIndex[item.id]) || item.subitens || [];
      const activeSubs = subs.filter((s) => !s.arquivado && s.status !== "nao_aplicavel");
      if (activeSubs.length > 0) {
        for (const s of activeSubs) {
          if (s.status !== "concluido") result.push({ ...s, etapaNome: e.nome });
        }
      } else if (item.status !== "nao_aplicavel" && item.status !== "concluido") {
        result.push({ ...item, etapaNome: e.nome });
      }
    }
  }
  return result;
}

function slaRelativo(impl) {
  if (impl.status === "concluida" || impl.status === "cancelada") {
    return { label: fmtDate(impl.sla_limite), level: "done" };
  }
  if (!impl.sla_limite) return null;
  // Parse as local date (YYYY-MM-DD) to avoid UTC-offset shifting the day count
  const [y, mo, dy] = impl.sla_limite.split("-").map(Number);
  const slaLocal = new Date(y, mo - 1, dy);
  const todayLocal = new Date(); todayLocal.setHours(0, 0, 0, 0);
  const d = Math.round((slaLocal - todayLocal) / 86400000);
  if (d < 0)  return { label: i18n.t("implantacoes:slaRelativo.overdue", { count: -d }), level: "expired" };
  if (d === 0) return { label: i18n.t("implantacoes:slaRelativo.dueToday"), level: "urgent" };
  if (d === 1) return { label: i18n.t("implantacoes:slaRelativo.tomorrow"), level: "warning" };
  return             { label: i18n.t("implantacoes:slaRelativo.daysLeft", { count: d }), level: "ok" };
}

const SLA_PILL = {
  expired: "text-red-600   bg-red-50   border-red-200",
  urgent:  "text-amber-700 bg-amber-50 border-amber-200",
  warning: "text-yellow-700 bg-yellow-50 border-yellow-200",
  ok:      "text-green-700 bg-green-50 border-green-100",
};

// Categoria exclusiva usada só pra agrupar no Kanban (uma implantação só pode
// morar numa coluna). Prioridade: Concluída > SLA Vencido > Com Conversão > Em
// Andamento — decisão de produto que pode ser ajustada depois. Nas abas/KPIs do
// topo, cada contagem continua independente (uma implantação pode contar em
// mais de um KPI ao mesmo tempo, exatamente como já era antes).
const REGIME_KEYS = {
  "1": "simples", simples_nacional: "simples",
  "2": "presumido", lucro_presumido: "presumido",
  "3": "real", lucro_real: "real",
};

// Regime tributário chega como código cru do cadastro do cliente (histórico
// mistura "1"/"2"/"3" com slugs tipo "simples_nacional") — normaliza pro rótulo
// compacto certo, com fallback pro valor cru se não reconhecer.
function regimeLabel(t, code) {
  const key = REGIME_KEYS[code];
  return key ? t(`regime.${key}`) : code;
}

function getCategoria(impl) {
  if (impl.status === "concluida") return "concluida";
  if (isSlaVencido(impl)) return "sla_vencido";
  if (impl.conversao_dados) return "conversao";
  return "em_andamento";
}

// SLA vencido só faz sentido pra quem ainda está sendo monitorado — uma vez
// concluída/cancelada, não há mais prazo a acompanhar. O backend já deveria
// nunca persistir "atrasada" fora do status ativo, mas confere aqui também
// pra não depender só disso.
function isSlaVencido(impl) {
  return impl.sla_status === "atrasada" && (impl.status === "em_andamento" || impl.status === "pausada");
}

function UserAvatar({ nome, avatarUrl, size = "md" }) {
  const dim = size === "sm" ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]";
  const initials = nome
    ? nome.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  if (avatarUrl) {
    return <img src={avatarUrl} alt={nome} className={`${dim} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

// Sparkline decorativo — NÃO representa dado histórico real (o sistema ainda não
// guarda série temporal desses números). Serve só pra compor o visual do card
// enquanto não existe uma fonte de dado de verdade pra alimentar isso.
function Sparkline({ seed = 0, color = "#f97316" }) {
  const points = [4, 7, 5, 9, 6, 10, 8, 12].map((v, i) => {
    const jitter = ((seed + i) * 37) % 5;
    return [i * 10, 22 - (v + jitter)];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return (
    <svg width="70" height="24" viewBox="0 0 70 24" className="shrink-0" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

function KpiCard({ icon, label, value, sub, accent, active, onClick }) {
  const palettes = {
    orange: { icon: "bg-orange-100 text-orange-600", val: "text-gray-900", sub: "text-orange-500", spark: "#f97316" },
    red:    { icon: "bg-red-100 text-red-600",       val: "text-gray-900", sub: "text-red-500",    spark: "#ef4444" },
    blue:   { icon: "bg-blue-100 text-blue-600",     val: "text-gray-900", sub: "text-blue-500",   spark: "#3b82f6" },
    green:  { icon: "bg-green-100 text-green-600",   val: "text-gray-900", sub: "text-green-500",  spark: "#22c55e" },
    gray:   { icon: "bg-gray-100 text-gray-500",     val: "text-gray-900", sub: "text-gray-400",   spark: "#9ca3af" },
  };
  const p = palettes[accent] || palettes.gray;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border bg-white px-4 py-3.5 flex items-center justify-between gap-3 transition-shadow ${
        active ? "border-orange-300 shadow-sm ring-1 ring-orange-100" : "border-gray-100 hover:shadow-sm"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${p.icon}`}>
            {icon}
          </div>
          <span className={`text-2xl font-bold leading-none ${p.val}`}>{value}</span>
        </div>
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        {sub && <p className={`text-[10px] mt-0.5 ${p.sub}`}>{sub}</p>}
      </div>
      <Sparkline seed={value} color={p.spark} />
    </button>
  );
}

function PrioridadePill({ prioridade }) {
  const { t } = useTranslation("implantacoes");
  const cfg = {
    baixa:   "bg-gray-100 text-gray-500",
    alta:    "bg-orange-100 text-orange-700",
    critica: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg[prioridade] || "bg-gray-100 text-gray-500"}`}>
      {cfg[prioridade] ? t(`prio.${prioridade}`) : prioridade}
    </span>
  );
}

function ProgressBar({ value, status }) {
  const color =
    status === "concluida" ? "bg-green-500" :
    status === "cancelada" ? "bg-gray-300"  :
    value >= 80            ? "bg-blue-500"  :
    value >= 40            ? "bg-orange-400": "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs w-8 text-right shrink-0 font-medium ${value > 0 ? "text-gray-700" : "text-gray-300"}`}>
        {value}%
      </span>
    </div>
  );
}

function ContextBanner({ filterSla, filterHighlight, count, onClear }) {
  const { t } = useTranslation("implantacoes");
  if (filterSla === "atrasada") return (
    <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
      <span className="text-lg shrink-0 mt-0.5">🚨</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-red-800">
          {t("contextBanner.overdueTitle", { count })}
        </p>
        <p className="text-xs text-red-600 mt-0.5">
          {t("contextBanner.overdueDesc")}
        </p>
      </div>
      <button onClick={onClear} className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap">
        {t("common.clear")}
      </button>
    </div>
  );
  if (filterSla === "critico") return (
    <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
      <span className="text-lg shrink-0 mt-0.5">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-800">
          {t("contextBanner.criticalTitle", { count })}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {t("contextBanner.criticalDesc")}
        </p>
      </div>
      <button onClick={onClear} className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap">
        {t("common.clear")}
      </button>
    </div>
  );
  if (filterHighlight === "tarefas") return (
    <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
      <span className="text-lg shrink-0 mt-0.5">📋</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-orange-800">{t("contextBanner.tasksTitle")}</p>
        <p className="text-xs text-orange-700 mt-0.5">
          {t("contextBanner.tasksDesc")}
        </p>
      </div>
      <button onClick={onClear} className="shrink-0 text-xs font-semibold text-orange-700 hover:text-orange-900 px-2.5 py-1.5 rounded-lg hover:bg-orange-100 transition-colors whitespace-nowrap">
        {t("common.close")}
      </button>
    </div>
  );
  return null;
}

const REGIME_BADGE_COLOR = {
  simples:   "bg-emerald-50 text-emerald-600",
  presumido: "bg-blue-50 text-blue-600",
  real:      "bg-violet-50 text-violet-600",
};

// Cidade em texto leve com ícone (contexto, não é dado de identidade — não deve
// competir com CNPJ), regime como badge colorido (classificação, igual aos
// outros badges do app) — em vez de uma terceira linha de texto corrido.
function LocationRegimeTags({ cidade, estado, regimeCode, t }) {
  if (!cidade && !regimeCode) return null;
  const regimeKey = REGIME_KEYS[regimeCode];
  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      {cidade && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
          <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {toTitleCase(cidade)}{estado ? `/${estado}` : ""}
        </span>
      )}
      {regimeCode && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none ${REGIME_BADGE_COLOR[regimeKey] || "bg-gray-100 text-gray-500"}`}>
          {regimeLabel(t, regimeCode)}
        </span>
      )}
    </div>
  );
}

// ── Card (usado na tabela e no Kanban) ──────────────────────────────────────────

function ImplCard({ impl, onClick }) {
  const { t } = useTranslation("implantacoes");
  const sla = slaRelativo(impl);
  const isAtrasada = isSlaVencido(impl);

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-white p-3.5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
        isAtrasada ? "border-red-200" : "border-gray-100"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="font-mono text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
          {impl.codigo}
        </span>
        {impl.prioridade !== "normal" && <PrioridadePill prioridade={impl.prioridade} />}
      </div>
      <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{impl.cliente_nome}</p>
      <p className="text-[11px] font-mono text-gray-400 mt-0.5">{impl.cliente_cnpj}</p>
      <LocationRegimeTags cidade={impl.cliente_cidade} estado={impl.cliente_estado} regimeCode={impl.cliente_regime_tributario} t={t} />

      <div className="mt-2.5">
        <ProgressBar value={impl.progresso} status={impl.status} />
      </div>

      <div className="flex items-center justify-between mt-2.5">
        {impl.responsavel_nome ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <UserAvatar nome={impl.responsavel_nome} avatarUrl={impl.responsavel_avatar_url} size="sm" />
            <span className="text-[11px] text-gray-600 truncate">{impl.responsavel_nome}</span>
          </div>
        ) : <span />}
        {impl.status === "concluida" ? (
          <span className="text-[10px] text-gray-400 whitespace-nowrap">{t("card.concludedOn", { date: fmtDate(impl.data_conclusao) })}</span>
        ) : sla?.level === "expired" ? (
          <span className="text-[10px] font-semibold text-red-600 whitespace-nowrap">{sla.label}</span>
        ) : (
          <span className="text-[10px] text-gray-400 whitespace-nowrap">{sla?.label}</span>
        )}
      </div>
    </div>
  );
}

// ── Kanban ────────────────────────────────────────────────────────────────────

const KANBAN_PREVIEW = 3;

function KanbanColumn({ title, dotClass, items, onCardClick, onVerTodas }) {
  const { t } = useTranslation("implantacoes");
  const preview = items.slice(0, KANBAN_PREVIEW);
  return (
    <div className="flex-1 min-w-[260px] bg-gray-50/70 rounded-2xl border border-gray-100 flex flex-col">
      <div className="px-3.5 pt-3.5 pb-2.5 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>
      <div className="px-2.5 pb-2.5 space-y-2 flex-1">
        {preview.length === 0 ? (
          <p className="text-xs text-gray-300 text-center py-6">{t("kanban.empty")}</p>
        ) : (
          preview.map((impl) => <ImplCard key={impl.id} impl={impl} onClick={() => onCardClick(impl)} />)
        )}
      </div>
      {items.length > KANBAN_PREVIEW && (
        <button
          onClick={onVerTodas}
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 py-2.5 border-t border-gray-100"
        >
          {t("kanban.verTodas", { count: items.length })}
        </button>
      )}
    </div>
  );
}

// ── Painel lateral de visão rápida ───────────────────────────────────────────

function CircularProgress({ value }) {
  const r = 34, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative w-24 h-24 shrink-0">
      {/* w-full/h-full (não width/height fixos em px) — o SVG precisa herdar o
          tamanho real do container em vez de ter seu próprio tamanho fixo em
          pixels, senão ele e a div de texto sobreposta (dimensionada em rem
          pelo Tailwind) podem não coincidir exatamente, descentralizando o
          número em relação ao anel. Rotação via atributo SVG (não classe CSS)
          gira com precisão em torno do centro real do círculo (48,48). */}
      <svg viewBox="0 0 96 96" className="w-full h-full">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke={value >= 100 ? "#22c55e" : "#f97316"} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-800">{value}%</span>
      </div>
    </div>
  );
}

const QUICK_TABS = [
  { id: "geral",      labelKey: "geral"      },
  { id: "atividades", labelKey: "atividades" },
  { id: "arquivos",   labelKey: "arquivos"   },
  { id: "historico",  labelKey: "historico"  },
];

function QuickViewPanel({ implId, onClose, onNavigate, onUpdated }) {
  const { t } = useTranslation("implantacoes");
  const [impl, setImpl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("geral");
  const [showAcoes, setShowAcoes] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLoading(true);
    setTab("geral");
    setEditing(false);
    implantacoesApi.obter(implId)
      .then(({ data }) => setImpl(data))
      .catch(() => setImpl(null))
      .finally(() => setLoading(false));
  }, [implId]);

  function handleEditSaved() {
    setEditing(false);
    implantacoesApi.obter(implId).then(({ data }) => setImpl(data)).catch(() => {});
    onUpdated?.();
  }

  // Mesmo cálculo por item-folha da tela completa, pra "N pendentes" e a
  // porcentagem sempre baterem com o que aparece em ImplantacaoDetalhe.jsx.
  const subsIndex = impl ? buildSubsIndex(impl.checklist) : {};
  const { total: lpTotal, done: lpDone } = impl
    ? impl.etapas.reduce((acc, e) => {
        const r = leafProgress(e.itens, subsIndex);
        return { total: acc.total + r.total, done: acc.done + r.done };
      }, { total: 0, done: 0 })
    : { total: 0, done: 0 };
  const liveProgress = lpTotal > 0 ? Math.round((lpDone / lpTotal) * 100) : 0;
  const pendingItems = lpTotal - lpDone;
  const pendingTasks = impl ? pendingLeafItems(impl.etapas, subsIndex) : [];

  return (
      // Painel docado ao lado do conteúdo (não sobrepõe nada) — sticky pra
      // acompanhar o scroll, só na faixa abaixo do cabeçalho/KPIs, com scroll
      // próprio quando o conteúdo é maior que a tela.
      <div
        className="w-full max-w-sm shrink-0 sticky top-4 bg-white rounded-2xl border border-gray-100 shadow-lg flex flex-col"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        {loading || !impl ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : editing ? (
          <>
            {/* Header — modo edição substitui o conteúdo normal do card, não
                sobrepõe: cancelar/salvar volta pro mesmo card na visão padrão.
                Mantém a identificação do cliente visível (código/nome/CNPJ)
                pra não perder de vista quem está sendo editado. */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{impl.codigo}</span>
                  <Badge status={impl.status} />
                </div>
                <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">{impl.nome}</h2>
              <p className="text-xs font-mono text-gray-400 mt-0.5">{impl.cliente_cnpj}</p>
              <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide mt-3">{t("quickView.edit")}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ImplantacaoEditForm impl={impl} onCancel={() => setEditing(false)} onSaved={handleEditSaved} showHeader={false} />
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{impl.codigo}</span>
                  <Badge status={impl.status} />
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">{impl.nome}</h2>
              <p className="text-xs font-mono text-gray-400 mt-0.5">{impl.cliente_cnpj}</p>

              {/* Tabs */}
              <div className="flex gap-4 mt-4 -mb-4 border-b border-gray-100">
                {QUICK_TABS.map((qt) => (
                  <button
                    key={qt.id}
                    onClick={() => setTab(qt.id)}
                    className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                      tab === qt.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {t(`quickView.tabs.${qt.labelKey}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {tab === "geral" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{t("quickView.overallProgress")}</p>
                      {pendingItems > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {t("quickView.pendingCount", { count: pendingItems })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <CircularProgress value={liveProgress} />
                      <div className="text-xs text-gray-500 space-y-1.5">
                        <p><span className="text-gray-400">{t("quickView.startedOn")}</span> {fmtDate(impl.data_inicio) || "—"}</p>
                        <p>
                          <span className="text-gray-400">{t("quickView.expectedCompletion")}</span> {fmtDate(impl.data_prevista) || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={liveProgress} status={impl.status} />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("quickView.responsible")}</p>
                    <div className="flex items-center justify-between">
                      {impl.responsavel_nome ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar nome={impl.responsavel_nome} avatarUrl={impl.responsavel_avatar_url} />
                          <span className="text-sm text-gray-700 font-medium">{impl.responsavel_nome}</span>
                        </div>
                      ) : <span className="text-sm text-gray-300">—</span>}
                      <button
                        onClick={() => onNavigate(impl.id)}
                        className="text-xs font-semibold text-orange-600 hover:text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
                      >
                        {t("quickView.change")}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("quickView.information")}</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t("quickView.sla")}</span>
                        <span className="text-gray-700 font-medium">{impl.sla_dias} {t("quickView.days")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t("quickView.priority")}</span>
                        <PrioridadePill prioridade={impl.prioridade} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t("quickView.company")}</span>
                        <span className="text-gray-700 font-medium truncate max-w-[160px]">{impl.cliente_nome}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{t("quickView.recentActivity")}</p>
                    </div>
                    <div className="space-y-3">
                      {(impl.timeline || []).slice(0, 3).map((ev) => (
                        <div key={ev.id} className="flex items-start gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-700 font-medium">{ev.titulo}</p>
                            <p className="text-[10px] text-gray-400">{fmtDateTime(ev.created_at)}</p>
                          </div>
                        </div>
                      ))}
                      {(impl.timeline || []).length === 0 && (
                        <p className="text-xs text-gray-300">{t("quickView.noActivity")}</p>
                      )}
                    </div>
                    {(impl.timeline || []).length > 3 && (
                      <button onClick={() => setTab("atividades")} className="text-xs font-semibold text-orange-600 hover:text-orange-700 mt-2">
                        {t("quickView.viewAllActivity")}
                      </button>
                    )}
                  </div>
                </>
              )}

              {tab === "atividades" && (
                <div className="space-y-5">
                  {pendingTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                        {t("quickView.pendingTasksTitle", { count: pendingTasks.length })}
                      </p>
                      <div className="space-y-2">
                        {pendingTasks.map((task) => (
                          <div key={task.id} className="flex items-start gap-2.5">
                            <span className="w-3 h-3 rounded-full border-2 border-gray-300 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-700 leading-snug">{task.titulo}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{task.etapaNome}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    {pendingTasks.length > 0 && (
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 pt-4 border-t border-gray-100">
                        {t("quickView.activityLogTitle")}
                      </p>
                    )}
                    <div className="space-y-3">
                      {(impl.timeline || []).map((ev) => (
                        <div key={ev.id} className="flex items-start gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-700 font-medium">{ev.titulo}</p>
                            {ev.descricao && <p className="text-[11px] text-gray-500 mt-0.5">{ev.descricao}</p>}
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDateTime(ev.created_at)}</p>
                          </div>
                        </div>
                      ))}
                      {(impl.timeline || []).length === 0 && (
                        <p className="text-xs text-gray-300 text-center py-6">{t("quickView.noActivity")}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "arquivos" && (
                <p className="text-xs text-gray-300 text-center py-10">{t("quickView.comingSoon")}</p>
              )}

              {tab === "historico" && (
                <div className="space-y-3">
                  {(impl.timeline || []).map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700">{ev.titulo}</p>
                        <p className="text-[10px] text-gray-400">{fmtDateTime(ev.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  {(impl.timeline || []).length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-6">{t("quickView.noActivity")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0 relative">
              <button
                onClick={() => onNavigate(impl.id)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t("quickView.viewFull")}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowAcoes((v) => !v)}
                  className="h-full px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center gap-1.5"
                >
                  {t("quickView.actions")}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAcoes && (
                  <div className="absolute bottom-full right-0 mb-2 w-44 bg-white rounded-xl border border-gray-100 shadow-lg py-1.5 z-10">
                    <button
                      onClick={() => { setEditing(true); setShowAcoes(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {t("quickView.edit")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
  );
}

// ── Filtros avançados (popover) ─────────────────────────────────────────────

function FiltrosAvancados({ filterPrioridade, onChangePrioridade, onClose }) {
  const { t } = useTranslation("implantacoes");
  const ref = useRef(null);
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl border border-gray-100 shadow-lg p-4 z-20">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("page.priorityLabel")}</p>
      <div className="flex flex-wrap gap-1.5">
        {["", "critica", "alta", "normal", "baixa"].map((p) => (
          <button
            key={p}
            onClick={() => onChangePrioridade(p)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              filterPrioridade === p ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {p ? t(`prioridadeFilters.${p}`) : t("prioridadeFilters.any")}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Implantacoes() {
  const { t } = useTranslation("implantacoes");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]  = useState("");
  const [viewMode, setViewMode] = useState("kanban"); // kanban | list
  const [showFiltros, setShowFiltros] = useState(false);
  const [quickViewId, setQuickViewId] = useState(null);

  const activeTab        = searchParams.get("tab")        || "em_andamento";
  const filterPrioridade = searchParams.get("prioridade") || "";
  const filterHighlight  = searchParams.get("highlight")  || "";

  function setTab(tab) {
    const p = new URLSearchParams(searchParams);
    p.set("tab", tab);
    setSearchParams(p, { replace: true });
  }

  function setParam(key, value) {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p, { replace: true });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await implantacoesApi.listar({});
      setItems(data);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── KPIs (contagens independentes — uma implantação pode contar em mais de uma) ──
  const kpiEmAndamento = items.filter((i) => i.status === "em_andamento").length;
  const kpiSlaVencido  = items.filter(isSlaVencido).length;
  const kpiConversao   = items.filter((i) => i.conversao_dados).length;
  const kpiConcluidas  = items.filter((i) => i.status === "concluida").length;

  const TABS = [
    { key: "em_andamento", labelKey: "emAndamento", count: kpiEmAndamento },
    { key: "conversao",    labelKey: "conversao",   count: kpiConversao },
    { key: "sla_vencido",  labelKey: "slaVencido",  count: kpiSlaVencido },
    { key: "concluida",    labelKey: "concluida",   count: kpiConcluidas },
    { key: "todas",        labelKey: "todas",       count: items.length },
  ];

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = items.filter((i) => {
    if (activeTab === "em_andamento" && i.status !== "em_andamento") return false;
    if (activeTab === "conversao" && !i.conversao_dados) return false;
    if (activeTab === "sla_vencido" && !isSlaVencido(i)) return false;
    if (activeTab === "concluida" && i.status !== "concluida") return false;
    if (filterPrioridade && i.prioridade !== filterPrioridade) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !i.nome.toLowerCase().includes(q) &&
        !i.codigo.toLowerCase().includes(q) &&
        !(i.cliente_nome || "").toLowerCase().includes(q) &&
        !(i.cliente_cnpj || "").includes(q)
      ) return false;
    }
    return true;
  });

  const hasActiveFilters = !!filterPrioridade;

  const displayList = filterHighlight === "tarefas"
    ? [...filtered].sort((a, b) => {
        const order = { atrasada: 0, critico: 1, em_risco: 2 };
        return (order[a.sla_status] ?? 9) - (order[b.sla_status] ?? 9);
      })
    : filtered;

  // Agrupamento exclusivo pro Kanban (exclui canceladas, igual ao mockup)
  const kanbanBuckets = { em_andamento: [], conversao: [], sla_vencido: [], concluida: [] };
  for (const impl of filtered) {
    if (impl.status === "cancelada") continue;
    kanbanBuckets[getCategoria(impl)].push(impl);
  }

  function handleVerTodas(tabKey) {
    setTab(tabKey);
    setViewMode("list");
  }

  return (
    <Layout>
      {/* Cabeçalho + KPIs — sempre largura total, nunca encolhem nem ficam atrás do painel */}
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("page.title")}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{t("page.subtitleRealtime")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[220px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder={t("page.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition bg-white"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFiltros((v) => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                hasActiveFilters ? "border-orange-400 text-orange-700 bg-orange-50" : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {t("page.advancedFilters")}
            </button>
            {showFiltros && (
              <FiltrosAvancados
                filterPrioridade={filterPrioridade}
                onChangePrioridade={(v) => setParam("prioridade", v)}
                onClose={() => setShowFiltros(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Context banner */}
      {(searchParams.get("sla_status") === "atrasada" || searchParams.get("sla_status") === "critico" || filterHighlight === "tarefas") && (
        <div className="mb-4">
          <ContextBanner
            filterSla={searchParams.get("sla_status")}
            filterHighlight={filterHighlight}
            count={filtered.length}
            onClear={() => {
              const p = new URLSearchParams(searchParams);
              p.delete("sla_status");
              p.delete("highlight");
              setSearchParams(p, { replace: true });
            }}
          />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard
          icon={<span className="text-sm">🚀</span>}
          label={t("page.kpi.inProgress")}
          value={kpiEmAndamento}
          sub={items.length ? t("page.kpi.pctOfTotal", { pct: Math.round((kpiEmAndamento / items.length) * 100) }) : undefined}
          accent="orange"
          active={activeTab === "em_andamento"}
          onClick={() => setTab("em_andamento")}
        />
        <KpiCard
          icon={<span className="text-sm">⏱️</span>}
          label={t("page.kpi.slaOverdue")}
          value={kpiSlaVencido}
          sub={kpiSlaVencido > 0 ? t("page.kpi.requiresAttention") : t("page.kpi.onSchedule")}
          accent={kpiSlaVencido > 0 ? "red" : "gray"}
          active={activeTab === "sla_vencido"}
          onClick={() => setTab("sla_vencido")}
        />
        <KpiCard
          icon={<span className="text-sm">🗄️</span>}
          label={t("page.kpi.withConversion")}
          value={kpiConversao}
          sub={t("page.kpi.ofData")}
          accent={kpiConversao > 0 ? "blue" : "gray"}
          active={activeTab === "conversao"}
          onClick={() => setTab("conversao")}
        />
        <KpiCard
          icon={<span className="text-sm">✅</span>}
          label={t("page.kpi.completed")}
          value={kpiConcluidas}
          sub={items.length ? t("page.kpi.pctOfTotal", { pct: Math.round((kpiConcluidas / items.length) * 100) }) : undefined}
          accent="green"
          active={activeTab === "concluida"}
          onClick={() => setTab("concluida")}
        />
      </div>

      {/* A partir daqui: conteúdo (abas + Kanban/lista) e painel de detalhe dividem
          a largura lado a lado — o painel nunca cobre o cabeçalho/KPIs acima. */}
      <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0">
      {/* Tabs + view toggle */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tb.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t(`tabs.${tb.labelKey}`)}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                activeTab === tb.key ? "bg-orange-100 text-orange-600" : "bg-gray-200 text-gray-500"
              }`}>
                {tb.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode("list")}
            title={t("page.viewList")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              viewMode === "list" ? "bg-white shadow-sm text-gray-700" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            title={t("page.viewKanban")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              viewMode === "kanban" ? "bg-white shadow-sm text-gray-700" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <p className="text-3xl mb-3">⚙️</p>
          <p className="text-sm font-medium text-gray-700">{t("page.emptyTitle")}</p>
          <p className="text-xs text-gray-400 mt-1">
            {search || hasActiveFilters ? t("page.emptyFiltered") : t("page.emptyDefault")}
          </p>
        </div>
      ) : viewMode === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          <KanbanColumn
            title={t("tabs.emAndamento")}
            dotClass="bg-blue-500"
            items={kanbanBuckets.em_andamento}
            onCardClick={(impl) => setQuickViewId(impl.id)}
            onVerTodas={() => handleVerTodas("em_andamento")}
          />
          <KanbanColumn
            title={t("tabs.conversao")}
            dotClass="bg-indigo-500"
            items={kanbanBuckets.conversao}
            onCardClick={(impl) => setQuickViewId(impl.id)}
            onVerTodas={() => handleVerTodas("conversao")}
          />
          <KanbanColumn
            title={t("tabs.slaVencido")}
            dotClass="bg-red-500"
            items={kanbanBuckets.sla_vencido}
            onCardClick={(impl) => setQuickViewId(impl.id)}
            onVerTodas={() => handleVerTodas("sla_vencido")}
          />
          <KanbanColumn
            title={t("tabs.concluida")}
            dotClass="bg-green-500"
            items={kanbanBuckets.concluida}
            onCardClick={(impl) => setQuickViewId(impl.id)}
            onVerTodas={() => handleVerTodas("concluida")}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="p-0 w-1" />
                  <th className="px-6 py-3">{t("page.headers.client")}</th>
                  <th className="px-6 py-3">{t("page.headers.status")}</th>
                  <th className="px-6 py-3 min-w-[150px]">{t("page.headers.progress")}</th>
                  <th className="px-6 py-3">{t("page.headers.responsible")}</th>
                  <th className="px-6 py-3">{t("page.headers.sla")}</th>
                  <th className="px-2 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayList.map((impl) => {
                  const sla = slaRelativo(impl);
                  const isAtiva = impl.status === "em_andamento" || impl.status === "pausada";
                  const isAtrasada = isAtiva && impl.sla_status === "atrasada";
                  const isCritico  = isAtiva && impl.sla_status === "critico";

                  const stripeColor =
                    sla?.level === "expired" ? "bg-red-500" :
                    sla?.level === "urgent"  ? "bg-amber-500" :
                    sla?.level === "warning" ? "bg-yellow-400" :
                    sla?.level === "ok"      ? "bg-green-400" :
                    "bg-gray-200";

                  return (
                    <tr
                      key={impl.id}
                      onClick={() => setQuickViewId(impl.id)}
                      className={`cursor-pointer group transition-colors ${
                        isAtrasada ? "bg-red-50/50 hover:bg-red-50/80" :
                        isCritico  ? "bg-amber-50/40 hover:bg-amber-50/70" :
                        "hover:bg-orange-50/40"
                      }`}
                    >
                      <td className={`p-0 ${stripeColor}`} style={{ width: "4px", minWidth: "4px" }}></td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {impl.codigo}
                          </span>
                          {impl.prioridade !== "normal" && <PrioridadePill prioridade={impl.prioridade} />}
                        </div>
                        <p className="font-semibold text-gray-900 leading-tight">{impl.cliente_nome}</p>
                        <p className="text-xs font-mono text-gray-400 mt-0.5">{impl.cliente_cnpj}</p>
                        <LocationRegimeTags cidade={impl.cliente_cidade} estado={impl.cliente_estado} regimeCode={impl.cliente_regime_tributario} t={t} />
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {isAtrasada && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse shrink-0" />
                              {t("page.slaOverdueBadge")}
                            </span>
                          )}
                          {isCritico && !isAtrasada && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-white">
                              {t("page.slaCriticalBadge")}
                            </span>
                          )}
                          {(impl.tarefas_vencidas ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                              <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {t("page.overdueTasksBadge", { count: impl.tarefas_vencidas })}
                            </span>
                          )}
                          {impl.conversao_dados && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h7" />
                              </svg>
                              {t("page.dataConversionBadge")}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4"><Badge status={impl.status} /></td>

                      <td className="px-6 py-4 min-w-[150px]">
                        <ProgressBar value={impl.progresso} status={impl.status} />
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {impl.responsavel_nome ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar nome={impl.responsavel_nome} avatarUrl={impl.responsavel_avatar_url} />
                            <span className="text-sm text-gray-700">{impl.responsavel_nome}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {sla ? (
                          sla.level === "done" ? (
                            <span className="text-xs text-gray-400">{sla.label}</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-semibold border ${SLA_PILL[sla.level]}`}>
                              {sla.level === "expired" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                              )}
                              {sla.label}
                            </span>
                          )
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      <td className="px-3 py-4">
                        <svg className="w-4 h-4 text-gray-200 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>

      {quickViewId && (
        <QuickViewPanel
          implId={quickViewId}
          onClose={() => setQuickViewId(null)}
          onNavigate={(id) => navigate(`/admin/implantacoes/${id}`)}
          onUpdated={load}
        />
      )}
      </div>
    </Layout>
  );
}
