import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Uuid, JSON, Integer, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class SolicitacaoInstalador(Base):
    """Pedido de instalação criado pelo Assistente Criare (CriareInstaller) a partir do
    CNPJ digitado pelo técnico em campo. Fluxo: pendente -> aprovada/recusada/expirada/cancelada.
    Não confundir com Solicitacao (triagem de cliente novo) nem com Instalacao
    (checklist de instalação já em execução) — conceitos diferentes."""

    __tablename__ = "solicitacoes_instalador"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    cnpj: Mapped[str] = mapped_column(String(14), nullable=False, index=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id"), nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pendente")
    # pendente | aprovada | recusada | expirada

    criado_em: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expira_em: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    aprovado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recusado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    aprovado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    recusado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    api_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    nome_cliente_snapshot: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Snapshot da máquina que pediu a instalação (best-effort via WMI no CriareInstaller —
    # qualquer campo pode faltar). Ex.: {"processador":..., "nucleos":..., "memoria_ram_gb":...,
    # "disco": {"tipo":..., "espaco_total_gb":..., "espaco_livre_gb":...},
    # "windows": {"versao":..., "build":..., "arquitetura":...}}
    maquina_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    cliente: Mapped["Cliente | None"] = relationship("Cliente")
    aprovado_por: Mapped["Usuario | None"] = relationship("Usuario", foreign_keys=[aprovado_por_id])
    recusado_por: Mapped["Usuario | None"] = relationship("Usuario", foreign_keys=[recusado_por_id])
    etapas: Mapped[list["SolicitacaoInstaladorEtapa"]] = relationship(
        "SolicitacaoInstaladorEtapa", back_populates="solicitacao",
        cascade="all, delete-orphan", order_by="SolicitacaoInstaladorEtapa.indice_etapa",
    )


class SolicitacaoInstaladorEtapa(Base):
    """Progresso reportado pelo CriareInstaller durante a execução de uma instalação já
    aprovada. Uma linha por etapa (indice_etapa) por solicitação — cada PUT do instalador
    é um UPSERT nessa linha, não um evento de histórico. A tela de acompanhamento no
    Assistente Criare lê essas linhas via polling: a que está em_andamento é a etapa
    atual (percentual/mensagem ao vivo), as com concluido_em preenchido formam a
    timeline."""

    __tablename__ = "solicitacoes_instalador_etapas"
    __table_args__ = (UniqueConstraint("solicitacao_id", "indice_etapa", name="uq_solicitacao_instalador_etapa"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    solicitacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("solicitacoes_instalador.id"), nullable=False, index=True)
    indice_etapa: Mapped[int] = mapped_column(Integer, nullable=False)

    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    total_etapas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="em_andamento")
    # em_andamento | concluida | falhou
    percentual: Mapped[float | None] = mapped_column(Float, nullable=True)
    mensagem: Mapped[str | None] = mapped_column(String(500), nullable=True)

    iniciado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    concluido_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False,
    )

    solicitacao: Mapped["SolicitacaoInstalador"] = relationship("SolicitacaoInstalador", back_populates="etapas")
