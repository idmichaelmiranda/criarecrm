from datetime import datetime, date
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.implantacao import Implantacao
from app.models.etapa import ImplantacaoEtapa
from app.models.checklist import ChecklistItem
from app.models.cliente import Cliente
from app.schemas.implantacao import ImplantacaoUpdate, ChecklistItemUpdate, ChecklistItemCreate, EtapaManualUpdate
from app.services import timeline_service


def get_all(
    db: Session,
    status: str | None = None,
    sla_status: str | None = None,
    prioridade: str | None = None,
    consultor: str | None = None,
) -> list[Implantacao]:
    stmt = (
        select(Implantacao)
        .options(selectinload(Implantacao.checklist))
        .order_by(Implantacao.created_at.desc())
    )
    if status:
        stmt = stmt.where(Implantacao.status.in_(status.split(",")))
    if sla_status:
        stmt = stmt.where(Implantacao.sla_status == sla_status)
    if prioridade:
        stmt = stmt.where(Implantacao.prioridade == prioridade)
    if consultor:
        stmt = stmt.where(Implantacao.consultor.ilike(f"%{consultor}%"))
    return db.execute(stmt).scalars().all()


def get_by_id(db: Session, impl_id: int) -> Implantacao:
    from app.models.template import TemplateTarefa
    impl = db.execute(
        select(Implantacao)
        .options(
            selectinload(Implantacao.cliente),
            selectinload(Implantacao.etapas).selectinload(ImplantacaoEtapa.itens).selectinload(ChecklistItem.template_tarefa),
            selectinload(Implantacao.timeline),
            selectinload(Implantacao.comentarios),
        )
        .where(Implantacao.id == impl_id)
    ).scalar_one_or_none()
    if not impl:
        raise HTTPException(404, "Implantação não encontrada")
    return impl


def atualizar(db: Session, impl_id: int, data: ImplantacaoUpdate, usuario: str = "Sistema") -> Implantacao:
    impl = db.get(Implantacao, impl_id)
    if not impl:
        raise HTTPException(404, "Implantação não encontrada")

    old_status = impl.status
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(impl, field, value)
    impl.updated_at = datetime.now()

    if data.status and data.status != old_status:
        if data.status == "concluida":
            impl.data_conclusao = date.today()
            impl.progresso = 100
            _atualizar_sla_status(impl)
        timeline_service.log(
            db,
            tipo="status_alterado",
            titulo=f"Status alterado para {data.status}",
            descricao=f"De: {old_status} → Para: {data.status}",
            usuario=usuario,
            icone="refresh",
            cor="#6366f1",
            implantacao_id=impl_id,
        )

    db.commit()
    db.refresh(impl)
    return impl


def atualizar_checklist_item(db: Session, item_id: int, data: ChecklistItemUpdate, usuario: str = "Sistema") -> ChecklistItem:
    item = db.get(ChecklistItem, item_id)
    if not item:
        raise HTTPException(404, "Item não encontrado")

    if data.status is not None:
        old_status = item.status
        item.status = data.status
        if data.status == "concluido" and old_status != "concluido":
            item.data_conclusao = datetime.now()
            timeline_service.log(
                db,
                tipo="checklist_concluido",
                titulo=f'"{item.titulo}" concluído',
                usuario=usuario,
                icone="check-circle",
                cor="#10b981",
                implantacao_id=item.implantacao_id,
            )
        elif data.status in ("pendente", "nao_aplicavel", "bloqueado") and old_status == "concluido":
            item.data_conclusao = None
            timeline_service.log(
                db,
                tipo="checklist_desmarcado",
                titulo=f'"{item.titulo}" desmarcado',
                usuario=usuario,
                icone="x-circle",
                cor="#f59e0b",
                implantacao_id=item.implantacao_id,
            )
        elif data.status in ("pendente", "nao_aplicavel", "bloqueado"):
            item.data_conclusao = None

    if data.descricao is not None:
        item.descricao = data.descricao.strip() or None

    # New fields — use exclude_unset so None can mean "clear the value"
    update_fields = data.model_dump(exclude_unset=True)
    if "responsavel" in update_fields:
        item.responsavel = (update_fields["responsavel"] or "").strip() or None
    if "data_prazo" in update_fields:
        item.data_prazo = update_fields["data_prazo"]
    if "etapa_id" in update_fields and update_fields["etapa_id"] is not None:
        item.etapa_id = update_fields["etapa_id"]

    _recalcular_progresso(db, item.implantacao_id)
    _sincronizar_etapas(db, item.implantacao_id, usuario=usuario)

    db.commit()
    db.refresh(item)
    return item


