from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
from app.schemas.implantacao import (
    ImplantacaoListResponse, ImplantacaoFullResponse, ImplantacaoUpdate,
    ChecklistItemResponse, ChecklistItemUpdate, ChecklistItemCreate,
    EtapaResponse, EtapaManualUpdate,
    ComentarioCreate, ComentarioResponse,
)
from app.services import implantacao_service

router = APIRouter(prefix="/implantacoes", tags=["implantacoes"])


@router.get("/", response_model=list[ImplantacaoListResponse])
def listar(
    status: str | None = Query(None),
    sla_status: str | None = Query(None),
    prioridade: str | None = Query(None),
    consultor: str | None = Query(None),
    db: Session = Depends(get_db),
):
    implantacoes = implantacao_service.get_all(
        db, status=status, sla_status=sla_status,
        prioridade=prioridade, consultor=consultor,
    )
    result = []
    for impl in implantacoes:
        active = [i for i in impl.checklist if i.status != "nao_aplicavel"]
        done   = [i for i in active if i.status == "concluido"]
        live_progresso = round((len(done) / len(active)) * 100) if active else 0

        hoje = date.today()
        vencidas = sum(
            1 for i in impl.checklist
            if i.data_prazo and i.data_prazo < hoje and i.status not in ("concluido", "nao_aplicavel")
        )

        data = ImplantacaoListResponse.model_validate(impl)
        data.cliente_nome = impl.cliente.razao_social if impl.cliente else None
        data.cliente_cnpj = impl.cliente.cnpj if impl.cliente else None
        data.progresso = live_progresso
        data.tarefas_vencidas = vencidas
        result.append(data)
    return result


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return implantacao_service.stats(db)


@router.get("/{impl_id}", response_model=ImplantacaoFullResponse)
def obter(impl_id: int, db: Session = Depends(get_db)):
    return implantacao_service.get_by_id(db, impl_id)


@router.patch("/{impl_id}", response_model=ImplantacaoFullResponse)
def atualizar(impl_id: int, data: ImplantacaoUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    implantacao_service.atualizar(db, impl_id, data, usuario=current_user.nome)
    return implantacao_service.get_by_id(db, impl_id)


@router.post("/{impl_id}/comentarios", response_model=ComentarioResponse)
def adicionar_comentario(impl_id: int, data: ComentarioCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return implantacao_service.adicionar_comentario(db, impl_id, current_user.nome, data.conteudo)


@router.post("/{impl_id}/checklist", response_model=ChecklistItemResponse, status_code=201)
def criar_item(impl_id: int, data: ChecklistItemCreate, db: Session = Depends(get_db)):
    return implantacao_service.criar_checklist_item(db, impl_id, data)


@router.patch("/checklist/{item_id}", response_model=ChecklistItemResponse)
def atualizar_item(item_id: int, data: ChecklistItemUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return implantacao_service.atualizar_checklist_item(db, item_id, data, usuario=current_user.nome)


@router.delete("/checklist/{item_id}", status_code=204)
def deletar_item(item_id: int, db: Session = Depends(get_db)):
    implantacao_service.deletar_checklist_item(db, item_id)


@router.patch("/{impl_id}/etapas/{etapa_id}", response_model=EtapaResponse)
def atualizar_etapa(impl_id: int, etapa_id: int, data: EtapaManualUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return implantacao_service.atualizar_etapa(db, impl_id, etapa_id, data, usuario=current_user.nome)
