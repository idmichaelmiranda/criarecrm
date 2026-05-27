from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class Notificacao(Base):
    __tablename__ = "notificacoes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    mensagem: Mapped[str] = mapped_column(Text, nullable=True)
    dados: Mapped[dict] = mapped_column(JSON, nullable=True)
    lida: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    usuario: Mapped["Usuario"] = relationship("Usuario")
