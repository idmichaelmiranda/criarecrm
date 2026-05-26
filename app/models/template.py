from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=True)
    sla_total_dias: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pop_pdf_path: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    etapas: Mapped[list["TemplateEtapa"]] = relationship(
        "TemplateEtapa", back_populates="template",
        order_by="TemplateEtapa.ordem", cascade="all, delete-orphan"
    )


class TemplateEtapa(Base):
    __tablename__ = "template_etapas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("templates.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)
    sla_dias: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    cor: Mapped[str] = mapped_column(String(7), nullable=False, default="#6366f1")

    template: Mapped["Template"] = relationship("Template", back_populates="etapas")
    tarefas: Mapped[list["TemplateTarefa"]] = relationship(
        "TemplateTarefa", back_populates="etapa",
        order_by="TemplateTarefa.ordem", cascade="all, delete-orphan"
    )


class TemplateTarefa(Base):
    __tablename__ = "template_tarefas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    etapa_id: Mapped[int] = mapped_column(ForeignKey("template_etapas.id"), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("template_tarefas.id"), nullable=True)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=True)
    obrigatoria: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)
    pop_pdf_path: Mapped[str] = mapped_column(String(500), nullable=True)

    etapa: Mapped["TemplateEtapa"] = relationship("TemplateEtapa", back_populates="tarefas")
    subitens: Mapped[list["TemplateTarefa"]] = relationship(
        "TemplateTarefa",
        primaryjoin="TemplateTarefa.parent_id == TemplateTarefa.id",
        foreign_keys="[TemplateTarefa.parent_id]",
        cascade="all, delete-orphan",
        order_by="TemplateTarefa.ordem",
    )
