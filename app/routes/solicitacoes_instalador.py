import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.solicitacao_instalador import SolicitacaoInstalador
from app.services import solicitacao_instalador_service as sol_service

router = APIRouter(prefix="/solicitacoes-instalador", tags=["solicitacoes-instalador"])


def _obter(solicitacao_id: str, db: Session) -> SolicitacaoInstalador:
    try:
        sid = uuid.UUID(solicitacao_id)
    except ValueError:
        raise HTTPException(404, "Solicitação não encontrada")
    sol = db.get(SolicitacaoInstalador, sid)
    if not sol:
        raise HTTPException(404, "Solicitação não encontrada")
    return sol


def _serializar(sol: SolicitacaoInstalador, db: Session) -> dict:
    status = sol_service.status_efetivo(sol, db)
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
    }


@router.get("/")
def listar(
    status: str | None = Query(None, description="pendente | aprovada | recusada | expirada"),
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


@router.post("/{solicitacao_id}/aprovar")
def aprovar(solicitacao_id: str, db: Session = Depends(get_db)):
    sol = _obter(solicitacao_id, db)
    if sol_service.status_efetivo(sol, db) != "pendente":
        raise HTTPException(400, f"Solicitação não está mais pendente (status atual: {sol.status})")

    try:
        sol_service.aprovar(sol, db)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return _serializar(sol, db)


@router.post("/{solicitacao_id}/recusar")
def recusar(solicitacao_id: str, db: Session = Depends(get_db)):
    sol = _obter(solicitacao_id, db)
    if sol_service.status_efetivo(sol, db) != "pendente":
        raise HTTPException(400, f"Solicitação não está mais pendente (status atual: {sol.status})")

    sol_service.recusar(sol, db)
    return _serializar(sol, db)
