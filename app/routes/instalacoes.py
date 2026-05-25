from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func

import json

from app.database.connection import get_db
from app.config import BACKEND_URL
from app.models.instalacao import Instalacao, InstalacaoChecklist, InstalacaoComentario
from app.models.cliente import Cliente
from app.models.usuario import Usuario
from app.models.template import Template, TemplateEtapa, TemplateTarefa
from pydantic import BaseModel as PydanticBase

from app.schemas.instalacao import (
    InstalacaoCreate, InstalacaoUpdate,
    InstalacaoListResponse, InstalacaoFullResponse,
    ChecklistItemCreate, ChecklistItemUpdate,
    ComentarioCreate, ComentarioResponse,
    TipoInstalacaoInfo,
)

router = APIRouter(prefix="/instalacoes", tags=["instalacoes"])

# Prefixo do código: IN-YYYYMMDD-XXXX
def _gerar_codigo(db: Session) -> str:
    hoje = date.today().strftime("%Y%m%d")
    count = db.execute(
        select(func.count()).select_from(Instalacao)
    ).scalar_one()
    return f"IN-{hoje}-{count + 1:04d}"


def _load(instalacao_id: int, db: Session) -> Instalacao:
    inst = db.execute(
        select(Instalacao)
        .options(
            selectinload(Instalacao.checklist),
            selectinload(Instalacao.comentarios),
            selectinload(Instalacao.responsavel),
        )
        .where(Instalacao.id == instalacao_id)
    ).scalar_one_or_none()
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    return inst


def _to_list_response(inst: Instalacao, cliente: Cliente | None) -> InstalacaoListResponse:
    item = InstalacaoListResponse.model_validate(inst)
    item.cliente_nome = cliente.razao_social if cliente else None
    item.cliente_cnpj = cliente.cnpj if cliente else None
    item.responsavel_nome = inst.responsavel.nome if inst.responsavel else None
    if inst.responsavel and inst.responsavel.avatar_path:
        item.responsavel_avatar_url = f"{BACKEND_URL}/uploads/avatars/{inst.responsavel.avatar_path}"
    return item


def _to_full_response(inst: Instalacao, db: Session | None = None) -> InstalacaoFullResponse:
    resp = InstalacaoFullResponse.model_validate(inst)
    resp.responsavel_nome = inst.responsavel.nome if inst.responsavel else None
    if inst.responsavel and inst.responsavel.avatar_path:
        resp.responsavel_avatar_url = f"{BACKEND_URL}/uploads/avatars/{inst.responsavel.avatar_path}"
    if db:
        # For single-type installs use tipo; for multi-type use first tipo
        from app.schemas.instalacao import _parse_tipos
        tipos = _parse_tipos(inst)
        primary = tipos[0] if tipos else inst.tipo
        # Normaliza: evita duplo prefixo quando o slug já é "instalacao_xxx"
        primary_slug = primary.removeprefix("instalacao_")
        template_tipo = f"instalacao_{primary_slug}"
        t = db.execute(
            select(Template).where(Template.tipo == template_tipo, Template.ativo == True)
        ).scalar_one_or_none()
        if t:
            resp.template_id = t.id
            resp.template_pop_pdf_path = t.pop_pdf_path
    return resp


def _recalcular_progresso(inst: Instalacao) -> None:
    total = len(inst.checklist)
    if total == 0:
        inst.progresso = 0
        return
    concluidos = sum(1 for i in inst.checklist if i.status == "concluido")
    inst.progresso = round(concluidos / total * 100)


