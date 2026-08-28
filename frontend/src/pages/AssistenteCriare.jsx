import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout/Layout";
import { solicitacoesInstaladorApi } from "../services/api";
import { fmtDateTime, timeAgoFromUTC, timeUntilUTC, parseUTC } from "../utils/dateUtils";

const POLL_MS = 5000;
const PAGE_SIZE = 20;
const ETAPA_TRACK_POLL_MS = 3000;
const DISCO_LIVRE_BAIXO_PCT = 15;

// Contrato de índices combinado com quem mantém o CriareInstaller — usado só
// pra desenhar a jornada completa desde já (placeholders "pendente" pros
// índices que ainda não chegaram). O nome real reportado sempre tem prioridade
// sobre o rótulo do molde; isso é só uma prévia de onde a jornada tende a ir.
const ETAPAS_TEMPLATE = [
  { indice: 0, key: "mysql" },
  { indice: 1, key: "baixarBase" },
  { indice: 2, key: "importarBase" },
  { indice: 3, key: "baixarErp" },
  { indice: 4, key: "instalarErp" },
  { indice: 5, key: "concluido" },
];

function formatDuracao(iniciadoEm, concluidoEm) {
  if (!iniciadoEm || !concluidoEm) return null;
  const segs = Math.max(0, Math.round((parseUTC(concluidoEm) - parseUTC(iniciadoEm)) / 1000));
  if (segs < 60) return `${segs}s`;
  const min = Math.floor(segs / 60);
  const rem = segs % 60;
  return rem > 0 ? `${min}min ${rem}s` : `${min}min`;
}

const STATUS_HISTORICO = [
  { value: "", labelKey: "all" },
  { value: "aprovada", labelKey: "aprovada" },
  { value: "recusada", labelKey: "recusada" },
  { value: "expirada", labelKey: "expirada" },
  { value: "cancelada", labelKey: "cancelada" },
];

