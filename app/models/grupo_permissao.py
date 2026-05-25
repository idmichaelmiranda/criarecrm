from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class GrupoPermissao(Base):
    __tablename__ = "grupos_permissao"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    descricao: Mapped[str] = mapped_column(Text, nullable=True)
    permissoes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    usuarios: Mapped[list["Usuario"]] = relationship("Usuario", back_populates="grupo")
