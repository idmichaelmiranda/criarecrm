from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import select, func

from app.database.connection import get_db, IS_SQLITE
from app.models.solicitacao import Solicitacao  # noqa: F401 — usado no outerjoin do timeline
from app.models.implantacao import Implantacao
from app.models.checklist import ChecklistItem
from app.models.cliente import Cliente
from app.models.timeline import TimelineEvento
from app.models.instalacao import Instalacao as InstalacaoModel
from app.services import implantacao_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_ACTIVE = ("em_andamento", "pausada")

MES_ABBR = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]


def _etapa_atual(impl) -> str:
    in_prog = sorted([e for e in impl.etapas if e.status == "em_andamento"], key=lambda e: e.ordem)
    if in_prog:
        return in_prog[-1].nome  # etapa mais avançada (maior ordem)
    pending = sorted([e for e in impl.etapas if e.status == "pendente"], key=lambda e: e.ordem)
    if pending:
        return pending[0].nome
    done = sorted([e for e in impl.etapas if e.status == "concluida"], key=lambda e: e.ordem, reverse=True)
    if done:
        return done[0].nome
    if impl.etapas:
        return sorted(impl.etapas, key=lambda e: e.ordem)[0].nome
    return ""


def _build_dynamic_pipeline(active_impls: list) -> tuple[dict, list[str]]:
    """Derive pipeline stages dynamically from active implantações' etapas.

    Returns (pipeline_dict, ordered_stage_names).
    Stages ordered by weighted average ordem across all implantações.
    """
    meta: dict[str, dict] = {}
    for impl in active_impls:
        for e in impl.etapas:
            if e.nome not in meta:
                meta[e.nome] = {"cor": e.cor or "#6366f1", "ordem_sum": 0, "ordem_cnt": 0}
            meta[e.nome]["ordem_sum"] += e.ordem
            meta[e.nome]["ordem_cnt"] += 1

    order = sorted(meta.keys(), key=lambda n: meta[n]["ordem_sum"] / meta[n]["ordem_cnt"])
    pipeline = {nome: {"cor": meta[nome]["cor"], "count": 0, "items": []} for nome in order}
    return pipeline, order


