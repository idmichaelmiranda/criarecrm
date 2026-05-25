from sqlalchemy.orm import Session
from app.models.timeline import TimelineEvento


def log(
    db: Session,
    tipo: str,
    titulo: str,
    descricao: str | None = None,
    usuario: str = "Sistema",
    icone: str | None = None,
    cor: str | None = None,
    dados: dict | None = None,
    implantacao_id: int | None = None,
    solicitacao_id: int | None = None,
) -> TimelineEvento:
    evento = TimelineEvento(
        implantacao_id=implantacao_id,
        solicitacao_id=solicitacao_id,
        tipo=tipo,
        titulo=titulo,
        descricao=descricao,
        usuario=usuario,
        icone=icone,
        cor=cor,
        dados=dados or {},
    )
    db.add(evento)
    return evento
