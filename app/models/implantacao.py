from datetime import datetime, date
from sqlalchemy import String, Text, Integer, Boolean, Date, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class Implantacao(Base):
    __tablename__ = "implantacoes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    template_id: Mapped[int] = mapped_column(ForeignKey("templates.id"), nullable=True)
    solicitacao_id: Mapped[int] = mapped_column(ForeignKey("solicitacoes.id"), nullable=True)

    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="em_andamento")
    # em_andamento | pausada | concluida | cancelada

    consultor: Mapped[str] = mapped_column(String(150), nullable=True)
    observacoes: Mapped[str] = mapped_column(Text, nullable=True)

    data_inicio: Mapped[date] = mapped_column(Date, nullable=True)
    data_prevista: Mapped[date] = mapped_column(Date, nullable=True)
    data_conclusao: Mapped[date] = mapped_column(Date, nullable=True)

    progresso: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    sla_dias: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    sla_limite: Mapped[date] = mapped_column(Date, nullable=True)
    sla_status: Mapped[str] = mapped_column(String(20), nullable=False, default="ok")
    # ok | em_risco | atrasada

    prioridade: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    # baixa | normal | alta | critica

    conversao_dados: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    certificado_path: Mapped[str] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="implantacoes")
    etapas: Mapped[list["ImplantacaoEtapa"]] = relationship(
        "ImplantacaoEtapa", back_populates="implantacao",
        order_by="ImplantacaoEtapa.ordem", cascade="all, delete-orphan"
    )
    checklist: Mapped[list["ChecklistItem"]] = relationship(
        "ChecklistItem", back_populates="implantacao", cascade="all, delete-orphan"
    )
    timeline: Mapped[list["TimelineEvento"]] = relationship(
        "TimelineEvento", back_populates="implantacao",
        order_by="TimelineEvento.created_at.desc()", cascade="all, delete-orphan"
    )
    comentarios: Mapped[list["Comentario"]] = relationship(
        "Comentario", back_populates="implantacao",
        order_by="Comentario.created_at", cascade="all, delete-orphan"
    )
