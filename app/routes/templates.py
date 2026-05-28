from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from datetime import datetime

import app.services.storage_service as storage
from app.database.connection import get_db
from app.models.template import Template, TemplateEtapa, TemplateTarefa
from app.schemas.template import (
    TemplateListResponse, TemplateResponse,
    TemplateCreate, TemplateUpdate,
    EtapaCreate, EtapaUpdate,
    TarefaCreate, TarefaUpdate,
    TemplateEtapaResponse, TemplateTarefaResponse,
)

router = APIRouter(prefix="/templates", tags=["templates"])


def _load(template_id: int, db: Session) -> Template:
    t = db.execute(
        select(Template)
        .options(
            selectinload(Template.etapas)
            .selectinload(TemplateEtapa.tarefas)
            .selectinload(TemplateTarefa.subitens)
        )
        .where(Template.id == template_id)
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Template não encontrado")
    # Expõe apenas tarefas raiz na etapa; subitens acessíveis via tarefa.subitens
    for etapa in t.etapas:
        etapa.tarefas = sorted(
            [tarefa for tarefa in etapa.tarefas if tarefa.parent_id is None],
            key=lambda x: x.ordem,
        )
    return t


# ── Templates ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[TemplateListResponse])
def listar(
    categoria: str | None = None,
    db: Session = Depends(get_db),
):
    q = select(Template)
    if categoria == "implantacao":
        q = q.where(~Template.tipo.like("instalacao_%"))
    elif categoria == "instalacao":
        q = q.where(Template.tipo.like("instalacao_%"))
    return db.execute(q.order_by(Template.nome)).scalars().all()


@router.post("/", response_model=TemplateResponse, status_code=201)
def criar(data: TemplateCreate, db: Session = Depends(get_db)):
    t = Template(**data.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return _load(t.id, db)


@router.get("/{template_id}", response_model=TemplateResponse)
def obter(template_id: int, db: Session = Depends(get_db)):
    return _load(template_id, db)


@router.patch("/{template_id}", response_model=TemplateResponse)
def atualizar(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    # permite limpar checklist_template_id (null explícito)
    if "checklist_template_id" in data.model_fields_set and data.checklist_template_id is None:
        t.checklist_template_id = None
    db.commit()
    return _load(template_id, db)


@router.delete("/{template_id}", status_code=204)
def deletar(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    if t.pop_pdf_path:
        storage.delete_sync(storage._to_storage_path(t.pop_pdf_path))
    db.delete(t)
    db.commit()


# ── POP geral do template ─────────────────────────────────────────────────────

@router.post("/{template_id}/pop", response_model=TemplateResponse)
def upload_pop_template(template_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    t = _load(template_id, db)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Apenas arquivos PDF são aceitos")
    if t.pop_pdf_path:
        storage.delete_sync(storage._to_storage_path(t.pop_pdf_path))
    sp = f"pops/templates/template_{template_id}.pdf"
    storage.upload_sync(sp, file.file.read(), "application/pdf")
    t.pop_pdf_path = sp
    db.commit()
    return _load(template_id, db)


@router.delete("/{template_id}/pop", status_code=204)
def deletar_pop_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    if t.pop_pdf_path:
        storage.delete_sync(storage._to_storage_path(t.pop_pdf_path))
        t.pop_pdf_path = None
        db.commit()


@router.get("/{template_id}/pop")
def visualizar_pop_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t or not t.pop_pdf_path:
        raise HTTPException(404, "POP não encontrado")
    data = storage.download_sync(storage._to_storage_path(t.pop_pdf_path))
    if data is None:
        raise HTTPException(404, "Arquivo não encontrado")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="POP_template_{template_id}.pdf"'},
    )


# ── Etapas ────────────────────────────────────────────────────────────────────

@router.post("/{template_id}/etapas", response_model=TemplateEtapaResponse, status_code=201)
def adicionar_etapa(template_id: int, data: EtapaCreate, db: Session = Depends(get_db)):
    if not db.get(Template, template_id):
        raise HTTPException(404, "Template não encontrado")
    etapa = TemplateEtapa(template_id=template_id, **data.model_dump())
    db.add(etapa)
    db.commit()
    db.refresh(etapa)
    return etapa


@router.patch("/etapas/{etapa_id}", response_model=TemplateEtapaResponse)
def atualizar_etapa(etapa_id: int, data: EtapaUpdate, db: Session = Depends(get_db)):
    etapa = db.execute(
        select(TemplateEtapa)
        .options(selectinload(TemplateEtapa.tarefas))
        .where(TemplateEtapa.id == etapa_id)
    ).scalar_one_or_none()
    if not etapa:
        raise HTTPException(404, "Etapa não encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(etapa, field, value)
    db.commit()
    db.refresh(etapa)
    return etapa


@router.delete("/etapas/{etapa_id}", status_code=204)
def deletar_etapa(etapa_id: int, db: Session = Depends(get_db)):
    etapa = db.get(TemplateEtapa, etapa_id)
    if not etapa:
        raise HTTPException(404, "Etapa não encontrada")
    db.delete(etapa)
    db.commit()


# ── Tarefas ───────────────────────────────────────────────────────────────────

@router.post("/etapas/{etapa_id}/tarefas", response_model=TemplateTarefaResponse, status_code=201)
def adicionar_tarefa(etapa_id: int, data: TarefaCreate, db: Session = Depends(get_db)):
    if not db.get(TemplateEtapa, etapa_id):
        raise HTTPException(404, "Etapa não encontrada")
    tarefa = TemplateTarefa(etapa_id=etapa_id, **data.model_dump())
    db.add(tarefa)
    db.commit()
    db.refresh(tarefa)
    return tarefa


@router.post("/tarefas/{tarefa_id}/subitens", response_model=TemplateTarefaResponse, status_code=201)
def adicionar_subtarefa(tarefa_id: int, data: TarefaCreate, db: Session = Depends(get_db)):
    parent = db.get(TemplateTarefa, tarefa_id)
    if not parent:
        raise HTTPException(404, "Tarefa não encontrada")
    sub = TemplateTarefa(etapa_id=parent.etapa_id, parent_id=tarefa_id, **data.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.patch("/tarefas/{tarefa_id}", response_model=TemplateTarefaResponse)
def atualizar_tarefa(tarefa_id: int, data: TarefaUpdate, db: Session = Depends(get_db)):
    tarefa = db.get(TemplateTarefa, tarefa_id)
    if not tarefa:
        raise HTTPException(404, "Tarefa não encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(tarefa, field, value)
    db.commit()
    db.refresh(tarefa)
    return tarefa


@router.delete("/tarefas/{tarefa_id}", status_code=204)
def deletar_tarefa(tarefa_id: int, db: Session = Depends(get_db)):
    tarefa = db.get(TemplateTarefa, tarefa_id)
    if not tarefa:
        raise HTTPException(404, "Tarefa não encontrada")
    if tarefa.pop_pdf_path:
        storage.delete_sync(storage._to_storage_path(tarefa.pop_pdf_path))
    db.delete(tarefa)
    db.commit()


# ── POP (PDF de referência por tarefa) ───────────────────────────────────────

@router.post("/tarefas/{tarefa_id}/pop", response_model=TemplateTarefaResponse)
def upload_pop(tarefa_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    tarefa = db.get(TemplateTarefa, tarefa_id)
    if not tarefa:
        raise HTTPException(404, "Tarefa não encontrada")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Apenas arquivos PDF são aceitos")
    if tarefa.pop_pdf_path:
        storage.delete_sync(storage._to_storage_path(tarefa.pop_pdf_path))
    sp = f"pops/tarefa_{tarefa_id}.pdf"
    storage.upload_sync(sp, file.file.read(), "application/pdf")
    tarefa.pop_pdf_path = sp
    db.commit()
    db.refresh(tarefa)
    return tarefa


@router.delete("/tarefas/{tarefa_id}/pop", status_code=204)
def deletar_pop(tarefa_id: int, db: Session = Depends(get_db)):
    tarefa = db.get(TemplateTarefa, tarefa_id)
    if not tarefa:
        raise HTTPException(404, "Tarefa não encontrada")
    if tarefa.pop_pdf_path:
        storage.delete_sync(storage._to_storage_path(tarefa.pop_pdf_path))
        tarefa.pop_pdf_path = None
        db.commit()


@router.get("/tarefas/{tarefa_id}/pop")
def visualizar_pop(tarefa_id: int, db: Session = Depends(get_db)):
    tarefa = db.get(TemplateTarefa, tarefa_id)
    if not tarefa or not tarefa.pop_pdf_path:
        raise HTTPException(404, "POP não encontrado")
    data = storage.download_sync(storage._to_storage_path(tarefa.pop_pdf_path))
    if data is None:
        raise HTTPException(404, "Arquivo não encontrado")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="POP_tarefa_{tarefa_id}.pdf"'},
    )
