from datetime import datetime, timedelta, timezone
from sqlalchemy import String, Text, Integer, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database.connection import Base


class Solicitacao(Base):
    __tablename__ = "solicitacoes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Campos principais (colunas diretas para busca/filtro)
    razao_social: Mapped[str] = mapped_column(String(200), nullable=False)
    nome_fantasia: Mapped[str] = mapped_column(String(200), nullable=True)
    cnpj: Mapped[str] = mapped_column(String(18), nullable=False, index=True)
    ie: Mapped[str] = mapped_column(String(30), nullable=True)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    telefone_fixo: Mapped[str] = mapped_column(String(20), nullable=True)
    telefone_celular: Mapped[str] = mapped_column(String(20), nullable=False)
    responsavel: Mapped[str] = mapped_column(String(150), nullable=True)

    # Dados complementares como JSON
    endereco: Mapped[dict] = mapped_column(JSON, nullable=True)
    contabilidade: Mapped[dict] = mapped_column(JSON, nullable=True)
    dados_bancarios: Mapped[dict] = mapped_column(JSON, nullable=True)
    dados_contabeis: Mapped[dict] = mapped_column(JSON, nullable=True)
    formas_pagamento: Mapped[dict] = mapped_column(JSON, nullable=True)
    dados_fiscais: Mapped[dict] = mapped_column(JSON, nullable=True)
    adquirentes: Mapped[list] = mapped_column(JSON, nullable=True)

    # Certificado digital
    certificado_path: Mapped[str] = mapped_column(String(500), nullable=True)

    # Triagem
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="nova")
    # nova | em_triagem | aprovada | recusada | aguardando_correcao | cancelada
    observacoes_triagem: Mapped[str] = mapped_column(Text, nullable=True)
    motivo_recusa: Mapped[str] = mapped_column(Text, nullable=True)
    prioridade: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    # baixa | normal | alta | critica

    # SLA de triagem
    sla_horas: Mapped[int] = mapped_column(Integer, nullable=False, default=48)
    sla_limite: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Seções marcadas para correção (lista de keys: "empresa", "contato", etc.)
    campos_correcao: Mapped[list] = mapped_column(JSON, nullable=True)

    # Histórico acumulado de recusas [{data, motivo, campos}]
    historico_recusas: Mapped[list] = mapped_column(JSON, nullable=True)

    # Revisão pelo cliente (token de acesso público, expira em 7 dias)
    review_token: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    review_token_expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
