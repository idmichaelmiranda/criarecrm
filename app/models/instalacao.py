from datetime import datetime, date, timezone
from sqlalchemy import String, Text, Integer, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class Instalacao(Base):
    __tablename__ = "instalacoes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)

    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)

    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    # pdv | coletor | forca_vendas | impressora | outro (kept for backward compat — use tipos_json)
    tipos_json: Mapped[str] = mapped_column(Text, nullable=True)
    # JSON array: '["pdv","coletor"]' — source of truth for multi-type installs

    quantidade: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="agendada")
    # agendada | em_execucao | concluida | cancelada

    prioridade: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    # normal | alta | urgente

    responsavel_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    criado_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    consultor: Mapped[str] = mapped_column(String(150), nullable=True)
    observacoes: Mapped[str] = mapped_column(Text, nullable=True)

    contato_nome: Mapped[str] = mapped_column(String(150), nullable=True)
    contato_telefone: Mapped[str] = mapped_column(String(30), nullable=True)

    data_agendada: Mapped[date] = mapped_column(Date, nullable=True)
    data_conclusao: Mapped[date] = mapped_column(Date, nullable=True)

    iniciado_em: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    iniciado_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    pausado_em: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    tempo_pausado_segundos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    finalizado_em: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    duracao_segundos: Mapped[int] = mapped_column(Integer, nullable=True)
    duracao_minutos: Mapped[int] = mapped_column(Integer, nullable=True)

    progresso: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Snapshot dos nomes de produtos no momento da criação — independente do template
    tipos_nomes_json: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="instalacoes")
    responsavel: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[responsavel_id])
    criado_por: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[criado_por_id])
    checklist: Mapped[list["InstalacaoChecklist"]] = relationship(
        "InstalacaoChecklist", back_populates="instalacao",
        order_by="InstalacaoChecklist.ordem", cascade="all, delete-orphan"
    )
    comentarios: Mapped[list["InstalacaoComentario"]] = relationship(
        "InstalacaoComentario", back_populates="instalacao",
        order_by="InstalacaoComentario.created_at", cascade="all, delete-orphan"
    )
    anexos: Mapped[list["InstalacaoAnexo"]] = relationship(
        "InstalacaoAnexo", back_populates="instalacao",
        order_by="InstalacaoAnexo.created_at", cascade="all, delete-orphan"
    )
    pausas: Mapped[list["InstalacaoPausa"]] = relationship(
        "InstalacaoPausa", back_populates="instalacao",
        order_by="InstalacaoPausa.iniciado_em", cascade="all, delete-orphan"
    )


class InstalacaoChecklist(Base):
    __tablename__ = "instalacao_checklist"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    instalacao_id: Mapped[int] = mapped_column(ForeignKey("instalacoes.id"), nullable=False)

    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pendente")
    # pendente | concluido | nao_aplicavel
    obrigatoria: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nota: Mapped[str] = mapped_column(Text, nullable=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=True)
    # which product this checklist item belongs to (null = legacy single-type)

    data_conclusao: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    instalacao: Mapped["Instalacao"] = relationship("Instalacao", back_populates="checklist")


class InstalacaoComentario(Base):
    __tablename__ = "instalacao_comentarios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    instalacao_id: Mapped[int] = mapped_column(ForeignKey("instalacoes.id"), nullable=False)

    usuario: Mapped[str] = mapped_column(String(150), nullable=False)
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    instalacao: Mapped["Instalacao"] = relationship("Instalacao", back_populates="comentarios")


class InstalacaoAnexo(Base):
    __tablename__ = "instalacao_anexos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    instalacao_id: Mapped[int] = mapped_column(ForeignKey("instalacoes.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=True)
    tamanho_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
    uploaded_by: Mapped[str] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    instalacao: Mapped["Instalacao"] = relationship("Instalacao", back_populates="anexos")


class InstalacaoPausa(Base):
    __tablename__ = "instalacao_pausas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    instalacao_id: Mapped[int] = mapped_column(ForeignKey("instalacoes.id"), nullable=False)
    pausado_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    iniciado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    retomado_em: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    duracao_segundos: Mapped[int] = mapped_column(Integer, nullable=True)

    motivo: Mapped[str] = mapped_column(String(50), nullable=True)
    # intervalo | aguardando_cliente | problema_tecnico | deslocamento | outro

    instalacao: Mapped["Instalacao"] = relationship("Instalacao", back_populates="pausas")
    pausado_por: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[pausado_por_id])
