from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
from app.models.implantacao import Implantacao
from app.schemas.implantacao import (
    ImplantacaoListResponse, ImplantacaoFullResponse, ImplantacaoUpdate,
    ChecklistItemResponse, ChecklistItemUpdate, ChecklistItemCreate, ChecklistReorder,
    EtapaResponse, EtapaManualUpdate, EtapaCreate, EtapaPropsUpdate, EtapaReorder,
    ComentarioCreate, ComentarioResponse,
)
from app.services import implantacao_service
import app.services.storage_service as storage

router = APIRouter(prefix="/implantacoes", tags=["implantacoes"])


def _build_full_response(impl: Implantacao) -> ImplantacaoFullResponse:
    resp = ImplantacaoFullResponse.model_validate(impl)
    resp.responsavel_nome = impl.responsavel.nome if impl.responsavel else None
    if impl.responsavel and impl.responsavel.avatar_path:
        resp.responsavel_avatar_url = storage.avatar_url(impl.responsavel.avatar_path)
    if impl.solicitacao:
        resp.produtos_contratados = impl.solicitacao.produtos_contratados or []
        resp.observacao_comercial = impl.solicitacao.observacao_comercial
    return resp


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
        # Conta apenas itens em etapas (etapa_id não nulo) para ser consistente
        # com o cálculo da página de detalhe, que itera impl.etapas[].itens.
        # Itens órfãos (etapa_id=None) são excluídos para evitar distorção.
        _subs = implantacao_service._build_subs_index(impl.checklist)
        _roots = [i for i in impl.checklist if not i.parent_id and i.etapa_id is not None and not i.arquivado]
        _total, _done = implantacao_service._leaf_counts(_roots, _subs)
        live_progresso = int((_done / _total) * 100 + 0.5) if _total else 0

        hoje = date.today()
        vencidas = sum(
            1 for i in _roots
            if i.data_prazo and i.data_prazo < hoje and i.status not in ("concluido", "nao_aplicavel")
        )

        data = ImplantacaoListResponse.model_validate(impl)
        data.cliente_nome = impl.cliente.razao_social if impl.cliente else None
        data.cliente_cnpj = impl.cliente.cnpj if impl.cliente else None
        if impl.cliente:
            endereco = impl.cliente.endereco or {}
            data.cliente_cidade = endereco.get("cidade")
            data.cliente_estado = endereco.get("estado")
            data.cliente_regime_tributario = (impl.cliente.dados_contabeis or {}).get("regime_tributario")
        data.progresso = live_progresso
        data.tarefas_vencidas = vencidas
        data.responsavel_nome = impl.responsavel.nome if impl.responsavel else None
        if impl.responsavel and impl.responsavel.avatar_path:
            data.responsavel_avatar_url = storage.avatar_url(impl.responsavel.avatar_path)
        result.append(data)
    return result


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return implantacao_service.stats(db)


@router.get("/{impl_id}", response_model=ImplantacaoFullResponse)
def obter(impl_id: int, db: Session = Depends(get_db)):
    return _build_full_response(implantacao_service.get_by_id(db, impl_id))


@router.patch("/{impl_id}", response_model=ImplantacaoFullResponse)
def atualizar(impl_id: int, data: ImplantacaoUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    implantacao_service.atualizar(db, impl_id, data, usuario=current_user.nome, usuario_id=current_user.id)
    return _build_full_response(implantacao_service.get_by_id(db, impl_id))


class GoLivePayload(BaseModel):
    data_go_live: Optional[date] = None  # None = usa hoje


@router.post("/{impl_id}/go-live", response_model=ImplantacaoFullResponse)
def registrar_go_live(
    impl_id: int,
    payload: GoLivePayload = GoLivePayload(),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    from app.models.implantacao import Implantacao as ImplModel
    impl = db.get(ImplModel, impl_id)
    if not impl:
        from fastapi import HTTPException
        raise HTTPException(404, "Implantação não encontrada")
    impl.data_go_live = payload.data_go_live or date.today()
    db.commit()
    from app.services import timeline_service
    timeline_service.log(
        db,
        tipo="go_live",
        titulo="🚀 Go Live registrado",
        descricao=f"Sistema entrou em produção em {impl.data_go_live.strftime('%d/%m/%Y')}",
        usuario=current_user.nome,
        icone="rocket",
        cor="#10b981",
        implantacao_id=impl_id,
    )
    db.commit()
    return _build_full_response(implantacao_service.get_by_id(db, impl_id))


@router.delete("/{impl_id}/go-live", response_model=ImplantacaoFullResponse)
def remover_go_live(
    impl_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    from app.models.implantacao import Implantacao as ImplModel
    impl = db.get(ImplModel, impl_id)
    if not impl:
        from fastapi import HTTPException
        raise HTTPException(404, "Implantação não encontrada")
    impl.data_go_live = None
    db.commit()
    return _build_full_response(implantacao_service.get_by_id(db, impl_id))


@router.post("/{impl_id}/comentarios", response_model=ComentarioResponse)
def adicionar_comentario(impl_id: int, data: ComentarioCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return implantacao_service.adicionar_comentario(db, impl_id, current_user.nome, data.conteudo)


@router.post("/{impl_id}/checklist", response_model=ChecklistItemResponse, status_code=201)
def criar_item(impl_id: int, data: ChecklistItemCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return implantacao_service.criar_checklist_item(db, impl_id, data, usuario=current_user.nome)


@router.patch("/checklist/{item_id}", response_model=ChecklistItemResponse)
def atualizar_item(item_id: int, data: ChecklistItemUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return implantacao_service.atualizar_checklist_item(db, item_id, data, usuario=current_user.nome, usuario_id=current_user.id)


@router.delete("/checklist/{item_id}", status_code=204)
def deletar_item(item_id: int, db: Session = Depends(get_db)):
    implantacao_service.deletar_checklist_item(db, item_id)


@router.post("/{impl_id}/checklist/reordenar", status_code=200)
def reordenar_checklist(impl_id: int, data: ChecklistReorder, db: Session = Depends(get_db)):
    implantacao_service.reordenar_checklist_itens(db, data.ordens)
    return {"ok": True}


@router.patch("/{impl_id}/etapas/{etapa_id}", response_model=EtapaResponse)
def atualizar_etapa(impl_id: int, etapa_id: int, data: EtapaPropsUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return implantacao_service.atualizar_etapa(db, impl_id, etapa_id, data, usuario=current_user.nome)


@router.post("/{impl_id}/etapas", response_model=EtapaResponse, status_code=201)
def criar_etapa(impl_id: int, data: EtapaCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return implantacao_service.criar_etapa(db, impl_id, data, usuario=current_user.nome)


@router.delete("/{impl_id}/etapas/{etapa_id}", status_code=204)
def deletar_etapa(impl_id: int, etapa_id: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    implantacao_service.deletar_etapa(db, impl_id, etapa_id, usuario=current_user.nome)


@router.post("/{impl_id}/etapas/reordenar", status_code=200)
def reordenar_etapas(impl_id: int, data: EtapaReorder, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    implantacao_service.reordenar_etapas(db, impl_id, data.ordens)
    return {"ok": True}


@router.post("/{impl_id}/checklist/{item_id}/subitens", response_model=ChecklistItemResponse, status_code=201)
def criar_subitem(impl_id: int, item_id: int, data: ChecklistItemCreate, db: Session = Depends(get_db)):
    return implantacao_service.criar_subitem(db, impl_id, item_id, data)
