import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.solicitacao_instalador import SolicitacaoInstalador
from app.services.api_key_service import buscar_cliente_por_cnpj, emitir_chave_api, normalizar_cnpj

EXPIRA_HORAS = 1


def formatar_iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def obter_ou_404(solicitacao_id: str, db: Session) -> SolicitacaoInstalador:
    try:
        sid = uuid.UUID(solicitacao_id)
    except ValueError:
        raise HTTPException(404, "Solicitação não encontrada")
    sol = db.get(SolicitacaoInstalador, sid)
    if not sol:
        raise HTTPException(404, "Solicitação não encontrada")
    return sol


def status_efetivo(sol: SolicitacaoInstalador, db: Session) -> str:
    """Fonte da verdade sobre expiração: calcula na hora da leitura em vez de depender
    só de um job agendado. Se detectar que uma solicitação pendente já passou do prazo,
    persiste a virada pra "expirada" — assim ela some da lista de pendentes sozinha."""
    expira_em = sol.expira_em
    if expira_em.tzinfo is None:
        expira_em = expira_em.replace(tzinfo=timezone.utc)
    if sol.status == "pendente" and expira_em <= datetime.now(timezone.utc):
        sol.status = "expirada"
        db.commit()
        db.refresh(sol)
    return sol.status


def criar_ou_reaproveitar(cnpj: str, db: Session) -> SolicitacaoInstalador:
    digits = normalizar_cnpj(cnpj)
    now = datetime.now(timezone.utc)

    existente = db.execute(
        select(SolicitacaoInstalador)
        .where(SolicitacaoInstalador.cnpj == digits, SolicitacaoInstalador.status == "pendente")
        .order_by(SolicitacaoInstalador.criado_em.desc())
    ).scalars().first()
    if existente and status_efetivo(existente, db) == "pendente":
        return existente

    cliente = buscar_cliente_por_cnpj(digits, db)
    sol = SolicitacaoInstalador(
        cnpj=digits,
        cliente_id=cliente.id if cliente else None,
        status="pendente",
        criado_em=now,
        expira_em=now + timedelta(hours=EXPIRA_HORAS),
    )
    db.add(sol)
    db.commit()
    db.refresh(sol)
    return sol


def aprovar(sol: SolicitacaoInstalador, db: Session, usuario_id: int) -> None:
    cliente = sol.cliente
    if cliente is None:
        raise ValueError("Solicitação sem cliente vinculado — cadastre o cliente antes de aprovar.")
    now = datetime.now(timezone.utc)
    chave = emitir_chave_api(cliente, now)
    sol.api_key = chave
    sol.nome_cliente_snapshot = cliente.razao_social
    sol.status = "aprovada"
    sol.aprovado_em = now
    sol.aprovado_por_id = usuario_id
    db.commit()


def recusar(sol: SolicitacaoInstalador, db: Session, usuario_id: int) -> None:
    sol.status = "recusada"
    sol.recusado_em = datetime.now(timezone.utc)
    sol.recusado_por_id = usuario_id
    db.commit()


def cancelar(sol: SolicitacaoInstalador, db: Session) -> None:
    """Chamado pelo próprio instalador quando o técnico desiste. Só tem efeito se a
    solicitação ainda estiver pendente — nunca sobrescreve um status terminal já
    decidido (aprovada/recusada/expirada), pra não revogar uma chave já concedida."""
    if status_efetivo(sol, db) != "pendente":
        return
    sol.status = "cancelada"
    sol.cancelado_em = datetime.now(timezone.utc)
    db.commit()
