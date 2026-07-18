from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    solicitacao_id: Mapped[int] = mapped_column(ForeignKey("solicitacoes.id"), nullable=True)

    razao_social: Mapped[str] = mapped_column(String(200), nullable=False)
    nome_fantasia: Mapped[str] = mapped_column(String(200), nullable=True)
    cnpj: Mapped[str] = mapped_column(String(18), unique=True, nullable=False, index=True)
    ie: Mapped[str] = mapped_column(String(30), nullable=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    telefone_fixo: Mapped[str] = mapped_column(String(20), nullable=True)
    telefone_celular: Mapped[str] = mapped_column(String(20), nullable=False)
    responsavel: Mapped[str] = mapped_column(String(150), nullable=True)

    endereco: Mapped[dict] = mapped_column(JSON, nullable=True)
    contabilidade: Mapped[dict] = mapped_column(JSON, nullable=True)
    dados_bancarios: Mapped[dict] = mapped_column(JSON, nullable=True)
    dados_contabeis: Mapped[dict] = mapped_column(JSON, nullable=True)
    formas_pagamento: Mapped[dict] = mapped_column(JSON, nullable=True)
    dados_fiscais: Mapped[dict] = mapped_column(JSON, nullable=True)
    adquirentes: Mapped[list] = mapped_column(JSON, nullable=True)

    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    origem: Mapped[str] = mapped_column(String(20), default="triagem", server_default="triagem", nullable=False)

    chave_api_hash: Mapped[str] = mapped_column(String(100), nullable=True)
    chave_api_criada_em: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    implantacoes: Mapped[list["Implantacao"]] = relationship(
        "Implantacao", back_populates="cliente"
    )
    instalacoes: Mapped[list["Instalacao"]] = relationship(
        "Instalacao", back_populates="cliente"
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
