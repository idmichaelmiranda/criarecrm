const STATUS_CFG = {
  // Solicitação
  nova:        { label: "Nova",         cls: "bg-indigo-50  text-indigo-700  border-indigo-200",  dot: "bg-indigo-400"  },
  em_triagem:  { label: "Em Triagem",   cls: "bg-amber-50   text-amber-700   border-amber-200",   dot: "bg-amber-400"   },
  aprovada:    { label: "Aprovada",     cls: "bg-green-50   text-green-700   border-green-200",   dot: "bg-green-500"   },
  recusada:              { label: "Recusada",            cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-400"     },
  aguardando_correcao:  { label: "Aguardando Correção", cls: "bg-amber-50   text-amber-700   border-amber-200",   dot: "bg-amber-400"   },
  cancelada:            { label: "Cancelada",           cls: "bg-gray-100   text-gray-600    border-gray-200",    dot: "bg-gray-400"    },
  // Implantação
  em_andamento:{ label: "Em Andamento", cls: "bg-blue-50    text-blue-700    border-blue-200",    dot: "bg-blue-500"    },
  pausada:     { label: "Pausada",      cls: "bg-orange-50  text-orange-700  border-orange-200",  dot: "bg-orange-400"  },
  concluida:   { label: "Concluída",    cls: "bg-green-50   text-green-700   border-green-200",   dot: "bg-green-500"   },
  // Etapa / Item
  pendente:    { label: "Pendente",     cls: "bg-gray-100   text-gray-600    border-gray-200",    dot: "bg-gray-400"    },
  concluido:   { label: "Concluído",    cls: "bg-green-50   text-green-700   border-green-200",   dot: "bg-green-500"   },
  bloqueada:   { label: "Bloqueada",    cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-400"     },
  bloqueado:   { label: "Bloqueado",    cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-400"     },
  nao_aplicavel:{ label: "N/A",         cls: "bg-gray-100   text-gray-500    border-gray-200",    dot: "bg-gray-300"    },
  // SLA
  no_prazo:    { label: "No Prazo",     cls: "bg-green-50   text-green-700   border-green-200",   dot: "bg-green-500"   },
  atrasada:    { label: "Atrasada",     cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-500"     },
  critico:     { label: "Crítico",      cls: "bg-orange-50  text-orange-700  border-orange-200",  dot: "bg-orange-500"  },
};

const PRIORIDADE_CFG = {
  baixa:   { label: "Baixa",    cls: "bg-gray-100  text-gray-600   border-gray-200"  },
  normal:  { label: "Normal",   cls: "bg-blue-50   text-blue-700   border-blue-200"  },
  alta:    { label: "Alta",     cls: "bg-amber-50  text-amber-700  border-amber-200" },
  critica: { label: "Crítica",  cls: "bg-red-50    text-red-700    border-red-200"   },
};

export function Badge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function PrioridadeBadge({ prioridade }) {
  const cfg = PRIORIDADE_CFG[prioridade] || PRIORIDADE_CFG.normal;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
