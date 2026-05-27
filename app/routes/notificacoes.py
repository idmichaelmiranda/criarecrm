from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from pydantic import BaseModel

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
from app.models.notificacao import Notificacao

router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])


class NotificacaoResponse(BaseModel):
    id: int
    tipo: str
    titulo: str
    mensagem: str | None = None
    dados: dict | None = None
    lida: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[NotificacaoResponse])
def listar(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    rows = db.execute(
        select(Notificacao)
        .where(Notificacao.usuario_id == current_user.id)
        .order_by(Notificacao.created_at.desc())
        .limit(20)
    ).scalars().all()
    return rows


@router.get("/nao-lidas-count")
def nao_lidas_count(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    count = db.execute(
        select(func.count()).select_from(Notificacao)
        .where(Notificacao.usuario_id == current_user.id, Notificacao.lida == False)  # noqa: E712
    ).scalar_one()
    return {"count": count}


@router.patch("/lidas-todas", status_code=200)
def marcar_todas_lidas(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    rows = db.execute(
        select(Notificacao)
        .where(Notificacao.usuario_id == current_user.id, Notificacao.lida == False)  # noqa: E712
    ).scalars().all()
    for n in rows:
        n.lida = True
    db.commit()
    return {"ok": True}


@router.patch("/{notif_id}/lida", status_code=200)
def marcar_lida(notif_id: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    n = db.get(Notificacao, notif_id)
    if n and n.usuario_id == current_user.id:
        n.lida = True
        db.commit()
    return {"ok": True}
