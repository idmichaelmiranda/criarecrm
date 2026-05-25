from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class TimelineEvento(Base):
    __tablename__ = "timeline_eventos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    implantacao_id: Mapped[int] = mapped_column(ForeignKey("implantacoes.id"), nullable=True)
    solicitacao_id: Mapped[int] = mapped_column(ForeignKey("solicitacoes.id"), nullable=True)

    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    # solicitacao_criada | triagem_iniciada | aprovado | recusado
    # implantacao_criada | etapa_iniciada | etapa_concluida
    # checklist_concluido | comentario | status_alterado

    titulo: Mapped[str] = mapped_column(String(200), nullable=True)
    descricao: Mapped[str] = mapped_column(Text, nullable=True)
    usuario: Mapped[str] = mapped_column(String(150), nullable=True)
    dados: Mapped[dict] = mapped_column(JSON, nullable=True)
    icone: Mapped[str] = mapped_column(String(50), nullable=True)
    cor: Mapped[str] = mapped_column(String(7), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    implantacao: Mapped["Implantacao"] = relationship("Implantacao", back_populates="timeline")
