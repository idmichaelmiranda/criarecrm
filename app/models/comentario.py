from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class Comentario(Base):
    __tablename__ = "comentarios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    implantacao_id: Mapped[int] = mapped_column(ForeignKey("implantacoes.id"), nullable=False)
    usuario: Mapped[str] = mapped_column(String(150), nullable=False, default="Admin")
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    implantacao: Mapped["Implantacao"] = relationship("Implantacao", back_populates="comentarios")