def _checklist_from_template(tipo: str, db: Session) -> list[tuple[str, bool]]:
    """Busca tarefas do template de instalação. Retorna lista de (titulo, obrigatoria)."""
    # aceita tanto "pdv" (legado) quanto "instalacao_pdv" (novo padrão)
    template_tipo = tipo if tipo.startswith("instalacao_") else f"instalacao_{tipo}"
    t = db.execute(
        select(Template).where(Template.tipo == template_tipo, Template.ativo == True)
    ).scalar_one_or_none()
    if t:
        tarefas = db.execute(
            select(TemplateTarefa)
            .join(TemplateEtapa)
            .where(TemplateEtapa.template_id == t.id)
            .order_by(TemplateEtapa.ordem, TemplateTarefa.ordem)
        ).scalars().all()
        if tarefas:
            return [(ta.titulo, ta.obrigatoria) for ta in tarefas]
    # fallback
    return [
        ("Levantamento de requisitos", True),
        ("Instalação / configuração",  True),
        ("Testes e validação",         True),
        ("Aprovação do cliente",       True),
    ]


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[InstalacaoListResponse])
def listar(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.responsavel))
        .order_by(Instalacao.created_at.desc())
    ).scalars().all()
    return [_to_list_response(inst, db.get(Cliente, inst.cliente_id)) for inst in rows]


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    rows = db.execute(select(Instalacao)).scalars().all()
    return {
        "total": len(rows),
        "agendadas": sum(1 for r in rows if r.status == "agendada"),
        "em_execucao": sum(1 for r in rows if r.status == "em_execucao"),
        "concluidas": sum(1 for r in rows if r.status == "concluida"),
        "canceladas": sum(1 for r in rows if r.status == "cancelada"),
    }


@router.get("/tipos", response_model=list[TipoInstalacaoInfo])
def listar_tipos(db: Session = Depends(get_db)):
    """Retorna todos os tipos de produto de instalação (ativos e inativos)."""
    templates = db.execute(
        select(Template)
        .options(selectinload(Template.etapas).selectinload(TemplateEtapa.tarefas))
        .where(Template.tipo.like("instalacao_%"))
        .order_by(Template.nome)
    ).scalars().all()
    return [
        TipoInstalacaoInfo(
            id=t.id,
            nome=t.nome,
            tipo=t.tipo,
            cor=t.etapas[0].cor if t.etapas else "#6366f1",
            n_tarefas=sum(len(e.tarefas) for e in t.etapas),
            ativo=t.ativo,
        )
        for t in templates
    ]


@router.post("/", response_model=InstalacaoFullResponse, status_code=201)
def criar(data: InstalacaoCreate, db: Session = Depends(get_db)):
    if not db.get(Cliente, data.cliente_id):
        raise HTTPException(404, "Cliente não encontrado")
    if data.responsavel_id and not db.get(Usuario, data.responsavel_id):
        raise HTTPException(404, "Usuário responsável não encontrado")

    tipo_primario = data.tipos[0]
    inst = Instalacao(
        codigo=_gerar_codigo(db),
        cliente_id=data.cliente_id,
        tipo=tipo_primario,
        tipos_json=json.dumps(data.tipos),
        quantidade=data.quantidade,
        prioridade=data.prioridade,
        responsavel_id=data.responsavel_id,
        observacoes=data.observacoes,
        data_agendada=data.data_agendada,
        contato_nome=data.contato_nome,
        contato_telefone=data.contato_telefone,
    )
    db.add(inst)
    db.flush()

    # Merge checklists from all selected types
    ordem = 1
    for tipo in data.tipos:
        for titulo, obrigatoria in _checklist_from_template(tipo, db):
            db.add(InstalacaoChecklist(
                instalacao_id=inst.id,
                titulo=titulo,
                obrigatoria=obrigatoria,
                ordem=ordem,
                tipo=tipo,
            ))
            ordem += 1

    db.commit()
    return _to_full_response(_load(inst.id, db), db)


@router.get("/{instalacao_id}", response_model=InstalacaoFullResponse)
def obter(instalacao_id: int, db: Session = Depends(get_db)):
    return _to_full_response(_load(instalacao_id, db), db)


