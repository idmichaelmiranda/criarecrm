import { useTranslation } from "react-i18next";

const STATUS_CLS = {
  // Solicitação
  nova:                 { cls: "bg-indigo-50  text-indigo-700  border-indigo-200",  dot: "bg-indigo-400"  },
  em_triagem:           { cls: "bg-amber-50   text-amber-700   border-amber-200",   dot: "bg-amber-400"   },
  aprovada:             { cls: "bg-green-50   text-green-700   border-green-200",   dot: "bg-green-500"   },
  recusada:             { cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-400"     },
  aguardando_correcao:  { cls: "bg-amber-50   text-amber-700   border-amber-200",   dot: "bg-amber-400"   },
  cancelada:            { cls: "bg-gray-100   text-gray-600    border-gray-200",    dot: "bg-gray-400"    },
  // Implantação
  em_andamento:{ cls: "bg-blue-50    text-blue-700    border-blue-200",    dot: "bg-blue-500"    },
  pausada:     { cls: "bg-orange-50  text-orange-700  border-orange-200",  dot: "bg-orange-400"  },
  concluida:   { cls: "bg-green-50   text-green-700   border-green-200",   dot: "bg-green-500"   },
  // Etapa / Item
  pendente:    { cls: "bg-gray-100   text-gray-600    border-gray-200",    dot: "bg-gray-400"    },
  concluido:   { cls: "bg-green-50   text-green-700   border-green-200",   dot: "bg-green-500"   },
  bloqueada:   { cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-400"     },
  bloqueado:   { cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-400"     },
  nao_aplicavel:{ cls: "bg-gray-100   text-gray-500    border-gray-200",    dot: "bg-gray-300"    },
  // SLA
  no_prazo:    { cls: "bg-green-50   text-green-700   border-green-200",   dot: "bg-green-500"   },
  atrasada:    { cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-500"     },
  critico:     { cls: "bg-orange-50  text-orange-700  border-orange-200",  dot: "bg-orange-500"  },
};

const PRIORIDADE_CLS = {
  baixa:   { cls: "bg-gray-100  text-gray-600   border-gray-200"  },
  normal:  { cls: "bg-blue-50   text-blue-700   border-blue-200"  },
  alta:    { cls: "bg-amber-50  text-amber-700  border-amber-200" },
  critica: { cls: "bg-red-50    text-red-700    border-red-200"   },
};

export function Badge({ status }) {
  const { t } = useTranslation("badge");
  const cfg = STATUS_CLS[status] || { cls: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
  const label = STATUS_CLS[status] ? t(`status.${status}`) : status;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {label}
    </span>
  );
}

export function PrioridadeBadge({ prioridade }) {
  const { t } = useTranslation("badge");
  const key = PRIORIDADE_CLS[prioridade] ? prioridade : "normal";
  const cfg = PRIORIDADE_CLS[key];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wide ${cfg.cls}`}>
      {t(`prioridade.${key}`)}
    </span>
  );
}
