import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Uuid
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

    api_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    nome_cliente_snapshot: Mapped[str | None] = mapped_column(String(200), nullable=True)

    cliente: Mapped["Cliente | None"] = relationship("Cliente")
