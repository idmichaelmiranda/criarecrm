import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { dashboardApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import i18n from "../i18n";

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseUTC(s) {
  if (!s) return new Date(NaN);
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  return new Date(s + "Z");
}

function timeAgo(iso, now = new Date()) {
  const diff = (now - parseUTC(iso)) / 1000;
  if (diff < 60) return i18n.t("dashboard:time.now");
  if (diff < 3600) return i18n.t("dashboard:time.minutesAgo", { count: Math.floor(diff / 60) });
  if (diff < 86400) return i18n.t("dashboard:time.hoursAgo", { count: Math.floor(diff / 3600) });
  return i18n.t("dashboard:time.daysAgo", { count: Math.floor(diff / 86400) });
}

function refreshLabel(lastRefresh, now) {
  const diff = (now - lastRefresh) / 1000;
  if (diff < 10)   return i18n.t("dashboard:time.refreshedNow");
  if (diff < 60)   return i18n.t("dashboard:time.refreshedInstant");
  if (diff < 3600) return i18n.t("dashboard:time.refreshedMinutesAgo", { count: Math.floor(diff / 60) });
  return i18n.t("dashboard:time.refreshedHoursAgo", { count: Math.floor(diff / 3600) });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString(i18n.language, { day: "2-digit", month: "short" });
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  const diff = Math.round((today - t) / 86400000);
  if (diff === 0) return i18n.t("dashboard:time.today");
  if (diff === 1) return i18n.t("dashboard:time.yesterday");
  return d.toLocaleDateString(i18n.language, { weekday: "short", day: "2-digit", month: "short" });
}

function initials(nome) {
  if (!nome) return "?";
  return nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const SLA_CFG = {
  ok:       { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
  critico:  { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500"  },
  atrasada: { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
  em_risco: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
};

const PRIO_CFG = {
  critica: { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200"    },
  alta:    { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  normal:  { bg: "bg-blue-50",    text: "text-blue-600",   border: "border-blue-100"   },
  baixa:   { bg: "bg-gray-100",   text: "text-gray-500",   border: "border-gray-200"   },
};

function stageStyle(hex) {
  const c = hex && hex.startsWith("#") && hex.length >= 7 ? hex : "#6366f1";
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  return {
    dot:    { backgroundColor: c },
    header: { backgroundColor: `rgba(${r},${g},${b},0.08)` },
    badge:  { backgroundColor: c, color: "#fff" },
    text:   { color: c },
    chip:   { backgroundColor: `rgba(${r},${g},${b},0.10)`, color: c, borderColor: `rgba(${r},${g},${b},0.30)` },
  };
}

const TIMELINE_CFG = {
  solicitacao_criada:    { icon: "📥", color: "bg-indigo-100 text-indigo-600"   },
  triagem_iniciada:      { icon: "🔍", color: "bg-amber-100 text-amber-600"     },
  aprovado:              { icon: "✅", color: "bg-green-100 text-green-600"     },
  recusada:              { icon: "❌", color: "bg-red-100 text-red-600"         },
  implantacao_criada:    { icon: "🚀", color: "bg-blue-100 text-blue-600"       },
  etapa_concluida:       { icon: "🏁", color: "bg-blue-100 text-blue-700"       },
  checklist_concluido:   { icon: "☑️", color: "bg-emerald-100 text-emerald-600" },
  checklist_desmarcado:  { icon: "↩️", color: "bg-amber-100 text-amber-600"    },
  tarefa_adicionada:     { icon: "➕", color: "bg-violet-100 text-violet-600"   },
  comentario:            { icon: "💬", color: "bg-purple-100 text-purple-600"   },
  status_alterado:       { icon: "🔄", color: "bg-slate-100 text-slate-600"     },
  implantacao_concluida: { icon: "🟢", color: "bg-green-100 text-green-700"     },
};

const TIMELINE_FILTERS = [
  { key: "todos",                 labelKey: "all"      },
  { key: "etapa_concluida",       labelKey: "stages"   },
  { key: "checklist_concluido",   labelKey: "tasks"    },
  { key: "implantacao_concluida", labelKey: "goLives"  },
  { key: "comentario",            labelKey: "comments" },
];

const FLASH_FIELDS = [
  "implantacoes_em_andamento", "implantacoes_atrasadas", "implantacoes_critico",
  "go_lives_semana", "taxa_conclusao", "tarefas_vencidas", "tarefas_sem_responsavel",
  "solicitacoes_novas", "instalacoes_sem_responsavel", "instalacoes_sem_responsavel_hoje",
];

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton({ className }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-12" />
      <Skeleton className="h-56" />
      <Skeleton className="h-64" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

// ── 1. KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, to, urgent, onClick, deltaLabel, deltaGood, flashing }) {
  const isUrgent = urgent && (value ?? 0) > 0;
  const content = (
    <div className={`rounded-xl border shadow-sm p-4 flex flex-col gap-1 transition-all duration-500
      ${to || onClick ? "hover:shadow-md cursor-pointer" : ""}
      ${isUrgent
        ? "border-red-200 bg-red-50/40"
        : flashing
          ? "border-orange-200 bg-orange-50/60"
          : "bg-white border-gray-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg leading-none">{icon}</span>
        {isUrgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      </div>
      <p className={`text-2xl font-bold leading-none tabular-nums ${color}`}>{value ?? "—"}</p>
      <p className="text-[11px] font-medium text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      {deltaLabel && (
        <p className={`text-[10px] font-semibold mt-0.5 ${
          deltaGood === true  ? "text-green-600" :
          deltaGood === false ? "text-red-600"   : "text-gray-400"
        }`}>
          {deltaLabel}
        </p>
      )}
    </div>
  );
  if (onClick) return <div onClick={onClick} className="block">{content}</div>;
  return to ? <Link to={to} className="block">{content}</Link> : content;
}

// ── 2. Go Lives Modal ──────────────────────────────────────────────────────────

function GoLivesModal({ lista, onClose }) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-5 min-w-[300px] max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">{t("goLives.title")}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {t("goLives.subtitle", { count: lista.length })}
            </p>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded">✕</button>
        </div>
        <div className="divide-y divide-gray-50">
          {lista.map((gl) => (
            <Link key={gl.id} to={`/admin/implantacoes/${gl.id}`} onClick={onClose}>
              <div className="flex items-center justify-between py-2.5 px-2 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{gl.cliente_nome}</p>
                  <p className="text-[10px] text-gray-400 truncate">{gl.nome}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">{fmtDate(gl.data_go_live)}</span>
                  <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 3. Alertas Operacionais ────────────────────────────────────────────────────

function AlertStrip({ data }) {
  const { t } = useTranslation("dashboard");
  const alerts = [];
  if ((data.implantacoes_atrasadas ?? 0) > 0) {
    alerts.push({
      key: "atrasadas", icon: "🔴",
      title: t("alert.overdue", { count: data.implantacoes_atrasadas }),
      desc: t("alert.immediateActionNeeded"),
      bg: "bg-red-50 border-red-200", titleColor: "text-red-800", descColor: "text-red-600",
      btnBg: "bg-red-100 hover:bg-red-200 text-red-700",
      to: "/admin/implantacoes?sla_status=atrasada",
    });
  }
  if ((data.implantacoes_critico ?? 0) > 0) {
    alerts.push({
      key: "critico", icon: "🟡",
      title: t("alert.criticalRisk", { count: data.implantacoes_critico }),
      desc: t("alert.lessThan3Days"),
      bg: "bg-amber-50 border-amber-200", titleColor: "text-amber-800", descColor: "text-amber-600",
      btnBg: "bg-amber-100 hover:bg-amber-200 text-amber-700",
      to: "/admin/implantacoes?sla_status=critico",
    });
  }
  if ((data.tarefas_vencidas ?? 0) > 0) {
    alerts.push({
      key: "tarefas", icon: "📋",
      title: t("alert.tasksOverdue", { count: data.tarefas_vencidas }),
      desc: t("alert.inActiveImplantacoes"),
      bg: "bg-orange-50 border-orange-200", titleColor: "text-orange-800", descColor: "text-orange-600",
      btnBg: "bg-orange-100 hover:bg-orange-200 text-orange-700",
      to: "/admin/implantacoes?highlight=tarefas",
    });
  }
  if ((data.solicitacoes_novas ?? 0) > 0) {
    alerts.push({
      key: "triagem", icon: "📥",
      title: t("alert.pendingTriage", { count: data.solicitacoes_novas }),
      desc: t("alert.inQueue"),
      bg: "bg-indigo-50 border-indigo-200", titleColor: "text-indigo-800", descColor: "text-indigo-600",
      btnBg: "bg-indigo-100 hover:bg-indigo-200 text-indigo-700",
      to: "/admin/triagem",
    });
  }
  const _instVenc  = data.instalacoes_sem_responsavel_vencidas ?? 0;
  const _instHoje  = data.instalacoes_sem_responsavel_hoje     ?? 0;
  const _instTotal = data.instalacoes_sem_responsavel          ?? 0;
  if (_instVenc > 0 || _instHoje > 0 || _instTotal > 0) {
    // Monta descrição com breakdown dos casos mais críticos
    const parts = [];
    if (_instVenc > 0) parts.push(t("kpi.overdue", { count: _instVenc }));
    if (_instHoje > 0) parts.push(t("kpi.todayCount", { count: _instHoje }));
    const future = _instTotal - _instVenc - _instHoje;
    if (future > 0) parts.push(t("kpi.future", { count: future }));

    const isCritico = _instVenc > 0;
    const isUrgente = !isCritico && _instHoje > 0;

    alerts.push({
      key: "instalacoes",
      icon: isCritico ? "🚨" : isUrgente ? "🚨" : "📦",
      title: isCritico
        ? t("alert.installationsOverdue", { count: _instVenc })
        : isUrgente
          ? t("alert.installationsToday", { count: _instHoje })
          : t("alert.installationsTotal", { count: _instTotal }),
      desc: parts.join(" · ") || t("alert.waiting"),
      bg:        isCritico ? "bg-red-50 border-red-300"         : isUrgente ? "bg-red-50 border-red-300"         : "bg-orange-50 border-orange-200",
      titleColor:isCritico ? "text-red-800"                     : isUrgente ? "text-red-800"                     : "text-orange-800",
      descColor: isCritico ? "text-red-600"                     : isUrgente ? "text-red-600"                     : "text-orange-600",
      btnBg:     isCritico ? "bg-red-100 hover:bg-red-200 text-red-700" : isUrgente ? "bg-red-100 hover:bg-red-200 text-red-700" : "bg-orange-100 hover:bg-orange-200 text-orange-700",
      to: "/instalacoes?sem_responsavel=1",
    });
  }
  if (alerts.length === 0) return null;
  const cols =
    alerts.length === 1 ? "grid-cols-1" :
    alerts.length === 2 ? "grid-cols-2" :
    alerts.length === 3 ? "grid-cols-3" :
    "grid-cols-2 xl:grid-cols-4";
  return (
    <div className={`grid gap-3 ${cols}`}>
      {alerts.map((a) => (
        <div key={a.key} className={`rounded-xl border px-4 py-3 flex items-center justify-between ${a.bg}`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{a.icon}</span>
            <div>
              <p className={`text-sm font-semibold ${a.titleColor}`}>{a.title}</p>
              <p className={`text-xs mt-0.5 ${a.descColor}`}>{a.desc}</p>
            </div>
          </div>
          <Link to={a.to} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 ${a.btnBg}`}>{t("alert.viewMore")}</Link>
        </div>
      ))}
    </div>
  );
}

// ── 4. Pipeline Kanban ─────────────────────────────────────────────────────────

function PipelineMiniCard({ item }) {
  const sla = SLA_CFG[item.sla_status] || SLA_CFG.ok;
  return (
    <Link to={`/admin/implantacoes/${item.id}`}>
      <div className="bg-white rounded-lg border border-gray-100 p-2.5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="text-xs font-semibold text-gray-800 leading-tight truncate group-hover:text-orange-600 transition-colors">{item.cliente_nome}</p>
          <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-0.5 ${sla.dot}`} />
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1 mb-1.5">
          <div className="h-1 rounded-full bg-orange-400 transition-all" style={{ width: `${item.progresso}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 font-mono">{item.codigo}</span>
          {item.consultor && (
            <span className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center text-[8px] font-bold text-orange-600">
              {initials(item.consultor)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PipelineBoard({ pipeline, selectedStage, onSelectStage, fullscreen = false }) {
  const { t } = useTranslation("dashboard");
  const colW = fullscreen ? "w-56" : "w-44";
  const minH = fullscreen ? "min-h-[calc(100vh-140px)]" : "min-h-[120px]";
  // Oculta colunas sem cards — pipeline mostra só onde há trabalho ativo
  const activePipeline = pipeline.filter((s) => s.count > 0);
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {activePipeline.map((stage) => {
          const sc = stageStyle(stage.cor);
          const isSelected = selectedStage === stage.nome;
          return (
            <div
              key={stage.nome}
              className={`flex-none ${colW} border-r border-gray-100 last:border-r-0 transition-all
                ${isSelected ? "ring-2 ring-inset ring-orange-300" : ""}`}
            >
              <div
                className={`px-3 py-2.5 border-b border-gray-100 flex items-center gap-2
                  ${stage.count > 0 ? "cursor-pointer hover:brightness-95" : ""}`}
                style={sc.header}
                onClick={() => stage.count > 0 && onSelectStage(isSelected ? null : stage.nome)}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={sc.dot} />
                <p className="text-[11px] font-semibold truncate" style={sc.text}>{stage.nome}</p>
                {stage.count > 0 && (
                  <span className="ml-auto shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold" style={sc.badge}>
                    {stage.count}
                  </span>
                )}
              </div>
              <div className={`p-2 space-y-1.5 ${minH}`}>
                {stage.items.map((item) => <PipelineMiniCard key={item.id} item={item} />)}
                {stage.count > stage.items.length && (
                  <Link to="/admin/implantacoes">
                    <p className="text-[10px] text-gray-400 text-center py-1 hover:text-orange-500 transition-colors cursor-pointer">
                      {t("pipeline.more", { count: stage.count - stage.items.length })}
                    </p>
                  </Link>
                )}
                {stage.count === 0 && (
                  <div className="flex items-center justify-center h-16">
                    <p className="text-[10px] text-gray-300">{t("pipeline.empty")}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineKanban({ pipeline, pipelineTotal, selectedStage, onSelectStage }) {
  const { t } = useTranslation("dashboard");
  const [fullscreen, setFullscreen] = useState(false);
  // Use backend-provided total (unique implantações) to avoid double-counting parallel stages
  const total = pipelineTotal ?? pipeline.reduce((acc, s) => acc + s.count, 0);
  if (total === 0) return null;

  const Header = ({ isFullscreen }) => (
    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{t("pipeline.title")}</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {t("pipeline.subtitle", { count: total })}
          {selectedStage && <span className="ml-2 text-orange-600 font-medium">{t("pipeline.filtering", { stage: selectedStage })}</span>}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {selectedStage && (
          <button onClick={() => onSelectStage(null)} className="text-xs text-gray-400 hover:text-gray-600">
            {t("pipeline.clear")}
          </button>
        )}
        {!isFullscreen && (
          <Link to="/admin/implantacoes" className="text-xs font-medium text-orange-600 hover:text-orange-700">{t("pipeline.viewAll")}</Link>
        )}
        <button
          onClick={() => setFullscreen(!isFullscreen)}
          title={isFullscreen ? t("pipeline.close") : t("pipeline.expand")}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Widget normal */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Header isFullscreen={false} />
        <PipelineBoard pipeline={pipeline} selectedStage={selectedStage} onSelectStage={onSelectStage} />
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <Header isFullscreen={true} />
          <div className="flex-1 overflow-auto">
            <PipelineBoard pipeline={pipeline} selectedStage={selectedStage} onSelectStage={onSelectStage} fullscreen />
          </div>
        </div>
      )}
    </>
  );
}

// ── 5. Fila Operacional ────────────────────────────────────────────────────────

function SlaChip({ status, dias }) {
  const { t } = useTranslation("dashboard");
  const slaKey = SLA_CFG[status] ? status : "ok";
  const cfg = SLA_CFG[slaKey];
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {t(`sla.${slaKey}`)}
      </span>
      {dias !== null && dias !== undefined && (
        <span className="text-[10px] text-gray-400 pl-1">
          {dias < 0 ? t("sla.overdueDays", { count: Math.abs(dias) }) : dias === 0 ? t("sla.dueToday") : t("sla.daysLeft", { count: dias })}
        </span>
      )}
    </div>
  );
}

function PrioChip({ prioridade }) {
  const { t } = useTranslation("dashboard");
  const prioKey = PRIO_CFG[prioridade] ? prioridade : "normal";
  const cfg = PRIO_CFG[prioKey];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {t(`prio.${prioKey}`)}
    </span>
  );
}

function ProgressBar({ value }) {
  const color = value >= 80 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : value >= 25 ? "bg-orange-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 tabular-nums w-7">{value}%</span>
    </div>
  );
}

function FilaOperacional({ fila, filaTotal, stageFilter, stageColorMap = {} }) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const filtered = stageFilter ? fila.filter((i) => i.etapa_atual === stageFilter) : fila;
  if (!fila || fila.length === 0) return null;
  const sc = (s) => stageStyle(stageColorMap[s] || "#6366f1");
  const headers = [
    t("fila.headers.company"), t("fila.headers.stage"), t("fila.headers.bottleneck"), t("fila.headers.sla"),
    t("fila.headers.progress"), t("fila.headers.responsible"), t("fila.headers.priority"), "",
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{t("fila.title")}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {stageFilter
              ? t("fila.filteredSubtitle", { count: filtered.length, stage: stageFilter })
              : `${t("fila.topSubtitle", { count: fila.length })}${filaTotal && filaTotal > fila.length ? t("fila.ofTotal", { total: filaTotal }) : ""}${t("fila.sortedBy")}`
            }
          </p>
        </div>
        <Link to="/admin/implantacoes" className="text-xs font-medium text-orange-600 hover:text-orange-700">{t("pipeline.viewAll")}</Link>
      </div>
      {filtered.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-gray-400">{t("fila.emptyInStage", { stage: stageFilter })}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/60">
                {headers.map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => navigate(`/admin/implantacoes/${item.id}`)}
                  className="hover:bg-orange-50/40 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-800 truncate max-w-[160px] group-hover:text-orange-600 transition-colors">{item.cliente_nome}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{item.codigo}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border"
                      style={sc(item.etapa_atual).chip}>
                      <span className="w-1.5 h-1.5 rounded-full" style={sc(item.etapa_atual).dot} />
                      {item.etapa_atual}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.dias_na_etapa !== null && item.dias_na_etapa !== undefined ? (
                      <span className={`text-xs font-semibold tabular-nums ${item.dias_na_etapa > 5 ? "text-red-500" : item.dias_na_etapa > 3 ? "text-amber-500" : "text-gray-400"}`}>
                        {t("fila.daysInStage", { count: item.dias_na_etapa })}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SlaChip status={item.sla_status} dias={item.dias_restantes} />
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar value={item.progresso} />
                  </td>
                  <td className="px-4 py-3">
                    {item.responsavel_nome ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600 shrink-0 overflow-hidden">
                          {item.responsavel_avatar_url
                            ? <img src={item.responsavel_avatar_url} alt={item.responsavel_nome} className="w-full h-full object-cover" />
                            : initials(item.responsavel_nome)
                          }
                        </div>
                        <span className="text-xs text-gray-600 truncate max-w-[80px]">{item.responsavel_nome}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 italic">{t("fila.unassigned")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PrioChip prioridade={item.prioridade} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <span className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 group-hover:text-orange-500 group-hover:bg-orange-50 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 6. Timeline Inteligente ────────────────────────────────────────────────────

function TimelineIntelligente({ items }) {
  const { t } = useTranslation("dashboard");
  const [filter, setFilter] = useState("todos");
  const TAREFAS_TIPOS = new Set(["checklist_concluido", "checklist_desmarcado", "tarefa_adicionada"]);
  const filtered = filter === "todos"
    ? items
    : filter === "checklist_concluido"
      ? items.filter((ev) => TAREFAS_TIPOS.has(ev.tipo))
      : items.filter((ev) => ev.tipo === filter);

  const groups = [];
  let current = null;
  for (const ev of filtered) {
    const label = dayLabel(ev.created_at);
    if (!current || current.label !== label) {
      current = { label, events: [] };
      groups.push(current);
    }
    current.events.push(ev);
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-3 pb-2.5 flex gap-1.5 flex-wrap border-b border-gray-50">
        {TIMELINE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
              filter === f.key ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {t(`timeline.filters.${f.labelKey}`)}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto max-h-[300px]">
        {groups.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm text-gray-400">{t("timeline.empty")}</p>
          </div>
        ) : (
          <div className="space-y-3 px-4 py-3">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{g.label}</p>
                <div className="space-y-1">
                  {g.events.map((ev) => {
                    const cfg = TIMELINE_CFG[ev.tipo] || { icon: "📌", color: "bg-gray-100 text-gray-500" };
                    const contextNome = ev.implantacao_nome || ev.solicitacao_nome;
                    const temUsuario  = ev.usuario && ev.usuario !== "Sistema";
                    return (
                      <div key={ev.id} className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 leading-snug">{ev.titulo}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {contextNome && (
                              <p className="text-[10px] text-gray-500 font-medium truncate">{contextNome}</p>
                            )}
                            {contextNome && temUsuario && (
                              <span className="text-[10px] text-gray-300">·</span>
                            )}
                            {temUsuario && (
                              <p className="text-[10px] text-gray-400 shrink-0">{t("timeline.by", { name: ev.usuario })}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 tabular-nums mt-0.5">{timeAgo(ev.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 7. Gráfico Mensal ──────────────────────────────────────────────────────────

function GraficoMensal({ dados }) {
  const { t } = useTranslation("dashboard");
  if (!dados || dados.length === 0) return null;
  const max = Math.max(...dados.map((m) => (m.implantacoes ?? m.total ?? 0) + (m.instalacoes ?? 0)), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-800">{t("chart.title")}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{t("chart.subtitle")}</p>
      </div>
      <div className="flex items-end gap-2" style={{ height: "96px" }}>
        {dados.map((m) => {
          const impl = m.implantacoes ?? m.total ?? 0;
          const inst = m.instalacoes ?? 0;
          const total = impl + inst;
          const totalH = total > 0 ? Math.max(Math.round((total / max) * 49), 6) : 0;
          const implH = total > 0 ? Math.round((impl / total) * totalH) : 0;
          const instH = totalH - implH;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full relative flex flex-col justify-end" style={{ height: "64px" }}>
                {total > 0 && (
                  <span
                    className="absolute left-0 right-0 text-center text-[10px] font-semibold tabular-nums text-gray-500 pointer-events-none"
                    style={{ bottom: `${totalH + 3}px` }}
                  >
                    {total}
                  </span>
                )}
                {instH > 0 && (
                  <div
                    className={`w-full transition-all ${m.is_current ? "bg-emerald-500" : "bg-emerald-400 group-hover:bg-emerald-500"}`}
                    style={{ height: `${instH}px` }}
                    title={t("chart.tooltipInstalacoes", { label: m.label, count: inst })}
                  />
                )}
                {implH > 0 && (
                  <div
                    className={`w-full rounded-b-sm transition-all ${instH === 0 ? "rounded-t-md" : ""} ${m.is_current ? "bg-blue-600" : "bg-blue-400 group-hover:bg-blue-500"}`}
                    style={{ height: `${implH}px` }}
                    title={t("chart.tooltipImplantacoes", { label: m.label, count: impl })}
                  />
                )}
                {total === 0 && <div className="w-full rounded-t-md bg-gray-100" style={{ height: "4px" }} />}
              </div>
              <span className={`text-[10px] font-medium ${m.is_current ? "text-gray-600" : "text-gray-400"}`}>{m.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-4 text-[10px] text-gray-400">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" />{t("chart.legendImplantacoes")}</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />{t("chart.legendInstalacoes")}</div>
      </div>
    </div>
  );
}

// ── 8. Workload Consultores ────────────────────────────────────────────────────

function WorkloadConsultores({ dados }) {
  const { t } = useTranslation("dashboard");
  if (!dados || dados.length === 0) return null;
  const maxTotal = Math.max(...dados.map((c) => c.total), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-800">{t("workload.title")}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{t("workload.subtitle", { count: dados.length })}</p>
      </div>
      <div className="space-y-3.5">
        {dados.map((c) => {
          const isNA = c.consultor === "Não atribuído";
          return (
            <div key={c.consultor} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isNA ? "bg-gray-100 text-gray-400" : c.atrasadas > 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
              }`}>
                {initials(c.consultor)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium truncate ${isNA ? "text-gray-400 italic" : "text-gray-700"}`}>{c.consultor}</span>
                  <span className="text-[10px] text-gray-400 tabular-nums shrink-0 ml-2">{t("workload.implCount", { count: c.total })}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c.atrasadas > 0 ? "bg-red-400" : "bg-orange-400"}`}
                    style={{ width: `${Math.round((c.total / maxTotal) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] text-gray-400">{t("workload.avgProgress", { pct: c.progresso_medio })}</span>
                  {c.atrasadas > 0 && (
                    <span className="text-[9px] font-bold text-red-600">{t("workload.overdueCount", { count: c.atrasadas })}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 9. Funil Compacto ──────────────────────────────────────────────────────────

function FunilCompacto({ funil, sla_health }) {
  const { t } = useTranslation("dashboard");
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const total = (sla_health.ok || 0) + (sla_health.critico || 0) + (sla_health.atrasada || 0);
  const taxaRecusa = (funil.solicitacoes ?? 0) > 0 ? Math.round(((funil.recusadas ?? 0) / funil.solicitacoes) * 100) : 0;

  const rows = [
    { labelKey: "requests", value: funil.solicitacoes ?? 0,  color: "bg-indigo-400" },
    { labelKey: "approved", value: funil.aprovadas ?? 0,     color: "bg-blue-500"   },
    { labelKey: "rejected", value: funil.recusadas ?? 0,     color: "bg-red-400",   sub: taxaRecusa > 0 ? t("funnel.rejectionRate", { pct: taxaRecusa }) : null },
    { labelKey: "inProgress", value: funil.em_andamento ?? 0,  color: "bg-orange-400" },
    { labelKey: "completed", value: funil.concluidas ?? 0,    color: "bg-green-500"  },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-4">{t("funnel.title")}</h2>
      <div className="space-y-2.5 mb-5">
        {rows.map((s) => (
          <div key={s.labelKey}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">{t(`funnel.labels.${s.labelKey}`)}</span>
                {s.sub && <span className="text-[9px] text-red-500 font-medium">({s.sub})</span>}
              </div>
              <span className="text-xs font-bold text-gray-700 tabular-nums">{s.value}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct(s.value, funil.solicitacoes ?? 1)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">{t("funnel.slaHealth", { count: total })}</p>
        {total === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">{t("funnel.noneActive")}</p>
        ) : (
          <>
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-3">
              {[
                { v: sla_health.ok,       c: "bg-green-500" },
                { v: sla_health.critico,  c: "bg-amber-400" },
                { v: sla_health.atrasada, c: "bg-red-500"   },
              ].filter((r) => r.v > 0).map((r, i) => (
                <div key={i} className={r.c} style={{ width: `${pct(r.v, total)}%` }} />
              ))}
            </div>
            <div className="space-y-1.5">
              {[
                { labelKey: "ok",       value: sla_health.ok,       dot: "bg-green-500", text: "text-green-700" },
                { labelKey: "critico",  value: sla_health.critico,   dot: "bg-amber-400", text: "text-amber-700" },
                { labelKey: "atrasada", value: sla_health.atrasada,  dot: "bg-red-500",   text: "text-red-700"   },
              ].map((r) => (
                <div key={r.labelKey} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
                    <span className="text-xs text-gray-500">{t(`sla.${r.labelKey}`)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${r.text}`}>{r.value}</span>
                    <span className="text-[10px] text-gray-400 w-8 text-right">{pct(r.value, total)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flashKeys, setFlashKeys] = useState(new Set());
  const [selectedStage, setSelectedStage] = useState(null);
  const [showGoLives, setShowGoLives] = useState(false);
  const [now, setNow] = useState(new Date());
  const prevDataRef = useRef(null);
  const intervalRef = useRef(null);

  // Atualiza "agora" a cada 10s para manter saudação e contador de refresh precisos
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: kpis } = await dashboardApi.kpis();
      if (prevDataRef.current) {
        const changed = FLASH_FIELDS.filter((k) => prevDataRef.current[k] !== kpis[k]);
        if (changed.length > 0) {
          setFlashKeys(new Set(changed));
          setTimeout(() => setFlashKeys(new Set()), 1500);
        }
      }
      prevDataRef.current = kpis;
      setData(kpis);
      setLastRefresh(new Date());
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const hour = now.getHours();
  const greeting = hour < 6 ? t("greeting.night") : hour < 12 ? t("greeting.morning") : hour < 18 ? t("greeting.afternoon") : t("greeting.night");

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {greeting}{user?.nome ? `, ${user.nome.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {lastRefresh
              ? t("header.subtitleLoaded", { refresh: refreshLabel(lastRefresh, now) })
              : t("header.subtitleLoading")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t("header.refreshing")}
            </span>
          )}
          <button
            onClick={() => load()}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t("header.refresh")}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <DashboardSkeleton />
      ) : data ? (
        <div className="space-y-5">

          {/* ── 8 KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label={t("kpi.activeImplantacoes")}
              value={data.implantacoes_em_andamento}
              icon="⚙️" color="text-blue-700"
              to="/admin/implantacoes?status=em_andamento"
              deltaLabel={data.novas_semana > 0 ? t("kpi.newThisWeek", { count: data.novas_semana }) : null}
              flashing={flashKeys.has("implantacoes_em_andamento")}
            />
            <KpiCard
              label={t("kpi.slaOverdue")}
              value={data.implantacoes_atrasadas}
              sub={t("kpi.immediateAction")}
              icon="🚨" color={data.implantacoes_atrasadas > 0 ? "text-red-700" : "text-gray-400"}
              to="/admin/implantacoes?sla_status=atrasada"
              urgent
              deltaLabel={data.atrasadas_novas_semana > 0 ? t("kpi.overdueThisWeek", { count: data.atrasadas_novas_semana }) : null}
              deltaGood={false}
              flashing={flashKeys.has("implantacoes_atrasadas")}
            />
            <KpiCard
              label={t("kpi.slaCritical")}
              value={data.implantacoes_critico}
              sub={t("kpi.lessThan3Days")}
              icon="⚠️" color={data.implantacoes_critico > 0 ? "text-amber-700" : "text-gray-400"}
              to="/admin/implantacoes?sla_status=critico"
              flashing={flashKeys.has("implantacoes_critico")}
            />
            <KpiCard
              label={t("kpi.goLivesWeek")}
              value={data.go_lives_semana ?? 0}
              icon="🚀" color="text-green-700"
              onClick={data.go_lives_lista?.length > 0 ? () => setShowGoLives(true) : undefined}
              deltaLabel={data.go_lives_semana > 0 ? t("kpi.viewDetails") : null}
              deltaGood={true}
              flashing={flashKeys.has("go_lives_semana")}
            />
            <KpiCard
              label={t("kpi.completionRate")}
              value={`${data.taxa_conclusao}%`}
              sub={t("kpi.completedCount", { count: data.implantacoes_concluidas })}
              icon="✅" color="text-emerald-700"
              deltaLabel={data.concluidas_semana > 0 ? t("kpi.thisWeek", { count: data.concluidas_semana }) : null}
              deltaGood={true}
              flashing={flashKeys.has("taxa_conclusao")}
            />
            <KpiCard
              label={t("kpi.pendingTriage")}
              value={(data.solicitacoes_novas || 0) + (data.solicitacoes_em_triagem || 0)}
              sub={t("kpi.newPlusAnalyzing")}
              icon="📥" color="text-indigo-700"
              to="/admin/triagem"
              flashing={flashKeys.has("solicitacoes_novas")}
            />
            <KpiCard
              label={t("kpi.overdueTasks")}
              value={data.tarefas_vencidas ?? 0}
              sub={t("kpi.expiredDeadline")}
              icon="📋" color={data.tarefas_vencidas > 0 ? "text-red-700" : "text-gray-400"}
              to={data.tarefas_vencidas > 0 ? "/admin/implantacoes?highlight=tarefas" : "/admin/implantacoes"}
              urgent={data.tarefas_vencidas > 0}
              flashing={flashKeys.has("tarefas_vencidas")}
            />
            {(() => {
              const venc  = data.instalacoes_sem_responsavel_vencidas ?? 0;
              const hoje  = data.instalacoes_sem_responsavel_hoje     ?? 0;
              const total = data.instalacoes_sem_responsavel          ?? 0;
              const future = total - venc - hoje;
              const subParts = [];
              if (venc   > 0) subParts.push(t("kpi.overdue", { count: venc }));
              if (hoje   > 0) subParts.push(t("kpi.todayCount", { count: hoje }));
              if (future > 0) subParts.push(t("kpi.future", { count: future }));
              const isCritico = venc > 0;
              const isUrgente = !isCritico && hoje > 0;
              return (
                <KpiCard
                  label={t("kpi.installationsNoResp")}
                  value={total}
                  sub={subParts.length > 0 ? subParts.join(" · ") : t("kpi.awaitingAssignment")}
                  icon={isCritico || isUrgente ? "🚨" : "📦"}
                  color={isCritico ? "text-red-700" : isUrgente ? "text-red-600" : total > 0 ? "text-orange-700" : "text-gray-400"}
                  to="/instalacoes?sem_responsavel=1"
                  urgent={total > 0}
                  flashing={flashKeys.has("instalacoes_sem_responsavel") || flashKeys.has("instalacoes_sem_responsavel_hoje")}
                />
              );
            })()}
          </div>

          {/* ── Alertas ── */}
          <AlertStrip data={data} />

          {/* ── Pipeline (clicável para filtrar Fila) ── */}
          {data.pipeline && (
            <PipelineKanban
              pipeline={data.pipeline}
              pipelineTotal={data.pipeline_total}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStage}
            />
          )}

          {/* ── Fila Operacional ── */}
          {data.fila && data.fila.length > 0 ? (
            <FilaOperacional
              fila={data.fila}
              filaTotal={data.fila_total}
              stageFilter={selectedStage}
              stageColorMap={Object.fromEntries((data.pipeline || []).map((s) => [s.nome, s.cor || "#6366f1"]))}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
              <p className="text-3xl mb-3">🎉</p>
              <p className="text-sm font-semibold text-gray-600">{t("empty.title")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("empty.subtitle")}</p>
            </div>
          )}

          {/* ── Bottom row: Timeline | Gráfico + Workload | Funil ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Timeline com filtros */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">{t("timeline.title")}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{t("timeline.subtitle")}</p>
              </div>
              <TimelineIntelligente items={data.atividade_recente || []} />
            </div>

            {/* Gráfico Mensal + Workload stacked */}
            <div className="flex flex-col gap-5">
              <GraficoMensal dados={data.grafico_mensal} />
              {data.workload_consultores?.length > 0 && (
                <WorkloadConsultores dados={data.workload_consultores} />
              )}
            </div>

            {/* Funil + SLA */}
            <FunilCompacto funil={data.funil} sla_health={data.sla_health} />

          </div>

        </div>
      ) : null}

      {/* ── Go Lives Modal ── */}
      {showGoLives && data?.go_lives_lista?.length > 0 && (
        <GoLivesModal lista={data.go_lives_lista} onClose={() => setShowGoLives(false)} />
      )}
    </Layout>
  );
}