function formatCnpj(digits) {
  if (!digits || digits.length !== 14) return digits || "—";
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function Avatar({ nome, avatarUrl, size = "w-6 h-6" }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={nome} className={`${size} rounded-full object-cover shrink-0`} />;
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
    <div className={`${size} rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

const STATUS_STYLE = {
  pendente: { badge: "bg-amber-50 text-amber-700 border-amber-200", accent: "bg-amber-400" },
  aprovada: { badge: "bg-green-50 text-green-700 border-green-200", accent: "bg-green-500" },
  recusada: { badge: "bg-red-50 text-red-700 border-red-200", accent: "bg-red-500" },
  expirada: { badge: "bg-gray-100 text-gray-500 border-gray-200", accent: "bg-gray-300" },
  cancelada: { badge: "bg-gray-100 text-gray-500 border-gray-200", accent: "bg-gray-300" },
};

function StatusBadge({ status }) {
  const { t } = useTranslation("assistenteCriare");
  const style = STATUS_STYLE[status] || STATUS_STYLE.expirada;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${style.badge}`}>
      {status === "pendente" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />}
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

function decisaoDe(sol) {
  return sol.aprovadoEm || sol.recusadoEm || sol.canceladoEm || null;
}

// Célula de identidade do cliente — só nome + CNPJ. Detalhe (máquina, histórico,
// progresso) mora no painel lateral (QuickViewPanel), não na tabela.
function ClienteCell({ sol, navigate }) {
  const { t } = useTranslation("assistenteCriare");
  return (
    <div className="min-w-0">
      {sol.clienteId ? (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/clientes/${sol.clienteId}`); }}
          className="text-sm font-semibold text-gray-900 hover:text-orange-600 hover:underline text-left truncate block"
        >
          {sol.clienteNome}
        </button>
      ) : (
        <p className="text-sm font-semibold text-gray-400 italic truncate">{t("clientCell.noRecord")}</p>
      )}
      <p className="text-xs text-gray-400 mt-0.5 font-mono">{formatCnpj(sol.cnpj)}</p>
    </div>
  );
}

function ResponsavelCell({ sol, size }) {
  if (!sol.responsavelNome) return <span className="text-gray-300 text-sm">—</span>;
  return (
    <div className="flex items-center gap-2">
      <Avatar nome={sol.responsavelNome} avatarUrl={sol.responsavelAvatarUrl} size={size} />
      <span className="text-sm text-gray-600 truncate max-w-[160px]">{sol.responsavelNome}</span>
    </div>
  );
}

// ── Avaliação da máquina que pediu a instalação ─────────────────────────────────
// Cada solicitação carrega seu próprio snapshot (best-effort via WMI no instalador,
// qualquer campo pode faltar) — a avaliação abaixo transforma os números crus num
// veredito direto, pra quem aprova não precisar saber interpretar GB/SSD sozinho.
function avaliarMaquina(info) {
  if (!info) return { nivel: "unknown" };
  const temAlgumDado = info.windows?.versao || info.processador || info.memoriaRamGb || (info.disco?.tipo && info.disco.tipo !== "desconhecido");
  if (!temAlgumDado) return { nivel: "unknown" };

  const disco = info.disco || {};
  let pctLivre = null;
  if (disco.espacoTotalGb && disco.espacoLivreGb != null) {
    pctLivre = (disco.espacoLivreGb / disco.espacoTotalGb) * 100;
  }
  if (pctLivre != null && pctLivre < DISCO_LIVRE_BAIXO_PCT) {
    return { nivel: "warning", pctLivre };
  }
  return { nivel: "ok", pctLivre };
}

// Resumo de 1 linha (bolinha + rótulo curto) pra comparar a máquina de várias
// tentativas lado a lado na aba Tentativas — sem precisar abrir cada uma.
function maquinaResumoCompacto(info, t) {
  const avaliacao = avaliarMaquina(info);
  if (avaliacao.nivel === "unknown") return null;
  const isWarning = avaliacao.nivel === "warning";
  const label = isWarning
    ? t("machine.warningLabel", { pct: Math.round(avaliacao.pctLivre) })
    : [info.windows?.versao, info.disco?.tipo && info.disco.tipo !== "desconhecido" ? info.disco.tipo : null]
        .filter(Boolean).join(" · ") || t("machine.hasDataGeneric");
  return { dotColor: isWarning ? "bg-amber-400" : "bg-green-500", label };
}

// Ícone do nó + o trecho de conector que desce até o próximo — o trecho fica
// sólido/verde só quando ESTA etapa está concluída (jornada "já percorrida");
// caso contrário fica tracejado/cinza (jornada ainda não percorrida até ali).
function StepperIcone({ status, isLast }) {
  const isDone = status === "concluida";
  const isFailed = status === "falhou";
  const isActive = status === "em_andamento";

  const corNo = isFailed
    ? "bg-red-500 text-white"
    : isDone
    ? "bg-green-500 text-white"
    : isActive
    ? "bg-white border-2 border-orange-400 text-orange-500"
    : "bg-white border-2 border-dashed border-gray-200 text-gray-300";

  return (
    <div className="flex flex-col items-center w-6 shrink-0 self-stretch">
      <div className="relative w-6 h-6 shrink-0">
        {isActive && <span className="absolute inset-0 rounded-full bg-orange-400 opacity-60 animate-ping" />}
        <div className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${corNo}`}>
          {isDone ? "✓" : isFailed ? "✕" : isActive ? <span className="w-2 h-2 rounded-full bg-orange-400" /> : ""}
        </div>
      </div>
      {!isLast && (
        <div className={`w-0 flex-1 mt-0.5 border-l-2 ${isDone ? "border-green-300 border-solid" : "border-gray-200 border-dashed"}`} />
      )}
    </div>
  );
}

function StepperRow({ etapa, isLast }) {
  const isDone = etapa.status === "concluida";
  const isFailed = etapa.status === "falhou";
  const isActive = etapa.status === "em_andamento";
  const isPending = etapa.status === "pendente";

  const horaFim = etapa.concluidoEm ? parseUTC(etapa.concluidoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  const duracao = isDone ? formatDuracao(etapa.iniciadoEm, etapa.concluidoEm) : null;

  return (
    <li className="flex gap-3">
      <StepperIcone status={etapa.status} isLast={isLast} />
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold truncate ${isFailed ? "text-red-600" : isPending ? "text-gray-400" : "text-gray-800"}`}>
            {etapa.nome}
          </span>
          {horaFim && <span className="text-[11px] text-gray-400 shrink-0">{horaFim}</span>}
        </div>
        {isActive && (
          <div className="mt-1.5">
            {etapa.percentual != null && (
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 animate-pulse transition-all" style={{ width: `${Math.min(100, Math.max(0, etapa.percentual))}%` }} />
              </div>
            )}
            {etapa.mensagem && <p className="text-xs text-gray-500 mt-1 truncate" title={etapa.mensagem}>{etapa.mensagem}</p>}
          </div>
        )}
        {isFailed && etapa.mensagem && <p className="text-xs text-red-500 mt-1 truncate" title={etapa.mensagem}>{etapa.mensagem}</p>}
        {isDone && etapa.mensagem && <p className="text-xs text-gray-400 mt-1 truncate" title={etapa.mensagem}>{etapa.mensagem}</p>}
        {isDone && duracao && <p className="text-[11px] text-gray-300 mt-0.5">{duracao}</p>}
      </div>
    </li>
  );
}

function MiniCircularProgress({ value }) {
  const r = 26, c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={value >= 100 ? "#22c55e" : "#f97316"} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-gray-800">{value}%</span>
      </div>
    </div>
  );
}

// ── Abas do painel lateral (QuickViewPanel) ─────────────────────────────────────

// Botão (i) que abre um popover explicando um veredito — mesmo padrão de popover
// já usado no seletor de idioma (getBoundingClientRect + portal + fecha ao clicar
// fora), pra não depender de position:absolute preso ao scroll do painel.
function InfoPopover({ children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function toggle(e) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 272) });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-current opacity-60 hover:opacity-100 transition-opacity shrink-0"
      >
        i
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div ref={panelRef} className="fixed z-50 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 p-3.5" style={{ top: pos.top, left: pos.left }}>
            {children}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// Specs da máquina — não é mais uma aba própria, faz parte da Visão Geral: quem
// abre o painel já vê tudo da tentativa em foco (status, responsável e máquina)
// sem precisar trocar de aba pra isso.
function MaquinaSection({ info }) {
  const { t } = useTranslation("assistenteCriare");
  const avaliacao = avaliarMaquina(info);

  if (avaliacao.nivel === "unknown") {
    return (
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("quickView.machine")}</p>
        <p className="text-sm text-gray-300">{t("machine.noDataFull")}</p>
      </div>
    );
  }

  const isWarning = avaliacao.nivel === "warning";
  const disco = info.disco || {};
  const temUso = disco.espacoTotalGb && disco.espacoLivreGb != null;
  const pctUsado = temUso ? Math.round(((disco.espacoTotalGb - disco.espacoLivreGb) / disco.espacoTotalGb) * 100) : null;
  const pctLivre = avaliacao.pctLivre;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("quickView.machine")}</p>
        <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${isWarning ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isWarning ? "bg-amber-400" : "bg-green-500"}`} />
          <span className={`text-sm font-semibold flex-1 ${isWarning ? "text-amber-700" : "text-green-700"}`}>
            {isWarning ? t("machine.verdictWarning") : t("machine.verdictOk")}
          </span>
          <InfoPopover>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">{t("machine.criteriaTitle")}</p>
            <div className="flex items-start gap-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 ${
                pctLivre == null ? "bg-gray-100 text-gray-400" : isWarning ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
              }`}>
                {pctLivre == null ? "?" : isWarning ? "✕" : "✓"}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700">{t("machine.criteriaDisk")}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {pctLivre == null
                    ? t("machine.criteriaDiskUnavailable")
                    : t(isWarning ? "machine.criteriaDiskWarningDetail" : "machine.criteriaDiskOkDetail", {
                        pct: Math.round(pctLivre), min: DISCO_LIVRE_BAIXO_PCT,
                      })}
                </p>
              </div>
            </div>
          </InfoPopover>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("machine.fields.os")}</p>
        <p className="text-sm text-gray-700">
          {info.windows?.versao || "—"}
          {info.windows?.build && <span className="text-gray-400"> · build {info.windows.build}</span>}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("machine.fields.hardware")}</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400 shrink-0">{t("machine.fields.processor")}</span>
            <span className="text-gray-700 font-medium text-right" title={info.processador || ""}>{info.processador || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">{t("machine.fields.cores")}</span>
            <span className="text-gray-700 font-medium">{info.nucleos ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">{t("machine.fields.ram")}</span>
            <span className="text-gray-700 font-medium">{info.memoriaRamGb ? `${info.memoriaRamGb} GB` : "—"}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{t("machine.fields.storage")}</p>
          <span className="text-xs text-gray-700 font-medium">{disco.tipo && disco.tipo !== "desconhecido" ? disco.tipo : "—"}</span>
        </div>
        {temUso ? (
          <>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${isWarning ? "bg-amber-400" : "bg-gray-400"}`} style={{ width: `${pctUsado}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {t("machine.storageUsage", { free: Math.round(disco.espacoLivreGb), total: Math.round(disco.espacoTotalGb) })}
            </p>
          </>
        ) : disco.espacoLivreGb != null ? (
          <p className="text-xs text-gray-400 mt-1.5">{t("machine.diskFree", { count: Math.round(disco.espacoLivreGb) })}</p>
        ) : (
          <p className="text-xs text-gray-300">—</p>
        )}
      </div>
    </div>
  );
}

function ProgressoTab({ sol }) {
  const { t } = useTranslation("assistenteCriare");
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await solicitacoesInstaladorApi.etapas(sol.id);
      setEtapas(data);
    } catch {
      // silencioso — o próximo poll tenta de novo, igual ao resto da tela
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sol.id]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), ETAPA_TRACK_POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-5 h-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Item sintético — não vem do instalador (que só reporta a partir da primeira
  // etapa dele), é o marco da própria aprovação (sol.aprovadoEm), sempre presente
  // já que essa aba só existe quando a solicitação está aprovada.
  const etapaLiberada = {
    indiceEtapa: -1,
    nome: t("tracking.released"),
    status: "concluida",
    mensagem: sol.responsavelNome ? t("tracking.releasedBy", { nome: sol.responsavelNome }) : null,
    concluidoEm: sol.aprovadoEm,
  };

  // Monta a jornada completa: molde conhecido (contrato com o instalador) com
  // placeholder "pendente" pros índices que ainda não chegaram, dado real
  // sempre tem prioridade sobre o rótulo do molde. Etapa reportada fora do
  // molde (contrato mudou/estendeu) entra no fim, na ordem que veio.
  const porIndice = new Map(etapas.map((e) => [e.indiceEtapa, e]));
  const doMolde = ETAPAS_TEMPLATE.map(({ indice, key }) => {
    const reportada = porIndice.get(indice);
    porIndice.delete(indice);
    return reportada || { indiceEtapa: indice, nome: t(`tracking.steps.${key}`), status: "pendente" };
  });
  const extras = [...porIndice.values()].sort((a, b) => a.indiceEtapa - b.indiceEtapa);
  const linha = [etapaLiberada, ...doMolde, ...extras];

  const concluidasDoMolde = doMolde.filter((e) => e.status === "concluida").length;
  const pctGeral = Math.round((concluidasDoMolde / ETAPAS_TEMPLATE.length) * 100);
  const etapaComFalha = linha.find((e) => e.status === "falhou");

  // Total reportado pelo instalador (última chamada é a fonte mais confiável) —
  // mostrado sempre, não só quando algo está em andamento, pra um descompasso
  // (ex.: instalador pulando/reaproveitando índice) ficar visível na hora, sem
  // precisar comparar manualmente com o molde.
  const totalEtapas = etapas.at(-1)?.totalEtapas;

  return (
    <>
      <div className="flex items-center gap-4 pb-1">
        <MiniCircularProgress value={pctGeral} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            {t("tracking.stepsCount", { done: concluidasDoMolde, total: ETAPAS_TEMPLATE.length })}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
            {t("tracking.liveUpdate")}
          </p>
          {totalEtapas != null && totalEtapas !== etapas.length && (
            <p className="text-[11px] text-amber-600 mt-0.5">{t("tracking.reportedOf", { count: etapas.length, total: totalEtapas })}</p>
          )}
        </div>
      </div>

      {etapaComFalha && (
        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0">✕</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700">{t("tracking.failedTitle", { nome: etapaComFalha.nome })}</p>
            {etapaComFalha.mensagem && <p className="text-[11px] text-red-500 mt-0.5">{etapaComFalha.mensagem}</p>}
          </div>
        </div>
      )}

      <ol>
        {linha.map((e, i) => <StepperRow key={e.indiceEtapa} etapa={e} isLast={i === linha.length - 1} />)}
      </ol>
    </>
  );
}

// Linha do tempo com TODAS as tentativas do CNPJ, inclusive a que já está aberta
// (marcada "atual") — cada uma com seu próprio resumo de máquina lado a lado, pra
// dar pra comparar sem abrir uma por uma e sem "sumir" a que você já estava vendo.
function TentativasTab({ tentativas, currentId, onSelect }) {
  const { t } = useTranslation("assistenteCriare");
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        {t("group.attemptsCount", { count: tentativas.length })}
      </p>
      {tentativas.map((att) => {
        const isCurrent = att.id === currentId;
        const resumo = maquinaResumoCompacto(att.maquinaInfo, t);
        return (
          <div
            key={att.id}
            onClick={() => !isCurrent && onSelect(att.id)}
            className={`px-3.5 py-3 rounded-xl border transition-colors ${
              isCurrent ? "border-orange-200 bg-orange-50/50" : "border-gray-100 hover:border-orange-200 hover:bg-orange-50/40 cursor-pointer"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <StatusBadge status={att.status} />
                {isCurrent && (
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">{t("quickView.current")}</span>
                )}
              </div>
              <span className="text-[11px] text-gray-400 shrink-0">{timeAgoFromUTC(att.criadoEm)}</span>
            </div>
            <ResponsavelCell sol={att} size="w-5 h-5" />
            {resumo && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 mt-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${resumo.dotColor}`} />
                <span>{resumo.label}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Painel lateral — mesmo padrão do QuickViewPanel de Implantações: docado ao
// lado do conteúdo (não sobrepõe), sticky, com abas. Aqui as abas são condicionais
// (Progresso só se aprovada, Histórico só se há outras tentativas do mesmo CNPJ).
function QuickViewPanel({ solId, solicitacoes, onClose, navigate, onAprovar, onRecusar, onSelectAttempt, actingId }) {
  const { t } = useTranslation("assistenteCriare");
  const [tab, setTab] = useState("geral");
  const [showAcoes, setShowAcoes] = useState(false);

  useEffect(() => { setTab("geral"); setShowAcoes(false); }, [solId]);

  const sol = solicitacoes.find((s) => s.id === solId);
  if (!sol) return null;

  const isPendente = sol.status === "pendente";
  // Inclui a própria tentativa atual — antes ela ficava só implícita na aba Visão
  // Geral e "sumia" daqui, o que confundia mais do que ajudava.
  const tentativas = solicitacoes
    .filter((s) => s.cnpj === sol.cnpj)
    .sort((a, b) => parseUTC(b.criadoEm) - parseUTC(a.criadoEm));

  const tabs = [
    { id: "geral", label: t("quickView.tabs.geral") },
    ...(sol.status === "aprovada" ? [{ id: "progresso", label: t("quickView.tabs.progresso") }] : []),
    ...(tentativas.length > 1 ? [{ id: "tentativas", label: t("quickView.tabs.tentativas") }] : []),
  ];

  return (
    <div
      className="w-full max-w-md shrink-0 sticky top-4 bg-white rounded-2xl border border-gray-100 shadow-lg flex flex-col"
      style={{ maxHeight: "calc(100vh - 2rem)" }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between mb-2">
          <StatusBadge status={sol.status} />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <h2 className="text-base font-bold text-gray-900 leading-tight truncate">
          {sol.clienteNome || t("clientCell.noRecord")}
        </h2>
        <p className="text-xs font-mono text-gray-400 mt-0.5">{formatCnpj(sol.cnpj)}</p>

        <div className="flex gap-4 mt-4 -mb-4 border-b border-gray-100 overflow-x-auto">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === tb.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {tab === "geral" && (
          <>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                {isPendente ? t("quickView.expiresIn") : t("quickView.decidedOn")}
              </p>
              {isPendente ? (
                <p className="text-2xl font-bold text-amber-600" title={fmtDateTime(sol.expiraEm)}>{timeUntilUTC(sol.expiraEm)}</p>
              ) : decisaoDe(sol) ? (
                <p className="text-sm text-gray-700 font-medium">{fmtDateTime(decisaoDe(sol))}</p>
              ) : (
                <p className="text-sm text-gray-400">—</p>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("quickView.responsible")}</p>
              <ResponsavelCell sol={sol} />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("quickView.information")}</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">{t("quickView.createdAt")}</span>
                  <span className="text-gray-700 font-medium">{fmtDateTime(sol.criadoEm)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">{t("quickView.cnpj")}</span>
                  <span className="text-gray-700 font-medium font-mono">{formatCnpj(sol.cnpj)}</span>
                </div>
              </div>
            </div>

            <MaquinaSection info={sol.maquinaInfo} />
          </>
        )}

        {tab === "progresso" && <ProgressoTab sol={sol} />}
        {tab === "tentativas" && <TentativasTab tentativas={tentativas} currentId={sol.id} onSelect={onSelectAttempt} />}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0 relative">
        {sol.clienteId ? (
          <button
            onClick={() => navigate(`/admin/clientes/${sol.clienteId}`)}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t("quickView.viewClient")}
          </button>
        ) : <div className="flex-1" />}

        {isPendente && (
          <div className="relative">
            <button
              onClick={() => setShowAcoes((v) => !v)}
              disabled={actingId === sol.id}
              className="h-full px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {actingId === sol.id ? t("actions.waiting") : t("quickView.actions")}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAcoes && (
              <div className="absolute bottom-full right-0 mb-2 w-40 bg-white rounded-xl border border-gray-100 shadow-lg py-1.5 z-10">
                <button
                  onClick={() => { setShowAcoes(false); onAprovar(sol); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors"
                >
                  {t("actions.approve")}
                </button>
                <button
                  onClick={() => { setShowAcoes(false); onRecusar(sol); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  {t("actions.reject")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssistenteCriare() {
  const { t } = useTranslation("assistenteCriare");
  const navigate = useNavigate();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("pendentes");
  const [search, setSearch]             = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [actingId, setActingId]         = useState(null);
  const [toast, setToast]               = useState(null);
  const [quickViewId, setQuickViewId]   = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await solicitacoesInstaladorApi.listar();
      setSolicitacoes(data);
    } catch {
      if (!silent) setToast({ type: "error", text: t("toast.loadError") });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [load]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab, search, statusFiltro]);

  function tratarErro(err, errorKey) {
    const msg = err.message || "";
    if (msg.includes("não está mais pendente")) {
      setToast({ type: "info", text: t("toast.alreadyAnswered") });
      load(true);
    } else {
      setToast({ type: "error", text: msg || t(`toast.${errorKey}`) });
    }
  }

  async function handleAprovar(sol) {
    setActingId(sol.id);
    try {
      await solicitacoesInstaladorApi.aprovar(sol.id);
      setToast({ type: "success", text: t("toast.approveSuccess", { nome: sol.clienteNome || formatCnpj(sol.cnpj) }) });
      await load(true);
    } catch (err) {
      tratarErro(err, "errorApprove");
    } finally {
      setActingId(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function handleRecusar(sol) {
    setActingId(sol.id);
    try {
      await solicitacoesInstaladorApi.recusar(sol.id);
      setToast({ type: "info", text: t("toast.rejectSuccess", { nome: sol.clienteNome || formatCnpj(sol.cnpj) }) });
      await load(true);
    } catch (err) {
      tratarErro(err, "errorReject");
    } finally {
      setActingId(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  const pendentes = solicitacoes.filter((s) => s.status === "pendente")
    .sort((a, b) => parseUTC(a.expiraEm) - parseUTC(b.expiraEm));
  const historico = solicitacoes.filter((s) => s.status !== "pendente");

  let lista = tab === "pendentes" ? pendentes : historico;
  if (tab === "historico" && statusFiltro) lista = lista.filter((s) => s.status === statusFiltro);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    lista = lista.filter((s) =>
      (s.clienteNome || "").toLowerCase().includes(q) ||
      (qDigits && s.cnpj.includes(qDigits))
    );
  }

  // No histórico sem filtro de status, agrupa por CNPJ: a lista mostra só a
  // tentativa mais recente de cada cliente, com um badge de quantas tentativas
  // existem — as demais ficam a 1 clique, na aba Histórico do painel lateral.
  // Com filtro de status ativo, mostra a lista crua (agrupar confundiria "última
  // tentativa" com "tentativa que bateu o filtro").
  const agrupar = tab === "historico" && !statusFiltro;
  let grupos = [];
  if (agrupar) {
    const porCnpj = new Map();
    for (const sol of lista) {
      if (!porCnpj.has(sol.cnpj)) porCnpj.set(sol.cnpj, []);
      porCnpj.get(sol.cnpj).push(sol);
    }
    grupos = Array.from(porCnpj.values())
      .map((tentativas) => {
        const ordenadas = [...tentativas].sort((a, b) => parseUTC(b.criadoEm) - parseUTC(a.criadoEm));
        return { ultima: ordenadas[0], total: ordenadas.length };
      })
      .sort((a, b) => parseUTC(b.ultima.criadoEm) - parseUTC(a.ultima.criadoEm));
  }

  // Normaliza os dois modos (agrupado / lista crua) numa forma só, pra renderizar
  // a tabela com um único map — cada linha é 1 solicitação representante + quantas
  // tentativas ela resume (0/1 = nenhuma tentativa anterior a mostrar).
  const itens = agrupar
    ? grupos.map((g) => ({ sol: g.ultima, attemptsCount: g.total }))
    : lista.map((s) => ({ sol: s, attemptsCount: 0 }));
  const visiveis = itens.slice(0, visibleCount);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("header.title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("header.subtitle")}</p>
        </div>
        {pendentes.length > 0 && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {t("header.pendingBadge", { count: pendentes.length })}
          </div>
        )}
      </div>

      {/* A partir daqui: tabela e painel de detalhe dividem a largura lado a
          lado, mesmo padrão da tela de Implantações — o painel nunca cobre o
          cabeçalho acima. */}
      <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setTab("pendentes")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "pendentes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t("tabs.pending")}
              {pendentes.length > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendentes.length}
                </span>
              )}
            </button>
            <button onClick={() => setTab("historico")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "historico" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t("tabs.history")}
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search.placeholder")}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 bg-white shadow-sm" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {tab === "historico" && (
            <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400">
              {STATUS_HISTORICO.map((s) => <option key={s.value} value={s.value}>{t(`statusHistorico.${s.labelKey}`)}</option>)}
            </select>
          )}

          <span className="text-xs text-gray-400 ml-auto">
            {agrupar
              ? `${t("counter.clients", { count: grupos.length })} · ${t("counter.requests", { count: lista.length })}`
              : t("counter.requests", { count: lista.length })}
          </span>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            </div>
          ) : visiveis.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {search || statusFiltro
                  ? t("empty.noneForFilter")
                  : tab === "pendentes" ? t("empty.nonePending") : t("empty.noneHistory")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="p-0 w-1" />
                    <th className="text-left px-5 py-3">{t("table.client")}</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">{t("table.createdAt")}</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">
                      {tab === "pendentes" ? t("table.expiresAt") : t("table.decidedAt")}
                    </th>
                    <th className="text-left px-4 py-3">{agrupar ? t("table.lastAttemptStatus") : t("table.status")}</th>
                    <th className="px-4 py-3 w-52" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visiveis.map(({ sol, attemptsCount }) => {
                    const isPendente = sol.status === "pendente";
                    return (
                      <tr key={sol.id} onClick={() => setQuickViewId(sol.id)}
                        className="group hover:bg-gray-50/60 transition-colors cursor-pointer">
                        <td className={`p-0 ${STATUS_STYLE[sol.status]?.accent || STATUS_STYLE.expirada.accent}`} style={{ width: "4px", minWidth: "4px" }} />
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <ClienteCell sol={sol} navigate={navigate} />
                            {attemptsCount > 1 && (
                              <span className="ml-auto shrink-0 text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {t("group.attemptsCount", { count: attemptsCount })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap" title={fmtDateTime(sol.criadoEm)}>
                          {timeAgoFromUTC(sol.criadoEm)}
                        </td>
                        <td className="px-4 py-4 hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap">
                          {isPendente ? (
                            <span title={fmtDateTime(sol.expiraEm)}>{t("table.expiresPrefix", { time: timeUntilUTC(sol.expiraEm) })}</span>
                          ) : decisaoDe(sol) ? (
                            <span title={timeAgoFromUTC(decisaoDe(sol))}>{fmtDateTime(decisaoDe(sol))}</span>
                          ) : (
                            <span>{fmtDateTime(sol.expiraEm)}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={sol.status} />
                        </td>
                        <td className="px-4 py-4">
                          {isPendente ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={(e) => { e.stopPropagation(); handleRecusar(sol); }} disabled={actingId === sol.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors disabled:opacity-50">
                                {t("actions.reject")}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleAprovar(sol); }} disabled={actingId === sol.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm">
                                {actingId === sol.id ? t("actions.waiting") : t("actions.approve")}
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <svg className="w-4 h-4 text-gray-200 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {visiveis.length < itens.length && (
            <div className="flex justify-center py-4 border-t border-gray-100">
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
                {t("loadMore.button", { count: itens.length - visiveis.length })}
              </button>
            </div>
          )}
        </div>
      </div>

      {quickViewId && (
        <QuickViewPanel
          solId={quickViewId}
          solicitacoes={solicitacoes}
          onClose={() => setQuickViewId(null)}
          navigate={navigate}
          onAprovar={handleAprovar}
          onRecusar={handleRecusar}
          onSelectAttempt={setQuickViewId}
          actingId={actingId}
        />
      )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium border max-w-sm ${
          toast.type === "success" ? "bg-white border-green-200 text-green-800"
          : toast.type === "error" ? "bg-white border-red-200 text-red-800"
          : "bg-white border-gray-200 text-gray-700"
        }`}>
          {toast.text}
        </div>
      )}
    </Layout>
  );
}