@router.get("/kpis")
def kpis(db: Session = Depends(get_db)):
    today = date.today()
    week_start = today - timedelta(days=7)

    # ── Solicitações ──────────────────────────────────────────────────────────
    total_sol = db.execute(select(func.count()).select_from(Solicitacao)).scalar_one()
    novas = db.execute(
        select(func.count()).select_from(Solicitacao).where(Solicitacao.status == "nova")
    ).scalar_one()
    em_triagem = db.execute(
        select(func.count()).select_from(Solicitacao).where(Solicitacao.status == "em_triagem")
    ).scalar_one()
    aprovadas_sol = db.execute(
        select(func.count()).select_from(Solicitacao).where(Solicitacao.status == "aprovada")
    ).scalar_one()
    recusadas_sol = db.execute(
        select(func.count()).select_from(Solicitacao).where(Solicitacao.status == "recusada")
    ).scalar_one()

    # ── Implantações (contagens) ───────────────────────────────────────────────
    total_impl = db.execute(select(func.count()).select_from(Implantacao)).scalar_one()
    em_andamento = db.execute(
        select(func.count()).select_from(Implantacao).where(Implantacao.status == "em_andamento")
    ).scalar_one()
    concluidas = db.execute(
        select(func.count()).select_from(Implantacao).where(Implantacao.status == "concluida")
    ).scalar_one()

    sla_ok = db.execute(
        select(func.count()).select_from(Implantacao)
        .where(Implantacao.status.in_(_ACTIVE), Implantacao.sla_status == "ok")
    ).scalar_one()
    sla_critico = db.execute(
        select(func.count()).select_from(Implantacao)
        .where(Implantacao.status.in_(_ACTIVE), Implantacao.sla_status == "critico")
    ).scalar_one()
    sla_atrasada = db.execute(
        select(func.count()).select_from(Implantacao).where(Implantacao.sla_status == "atrasada")
    ).scalar_one()

    total_clientes = db.execute(select(func.count()).select_from(Cliente)).scalar_one()

    # ── Deltas (últimos 7 dias) ───────────────────────────────────────────────
    novas_semana = db.execute(
        select(func.count()).select_from(Implantacao)
        .where(Implantacao.created_at >= week_start)
    ).scalar_one()
    concluidas_semana = db.execute(
        select(func.count()).select_from(Implantacao)
        .where(Implantacao.data_conclusao >= week_start, Implantacao.status == "concluida")
    ).scalar_one()
    # Implantações cujo SLA venceu nesta semana (ficaram atrasadas recentemente)
    atrasadas_novas_semana = db.execute(
        select(func.count()).select_from(Implantacao)
        .where(
            Implantacao.sla_status == "atrasada",
            Implantacao.sla_limite >= week_start,
            Implantacao.sla_limite < today,
        )
    ).scalar_one()

    # ── Go Lives (reais: data_conclusao nesta semana) ─────────────────────────
    go_lives_rows = db.execute(
        select(Implantacao)
        .options(joinedload(Implantacao.cliente))
        .where(
            Implantacao.data_conclusao >= week_start,
            Implantacao.data_conclusao <= today,
            Implantacao.status == "concluida",
        )
    ).scalars().unique().all()
    go_lives_semana = len(go_lives_rows)
    go_lives_lista = [
        {
            "id": impl.id,
            "nome": impl.nome,
            "cliente_nome": impl.cliente.razao_social if impl.cliente else "—",
            "data_conclusao": impl.data_conclusao.isoformat(),
        }
        for impl in go_lives_rows
    ]

    # ── Tarefas vencidas e sem responsável (implantações ativas) ─────────────
    tarefas_vencidas = db.execute(
        select(func.count()).select_from(ChecklistItem)
        .join(Implantacao, ChecklistItem.implantacao_id == Implantacao.id)
        .where(
            ChecklistItem.data_prazo.isnot(None),
            ChecklistItem.data_prazo < today,
            ChecklistItem.status.notin_(["concluido", "nao_aplicavel"]),
            Implantacao.status.in_(_ACTIVE),
        )
    ).scalar_one()

    tarefas_sem_responsavel = db.execute(
        select(func.count()).select_from(ChecklistItem)
        .join(Implantacao, ChecklistItem.implantacao_id == Implantacao.id)
        .where(
            ChecklistItem.responsavel.is_(None),
            ChecklistItem.status.notin_(["concluido", "nao_aplicavel"]),
            Implantacao.status.in_(_ACTIVE),
        )
    ).scalar_one()

    instalacoes_sem_responsavel = db.execute(
        select(func.count()).select_from(InstalacaoModel)
        .where(
            InstalacaoModel.responsavel_id.is_(None),
            InstalacaoModel.status.notin_(["concluida", "cancelada"]),
        )
    ).scalar_one()

    # Instalações agendadas para hoje sem responsável
    instalacoes_sem_responsavel_hoje = db.execute(
        select(func.count()).select_from(InstalacaoModel)
        .where(
            InstalacaoModel.responsavel_id.is_(None),
            InstalacaoModel.status.notin_(["concluida", "cancelada"]),
            InstalacaoModel.data_agendada == today,
        )
    ).scalar_one()

    # Instalações com data já passada e ainda sem responsável (crítico)
    instalacoes_sem_responsavel_vencidas = db.execute(
        select(func.count()).select_from(InstalacaoModel)
        .where(
            InstalacaoModel.responsavel_id.is_(None),
            InstalacaoModel.status.notin_(["concluida", "cancelada"]),
            InstalacaoModel.data_agendada < today,
        )
    ).scalar_one()

    # ── Gráfico mensal (últimos 6 meses, concluídas) ──────────────────────────
    six_months_ago = today - timedelta(days=183)
    month_expr = (
        func.strftime("%Y-%m", Implantacao.data_conclusao)
        if IS_SQLITE else
        func.to_char(Implantacao.data_conclusao, "YYYY-MM")
    )
    monthly_rows = db.execute(
        select(
            month_expr.label("month"),
            func.count().label("total"),
        )
        .where(
            Implantacao.data_conclusao.isnot(None),
            Implantacao.data_conclusao >= six_months_ago,
        )
        .group_by("month")
        .order_by("month")
    ).all()
    monthly_map = {r.month: r.total for r in monthly_rows}

    grafico_mensal = []
    for i in range(5, -1, -1):
        month = today.month - i
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        key = f"{year:04d}-{month:02d}"
        grafico_mensal.append({
            "month": key,
            "label": MES_ABBR[month - 1],
            "total": monthly_map.get(key, 0),
            "is_current": i == 0,
        })

    # ── Implantações ativas com etapas ────────────────────────────────────────
    active_impls = db.execute(
        select(Implantacao)
        .where(Implantacao.status.in_(_ACTIVE))
        .options(
            selectinload(Implantacao.etapas),
            selectinload(Implantacao.checklist),
            joinedload(Implantacao.cliente),
        )
        .order_by(Implantacao.sla_limite.asc().nulls_last(), Implantacao.created_at.asc())
    ).scalars().unique().all()

    # ── Pipeline, fila, workload ──────────────────────────────────────────────
    pipeline, stage_order = _build_dynamic_pipeline(active_impls)
    fila = []
    sla_dias_list = []
    consultores_map: dict = {}

    for impl in active_impls:
        etapa_nome = _etapa_atual(impl)
        dias_restantes = (impl.sla_limite - today).days if impl.sla_limite else None

        if impl.sla_status == "ok" and dias_restantes is not None:
            sla_dias_list.append(dias_restantes)

        _subs   = implantacao_service._build_subs_index(impl.checklist)
        _roots  = [i for i in impl.checklist if not i.parent_id and i.etapa_id is not None and not i.arquivado]
        _total, _done = implantacao_service._leaf_counts(_roots, _subs)
        live_progresso = int((_done / _total) * 100 + 0.5) if _total else 0

        # Dias na etapa atual (gargalo)
        etapa_ativa = next((e for e in impl.etapas if e.status == "em_andamento"), None)
        dias_na_etapa = None
        if etapa_ativa and etapa_ativa.data_inicio:
            dias_na_etapa = (today - etapa_ativa.data_inicio.date()).days

        item = {
            "id": impl.id,
            "codigo": impl.codigo,
            "nome": impl.nome,
            "cliente_nome": impl.cliente.razao_social if impl.cliente else "—",
            "etapa_atual": etapa_nome,
            "progresso": live_progresso,
            "sla_status": impl.sla_status,
            "sla_limite": impl.sla_limite.isoformat() if impl.sla_limite else None,
            "dias_restantes": dias_restantes,
            "dias_na_etapa": dias_na_etapa,
            "prioridade": impl.prioridade,
            "consultor": impl.consultor,
        }

        # Distribui nos buckets das etapas em_andamento (pode aparecer em múltiplas colunas)
        active_stage_names = [e.nome for e in impl.etapas if e.status == "em_andamento"]
        if not active_stage_names:
            active_stage_names = [etapa_nome] if etapa_nome else []

        for stage_name in active_stage_names:
            if stage_name in pipeline:
                pipeline[stage_name]["count"] += 1
                if len(pipeline[stage_name]["items"]) < 4:
                    pipeline[stage_name]["items"].append(item)

        fila.append(item)

        # Workload por consultor
        c = impl.consultor or "Não atribuído"
        if c not in consultores_map:
            consultores_map[c] = {"consultor": c, "total": 0, "atrasadas": 0, "prog_soma": 0}
        consultores_map[c]["total"] += 1
        if impl.sla_status == "atrasada":
            consultores_map[c]["atrasadas"] += 1
        consultores_map[c]["prog_soma"] += live_progresso

    # Sort fila by urgency
    sla_ord  = {"atrasada": 0, "critico": 1, "em_risco": 2, "ok": 3}
    prio_ord = {"critica": 0, "alta": 1, "normal": 2, "baixa": 3}
    fila.sort(key=lambda x: (
        sla_ord.get(x["sla_status"], 4),
        prio_ord.get(x["prioridade"], 4),
        x["dias_restantes"] if x["dias_restantes"] is not None else 9999,
    ))
    fila_total = len(fila)
    fila = fila[:15]

    sla_medio = round(sum(sla_dias_list) / len(sla_dias_list)) if sla_dias_list else None
    pipeline_list = [
        {"nome": nome, "cor": pipeline[nome]["cor"], "count": pipeline[nome]["count"], "items": pipeline[nome]["items"]}
        for nome in stage_order
    ]
    pipeline_total = len(active_impls)  # contagem real de implantações únicas

    workload = []
    for w in sorted(consultores_map.values(), key=lambda x: x["total"], reverse=True):
        workload.append({
            "consultor": w["consultor"],
            "total": w["total"],
            "atrasadas": w["atrasadas"],
            "progresso_medio": round(w["prog_soma"] / w["total"]) if w["total"] > 0 else 0,
        })

    # ── Timeline (enriquecida, 30 eventos) ────────────────────────────────────
    rows = db.execute(
        select(
            TimelineEvento,
            Implantacao.nome.label("impl_nome"),
            Solicitacao.razao_social.label("sol_nome"),
        )
        .outerjoin(Implantacao, TimelineEvento.implantacao_id == Implantacao.id)
        .outerjoin(Solicitacao, TimelineEvento.solicitacao_id == Solicitacao.id)
        .order_by(TimelineEvento.created_at.desc())
        .limit(30)
    ).all()

    atividade = [
        {
            "id": ev.id,
            "tipo": ev.tipo,
            "titulo": ev.titulo,
            "descricao": ev.descricao,
            "icone": ev.icone,
            "cor": ev.cor,
            "implantacao_id": ev.implantacao_id,
            "solicitacao_id": ev.solicitacao_id,
            "implantacao_nome": impl_nome,
            "solicitacao_nome": sol_nome,
            "usuario": ev.usuario,
            "created_at": ev.created_at.isoformat(),
        }
        for ev, impl_nome, sol_nome in rows
    ]

    return {
        # KPIs básicos
        "total_solicitacoes": total_sol,
        "solicitacoes_novas": novas,
        "solicitacoes_em_triagem": em_triagem,
        "total_implantacoes": total_impl,
        "implantacoes_em_andamento": em_andamento,
        "implantacoes_concluidas": concluidas,
        "implantacoes_atrasadas": sla_atrasada,
        "implantacoes_critico": sla_critico,
        "total_clientes": total_clientes,
        "taxa_conclusao": round((concluidas / total_impl * 100) if total_impl > 0 else 0, 1),
        # Deltas da semana
        "novas_semana": novas_semana,
        "concluidas_semana": concluidas_semana,
        "atrasadas_novas_semana": atrasadas_novas_semana,
        # Go Lives (reais)
        "go_lives_semana": go_lives_semana,
        "go_lives_lista": go_lives_lista,
        # Tarefas
        "tarefas_vencidas": tarefas_vencidas,
        "tarefas_sem_responsavel": tarefas_sem_responsavel,
        # Instalações
        "instalacoes_sem_responsavel": instalacoes_sem_responsavel,
        "instalacoes_sem_responsavel_hoje": instalacoes_sem_responsavel_hoje,
        "instalacoes_sem_responsavel_vencidas": instalacoes_sem_responsavel_vencidas,
        # SLA médio
        "sla_medio_dias": sla_medio,
        # Funil
        "funil": {
            "solicitacoes": total_sol,
            "aprovadas": aprovadas_sol,
            "recusadas": recusadas_sol,
            "em_andamento": em_andamento,
            "concluidas": concluidas,
        },
        # SLA Health
        "sla_health": {"ok": sla_ok, "critico": sla_critico, "atrasada": sla_atrasada},
        # Pipeline
        "pipeline": pipeline_list,
        "pipeline_total": pipeline_total,
        # Fila
        "fila": fila,
        "fila_total": fila_total,
        # Workload
        "workload_consultores": workload,
        # Gráfico mensal
        "grafico_mensal": grafico_mensal,
        # Timeline
        "atividade_recente": atividade,
    }