def criar_checklist_item(db: Session, implantacao_id: int, data: ChecklistItemCreate) -> ChecklistItem:
    impl = db.get(Implantacao, implantacao_id)
    if not impl:
        raise HTTPException(404, "Implantação não encontrada")

    max_ordem = db.execute(
        select(func.coalesce(func.max(ChecklistItem.ordem), 0))
        .where(ChecklistItem.implantacao_id == implantacao_id)
    ).scalar_one()

    item = ChecklistItem(
        implantacao_id=implantacao_id,
        etapa_id=data.etapa_id,
        titulo=data.titulo,
        descricao=data.descricao,
        obrigatoria=data.obrigatoria,
        ordem=max_ordem + 1,
        status="pendente",
        responsavel=data.responsavel,
        data_prazo=data.data_prazo,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def deletar_checklist_item(db: Session, item_id: int) -> None:
    item = db.get(ChecklistItem, item_id)
    if not item:
        raise HTTPException(404, "Item não encontrado")
    implantacao_id = item.implantacao_id
    db.delete(item)
    db.flush()
    _recalcular_progresso(db, implantacao_id)
    db.commit()


def atualizar_etapa(db: Session, implantacao_id: int, etapa_id: int, data: EtapaManualUpdate, usuario: str = "Sistema") -> ImplantacaoEtapa:
    etapa = db.get(ImplantacaoEtapa, etapa_id)
    if not etapa or etapa.implantacao_id != implantacao_id:
        raise HTTPException(404, "Etapa não encontrada")

    old_status = etapa.status
    etapa.status = data.status

    if data.status == "em_andamento" and old_status != "em_andamento":
        etapa.data_inicio = etapa.data_inicio or datetime.now()
    elif data.status == "concluida":
        etapa.data_conclusao = datetime.now()
        proxima = db.execute(
            select(ImplantacaoEtapa).where(
                ImplantacaoEtapa.implantacao_id == implantacao_id,
                ImplantacaoEtapa.ordem == etapa.ordem + 1,
            )
        ).scalar_one_or_none()
        if proxima and proxima.status == "pendente":
            proxima.status = "em_andamento"
            proxima.data_inicio = proxima.data_inicio or datetime.now()
    elif data.status in ("pendente", "pulada"):
        etapa.data_conclusao = None

    _labels = {
        "em_andamento": "Em Andamento", "concluida": "Concluída",
        "pulada": "Pulada", "pendente": "Pendente", "bloqueada": "Bloqueada",
    }
    timeline_service.log(
        db,
        tipo="etapa_status_alterado",
        titulo=f'Etapa "{etapa.nome}" → {_labels.get(data.status, data.status)}',
        usuario=usuario,
        icone="flag",
        cor="#6366f1",
        implantacao_id=implantacao_id,
    )

    db.commit()
    db.refresh(etapa)
    return etapa


def adicionar_comentario(db: Session, impl_id: int, usuario: str, conteudo: str):
    from app.models.comentario import Comentario
    comentario = Comentario(
        implantacao_id=impl_id,
        usuario=usuario,
        conteudo=conteudo,
    )
    db.add(comentario)
    timeline_service.log(
        db,
        tipo="comentario",
        titulo=f"Comentário de {usuario}",
        descricao=conteudo[:120] + ("…" if len(conteudo) > 120 else ""),
        icone="message-circle",
        cor="#8b5cf6",
        implantacao_id=impl_id,
    )
    db.commit()
    db.refresh(comentario)
    return comentario


# ── Helpers internos ──────────────────────────────────────────────────────────

def _recalcular_progresso(db: Session, implantacao_id: int) -> None:
    # Exclude N/A items — they are neither done nor pending
    total = db.execute(
        select(func.count()).select_from(ChecklistItem)
        .where(
            ChecklistItem.implantacao_id == implantacao_id,
            ChecklistItem.status != "nao_aplicavel",
        )
    ).scalar_one()
    concluidos = db.execute(
        select(func.count()).select_from(ChecklistItem)
        .where(
            ChecklistItem.implantacao_id == implantacao_id,
            ChecklistItem.status == "concluido",
        )
    ).scalar_one()
    impl = db.get(Implantacao, implantacao_id)
    if impl:
        impl.progresso = round((concluidos / total) * 100) if total > 0 else 0
        impl.updated_at = datetime.now()


def _sincronizar_etapas(db: Session, implantacao_id: int, usuario: str = "Sistema") -> None:
    """Re-evaluate all etapa statuses based on current checklist state.

    Rules:
    - Etapa becomes "concluida" when ALL mandatory items are done.
    - Etapa reverts from "concluida" to "em_andamento" when a mandatory item is unchecked.
    - Etapa becomes "em_andamento" when ANY item is checked (allows parallel work across stages).
    - Etapa reverts to "pendente" when it has 0 done items AND is not the first active stage.
    - The first non-done stage always stays "em_andamento" (pipeline anchor).
    """
    db.flush()

    etapas = db.execute(
        select(ImplantacaoEtapa)
        .where(ImplantacaoEtapa.implantacao_id == implantacao_id)
        .order_by(ImplantacaoEtapa.ordem)
    ).scalars().all()

    # Cache item counts per etapa to avoid redundant queries
    etapa_stats: dict[int, tuple[int, int]] = {}  # etapa_id → (total, concluidos)
    for etapa in etapas:
        if etapa.status in ("pulada", "bloqueada"):
            etapa_stats[etapa.id] = (0, 0)
            continue
        obrigatorios = db.execute(
            select(ChecklistItem).where(
                ChecklistItem.etapa_id == etapa.id,
                ChecklistItem.obrigatoria == True,
            )
        ).scalars().all()
        total = len(obrigatorios)
        done = sum(1 for i in obrigatorios if i.status in ("concluido", "nao_aplicavel"))
        etapa_stats[etapa.id] = (total, done)

    # Pass 1: advance/regress each etapa based on item state
    for etapa in etapas:
        if etapa.status in ("pulada", "bloqueada"):
            continue
        total, done = etapa_stats[etapa.id]
        todos_feitos = total > 0 and done == total
        algum_feito = done > 0

        if todos_feitos and etapa.status != "concluida":
            etapa.status = "concluida"
            etapa.data_conclusao = etapa.data_conclusao or datetime.now()
            timeline_service.log(db, tipo="etapa_concluida",
                titulo=f'Etapa "{etapa.nome}" concluída', usuario=usuario,
                icone="flag", cor="#6366f1", implantacao_id=implantacao_id)

        elif not todos_feitos and etapa.status == "concluida":
            etapa.status = "em_andamento"
            etapa.data_conclusao = None
            timeline_service.log(db, tipo="etapa_revertida",
                titulo=f'Etapa "{etapa.nome}" reaberta', usuario=usuario,
                descricao="Item obrigatório desmarcado.", icone="refresh",
                cor="#f59e0b", implantacao_id=implantacao_id)

        elif algum_feito and etapa.status == "pendente":
            # User started working on this stage in parallel → activate it
            etapa.status = "em_andamento"
            etapa.data_inicio = etapa.data_inicio or datetime.now()

    # Pass 2: ensure pipeline anchor — the first non-done stage is always em_andamento
    primeiro_ativo = next(
        (e for e in etapas if e.status not in ("concluida", "pulada", "bloqueada")),
        None,
    )
    if primeiro_ativo and primeiro_ativo.status == "pendente":
        # Auto-advance: previous stage just completed
        primeiro_ativo.status = "em_andamento"
        primeiro_ativo.data_inicio = primeiro_ativo.data_inicio or datetime.now()

    # Pass 3: stages with 0 done items that aren't the anchor → pendente
    for etapa in etapas:
        if etapa.status != "em_andamento":
            continue
        if etapa is primeiro_ativo:
            continue
        _, done = etapa_stats[etapa.id]
        if done == 0:
            etapa.status = "pendente"
            etapa.data_inicio = None

    # Implantação completion check
    all_done = all(e.status in ("concluida", "pulada", "bloqueada") for e in etapas)
    impl = db.get(Implantacao, implantacao_id)
    if not impl:
        return

    if all_done and etapas and impl.status != "concluida":
        impl.status = "concluida"
        impl.progresso = 100
        impl.data_conclusao = date.today()
        _atualizar_sla_status(impl)
        timeline_service.log(db, tipo="implantacao_concluida",
            titulo="Implantação concluída!",
            descricao="Todas as etapas e tarefas foram concluídas com sucesso.",
            usuario=usuario, icone="trophy", cor="#f59e0b", implantacao_id=impl.id)
    elif not all_done and impl.status == "concluida":
        impl.status = "em_andamento"
        impl.data_conclusao = None
        if impl.sla_limite:
            dias = (impl.sla_limite - date.today()).days
            impl.sla_status = "atrasada" if dias < 0 else "critico" if dias <= 3 else "em_risco" if dias <= 7 else "ok"


def _verificar_conclusao_etapa(db: Session, etapa_id: int) -> None:
    """Legacy: called from atualizar_etapa (manual stage edit). Uses single-etapa path."""
    etapa = db.get(ImplantacaoEtapa, etapa_id)
    if not etapa or etapa.status == "concluida":
        return

    obrigatorios = db.execute(
        select(ChecklistItem).where(
            ChecklistItem.etapa_id == etapa_id,
            ChecklistItem.obrigatoria == True,
        )
    ).scalars().all()

    if obrigatorios and all(i.status in ("concluido", "nao_aplicavel") for i in obrigatorios):
        etapa.status = "concluida"
        etapa.data_conclusao = datetime.now()

        timeline_service.log(
            db,
            tipo="etapa_concluida",
            titulo=f'Etapa "{etapa.nome}" concluída',
            icone="flag",
            cor="#6366f1",
            implantacao_id=etapa.implantacao_id,
        )

        proxima = db.execute(
            select(ImplantacaoEtapa).where(
                ImplantacaoEtapa.implantacao_id == etapa.implantacao_id,
                ImplantacaoEtapa.ordem == etapa.ordem + 1,
            )
        ).scalar_one_or_none()

        if proxima:
            proxima.status = "em_andamento"
            proxima.data_inicio = datetime.now()
        else:
            impl = db.get(Implantacao, etapa.implantacao_id)
            if impl and impl.status != "concluida":
                impl.status = "concluida"
                impl.progresso = 100
                impl.data_conclusao = date.today()
                _atualizar_sla_status(impl)
                timeline_service.log(
                    db,
                    tipo="implantacao_concluida",
                    titulo="Implantação concluída!",
                    descricao="Todas as etapas e tarefas foram concluídas com sucesso.",
                    icone="trophy",
                    cor="#f59e0b",
                    implantacao_id=impl.id,
                )


def _atualizar_sla_status(impl: Implantacao) -> None:
    if impl.sla_limite and impl.data_conclusao:
        impl.sla_status = "ok" if impl.data_conclusao <= impl.sla_limite else "atrasada"


def stats(db: Session) -> dict:
    total = db.execute(select(func.count()).select_from(Implantacao)).scalar_one()
    em_andamento = db.execute(
        select(func.count()).select_from(Implantacao)
        .where(Implantacao.status == "em_andamento")
    ).scalar_one()
    concluidas = db.execute(
        select(func.count()).select_from(Implantacao)
        .where(Implantacao.status == "concluida")
    ).scalar_one()
    atrasadas = db.execute(
        select(func.count()).select_from(Implantacao)
        .where(Implantacao.sla_status == "atrasada")
    ).scalar_one()
    return {
        "total": total,
        "em_andamento": em_andamento,
        "concluidas": concluidas,
        "atrasadas": atrasadas,
    }
