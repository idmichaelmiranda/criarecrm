from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class ImplantacaoEtapa(Base):
    __tablename__ = "implantacao_etapas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    implantacao_id: Mapped[int] = mapped_column(ForeignKey("implantacoes.id"), nullable=False)
    template_etapa_id: Mapped[int] = mapped_column(ForeignKey("template_etapas.id"), nullable=True)

    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pendente")
    # pendente | em_andamento | concluida | bloqueada | pulada
    cor: Mapped[str] = mapped_column(String(7), nullable=False, default="#6366f1")
    sla_dias: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    data_inicio: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    data_conclusao: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    implantacao: Mapped["Implantacao"] = relationship("Implantacao", back_populates="etapas")
    itens: Mapped[list["ChecklistItem"]] = relationship(
        "ChecklistItem", back_populates="etapa", order_by="ChecklistItem.ordem"
    )
