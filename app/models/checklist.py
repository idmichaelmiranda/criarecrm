from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class ChecklistItem(Base):
    __tablename__ = "checklist_itens"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    implantacao_id: Mapped[int] = mapped_column(ForeignKey("implantacoes.id"), nullable=False)
    etapa_id: Mapped[int] = mapped_column(ForeignKey("implantacao_etapas.id"), nullable=True)
    template_tarefa_id: Mapped[int] = mapped_column(ForeignKey("template_tarefas.id"), nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("checklist_itens.id"), nullable=True)

    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pendente")
    # pendente | concluido | bloqueado | nao_aplicavel
    obrigatoria: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    responsavel: Mapped[str] = mapped_column(String(100), nullable=True)
    responsavel_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    data_prazo: Mapped[date] = mapped_column(Date, nullable=True)
    arquivado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")

    data_conclusao: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    implantacao: Mapped["Implantacao"] = relationship("Implantacao", back_populates="checklist")
    etapa: Mapped["ImplantacaoEtapa"] = relationship("ImplantacaoEtapa", back_populates="itens")
    template_tarefa: Mapped[Optional["TemplateTarefa"]] = relationship("TemplateTarefa", foreign_keys=[template_tarefa_id])
    subitens: Mapped[list["ChecklistItem"]] = relationship(
        "ChecklistItem",
        primaryjoin="ChecklistItem.parent_id == ChecklistItem.id",
        foreign_keys="[ChecklistItem.parent_id]",
        order_by="ChecklistItem.ordem",
    )

    @property
    def pop_pdf_path(self) -> Optional[str]:
        return self.template_tarefa.pop_pdf_path if self.template_tarefa else None
