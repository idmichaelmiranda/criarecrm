import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.solicitacao_instalador import SolicitacaoInstalador, SolicitacaoInstaladorEtapa
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


def criar_ou_reaproveitar(cnpj: str, db: Session, maquina_info: dict | None = None) -> SolicitacaoInstalador:
    digits = normalizar_cnpj(cnpj)
    now = datetime.now(timezone.utc)

    existente = db.execute(
        select(SolicitacaoInstalador)
        .where(SolicitacaoInstalador.cnpj == digits, SolicitacaoInstalador.status == "pendente")
        .order_by(SolicitacaoInstalador.criado_em.desc())
    ).scalars().first()
    if existente and status_efetivo(existente, db) == "pendente":
        # Retentativa do técnico pro mesmo CNPJ: atualiza o snapshot da máquina com o
        # mais recente em vez de descartar (não sobrescreve com None se essa chamada
        # não trouxe dado nenhum).
        if maquina_info is not None:
            existente.maquina_info = maquina_info
            db.commit()
            db.refresh(existente)
        return existente

    cliente = buscar_cliente_por_cnpj(digits, db)
    sol = SolicitacaoInstalador(
        cnpj=digits,
        cliente_id=cliente.id if cliente else None,
        status="pendente",
        criado_em=now,
        expira_em=now + timedelta(hours=EXPIRA_HORAS),
        maquina_info=maquina_info,
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


def upsert_etapa(
    solicitacao_id,
    indice_etapa: int,
    nome: str,
    total_etapas: int | None,
    status: str,
    percentual: float | None,
    mensagem: str | None,
    db: Session,
) -> None:
    """UPSERT barato — o instalador chama isso repetidamente (a cada poucos segundos)
    pra uma mesma etapa longa, então é 1 SELECT + 1 UPDATE/INSERT, nada mais."""
    now = datetime.now(timezone.utc)
    etapa = db.execute(
        select(SolicitacaoInstaladorEtapa).where(
            SolicitacaoInstaladorEtapa.solicitacao_id == solicitacao_id,
            SolicitacaoInstaladorEtapa.indice_etapa == indice_etapa,
        )
    ).scalar_one_or_none()

    if etapa is None:
        etapa = SolicitacaoInstaladorEtapa(solicitacao_id=solicitacao_id, indice_etapa=indice_etapa)
        db.add(etapa)

    etapa.nome = nome
    if total_etapas is not None:
        etapa.total_etapas = total_etapas
    etapa.status = status
    etapa.percentual = percentual
    etapa.mensagem = mensagem

    # iniciado_em só é gravado na primeira vez que a etapa aparece em_andamento —
    # chamadas seguintes da mesma etapa não podem empurrar esse marco pra frente.
    if status == "em_andamento" and etapa.iniciado_em is None:
        etapa.iniciado_em = now
    if status in ("concluida", "falhou"):
        etapa.concluido_em = now

    db.commit()


def listar_etapas(solicitacao_id, db: Session) -> list[SolicitacaoInstaladorEtapa]:
    return db.execute(
        select(SolicitacaoInstaladorEtapa)
        .where(SolicitacaoInstaladorEtapa.solicitacao_id == solicitacao_id)
        .order_by(SolicitacaoInstaladorEtapa.indice_etapa)
    ).scalars().all()