@router.patch("/{instalacao_id}", response_model=InstalacaoFullResponse)
def atualizar(instalacao_id: int, data: InstalacaoUpdate, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(inst, field, value)

    if inst.status == "concluida" and not inst.data_conclusao:
        inst.data_conclusao = date.today()

    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.delete("/{instalacao_id}", status_code=204)
def deletar(instalacao_id: int, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    db.delete(inst)
    db.commit()


# ── Checklist ─────────────────────────────────────────────────────────────────

@router.patch("/{instalacao_id}/checklist/{item_id}", response_model=InstalacaoFullResponse)
def atualizar_item(instalacao_id: int, item_id: int, data: ChecklistItemUpdate, db: Session = Depends(get_db)):
    item = db.get(InstalacaoChecklist, item_id)
    if not item or item.instalacao_id != instalacao_id:
        raise HTTPException(404, "Item não encontrado")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    if data.status == "concluido" and not item.data_conclusao:
        item.data_conclusao = datetime.now(timezone.utc)
    elif data.status in ("pendente", "nao_aplicavel"):
        item.data_conclusao = None

    # Recalcular progresso
    inst = _load(instalacao_id, db)
    _recalcular_progresso(inst)

    # Única transição automática permitida: agendada → em_execucao ao marcar o primeiro item.
    # A transição para "concluida" é exclusiva do endpoint /finalizar.
    alguma_concluida = any(i.status == "concluido" for i in inst.checklist)
    if inst.status == "agendada" and alguma_concluida:
        inst.status = "em_execucao"

    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.post("/{instalacao_id}/checklist", response_model=InstalacaoFullResponse, status_code=201)
def adicionar_item(instalacao_id: int, data: ChecklistItemCreate, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")

    ordem = db.execute(
        select(func.max(InstalacaoChecklist.ordem))
        .where(InstalacaoChecklist.instalacao_id == instalacao_id)
    ).scalar_one_or_none() or 0

    db.add(InstalacaoChecklist(
        instalacao_id=instalacao_id,
        titulo=data.titulo,
        obrigatoria=data.obrigatoria,
        ordem=ordem + 1,
    ))
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.delete("/{instalacao_id}/checklist/{item_id}", response_model=InstalacaoFullResponse)
def deletar_item(instalacao_id: int, item_id: int, db: Session = Depends(get_db)):
    item = db.get(InstalacaoChecklist, item_id)
    if not item or item.instalacao_id != instalacao_id:
        raise HTTPException(404, "Item não encontrado")
    db.delete(item)

    inst = _load(instalacao_id, db)
    _recalcular_progresso(inst)
    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


# ── Timer ────────────────────────────────────────────────────────────────────

class FinalizarPayload(PydanticBase):
    observacao_final: str | None = None


@router.post("/{instalacao_id}/iniciar", response_model=InstalacaoFullResponse)
def iniciar(instalacao_id: int, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    if inst.iniciado_em:
        raise HTTPException(400, "Instalação já foi iniciada")
    inst.iniciado_em = datetime.now(timezone.utc)
    inst.status = "em_execucao"
    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.post("/{instalacao_id}/finalizar", response_model=InstalacaoFullResponse)
def finalizar(instalacao_id: int, data: FinalizarPayload, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    if not inst.iniciado_em:
        raise HTTPException(400, "Instalação não foi iniciada")
    if inst.finalizado_em:
        raise HTTPException(400, "Instalação já foi finalizada")

    now = datetime.now(timezone.utc)
    inst.finalizado_em = now
    inst.duracao_minutos = max(1, round((now - inst.iniciado_em).total_seconds() / 60))
    inst.status = "concluida"
    inst.data_conclusao = date.today()
    inst.updated_at = now

    if data.observacao_final:
        obs = (inst.observacoes or "").strip()
        suffix = f"[Conclusão] {data.observacao_final}"
        inst.observacoes = f"{obs}\n{suffix}".strip() if obs else suffix

    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


# ── Comentários ───────────────────────────────────────────────────────────────

@router.post("/{instalacao_id}/comentarios", response_model=ComentarioResponse, status_code=201)
def adicionar_comentario(instalacao_id: int, data: ComentarioCreate, db: Session = Depends(get_db)):
    if not db.get(Instalacao, instalacao_id):
        raise HTTPException(404, "Instalação não encontrada")
    c = InstalacaoComentario(
        instalacao_id=instalacao_id,
        usuario=data.usuario,
        conteudo=data.conteudo,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c
