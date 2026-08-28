from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.solicitacao_instalador import SolicitacaoInstalador
from app.models.usuario import Usuario
from app.services import solicitacao_instalador_service as sol_service
import app.services.storage_service as storage

router = APIRouter(prefix="/solicitacoes-instalador", tags=["solicitacoes-instalador"])


def _serializar_maquina(info: dict | None) -> dict | None:
    if not info:
        return None
    disco = info.get("disco") or {}
    windows = info.get("windows") or {}
    return {
        "processador": info.get("processador"),
        "nucleos": info.get("nucleos"),
        "memoriaRamGb": info.get("memoria_ram_gb"),
        "disco": {
            "tipo": disco.get("tipo"),
            "espacoTotalGb": disco.get("espaco_total_gb"),
            "espacoLivreGb": disco.get("espaco_livre_gb"),
        },
        "windows": {
            "versao": windows.get("versao"),
            "build": windows.get("build"),
            "arquitetura": windows.get("arquitetura"),
        },
    }


def _serializar(sol: SolicitacaoInstalador, db: Session) -> dict:
    status = sol_service.status_efetivo(sol, db)
    responsavel = sol.aprovado_por or sol.recusado_por
    return {
        "id": str(sol.id),
        "cnpj": sol.cnpj,
        "clienteId": sol.cliente_id,
        "clienteNome": sol.cliente.razao_social if sol.cliente else None,
        "status": status,
        "criadoEm": sol_service.formatar_iso(sol.criado_em),
        "expiraEm": sol_service.formatar_iso(sol.expira_em),
        "aprovadoEm": sol_service.formatar_iso(sol.aprovado_em) if sol.aprovado_em else None,
        "recusadoEm": sol_service.formatar_iso(sol.recusado_em) if sol.recusado_em else None,
        "canceladoEm": sol_service.formatar_iso(sol.cancelado_em) if sol.cancelado_em else None,
        "responsavelNome": responsavel.nome if responsavel else None,
        "responsavelAvatarUrl": storage.avatar_url(responsavel.avatar_path) if responsavel else None,
        "maquinaInfo": _serializar_maquina(sol.maquina_info),
    }


def _serializar_etapa(etapa) -> dict:
    return {
        "indiceEtapa": etapa.indice_etapa,
        "nome": etapa.nome,
        "totalEtapas": etapa.total_etapas,
        "status": etapa.status,
        "percentual": etapa.percentual,
        "mensagem": etapa.mensagem,
        "iniciadoEm": sol_service.formatar_iso(etapa.iniciado_em) if etapa.iniciado_em else None,
        "concluidoEm": sol_service.formatar_iso(etapa.concluido_em) if etapa.concluido_em else None,
    }


@router.get("/")
def listar(
    status: str | None = Query(None, description="pendente | aprovada | recusada | expirada | cancelada"),
    cliente_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    stmt = select(SolicitacaoInstalador).order_by(SolicitacaoInstalador.criado_em.desc())
    if cliente_id is not None:
        stmt = stmt.where(SolicitacaoInstalador.cliente_id == cliente_id)
    solicitacoes = db.execute(stmt).scalars().all()

    resultado = [_serializar(s, db) for s in solicitacoes]
    if status is not None:
        resultado = [r for r in resultado if r["status"] == status]
    return resultado


@router.get("/{solicitacao_id}/etapas")
def listar_etapas(
    solicitacao_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Alimenta a tela de acompanhamento (polling) depois que a solicitação foi
    aprovada e o instalador começa a reportar progresso via PUT .../etapas/{indice}."""
    sol = sol_service.obter_ou_404(solicitacao_id, db)
    etapas = sol_service.listar_etapas(sol.id, db)
    return [_serializar_etapa(e) for e in etapas]


@router.post("/{solicitacao_id}/aprovar")
def aprovar(
    solicitacao_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    sol = sol_service.obter_ou_404(solicitacao_id, db)
    if sol_service.status_efetivo(sol, db) != "pendente":
        raise HTTPException(400, f"Solicitação não está mais pendente (status atual: {sol.status})")

    try:
        sol_service.aprovar(sol, db, current_user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return _serializar(sol, db)


@router.post("/{solicitacao_id}/recusar")
def recusar(
    solicitacao_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    sol = sol_service.obter_ou_404(solicitacao_id, db)
    if sol_service.status_efetivo(sol, db) != "pendente":
        raise HTTPException(400, f"Solicitação não está mais pendente (status atual: {sol.status})")

    sol_service.recusar(sol, db, current_user.id)
    return _serializar(sol, db)
