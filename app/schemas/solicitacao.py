from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, field_validator
import re

PrioridadeType = Literal["baixa", "normal", "alta", "critica"]
StatusSolicitacaoType = Literal[
    "nova", "em_triagem", "aprovada", "recusada", "aguardando_correcao", "cancelada"
]


# ── Payload aceito do formulário público ─────────────────────────────────────

class _ClienteData(BaseModel):
    razao_social: str
    nome_fantasia: str | None = None
    cnpj: str
    ie: str | None = None
    email: EmailStr
    telefone_fixo: str | None = None
    telefone_celular: str
    responsavel: str | None = None

    @field_validator("cnpj")
    @classmethod
    def validate_cnpj(cls, v: str) -> str:
        if len(re.sub(r"\D", "", v)) != 14:
            raise ValueError("CNPJ deve conter 14 dígitos")
        return v


class SolicitacaoCreate(BaseModel):
    cliente: _ClienteData
    endereco: dict
    contabilidade: dict
    dados_bancarios: dict
    dados_contabeis: dict
    formas_pagamento: dict
    dados_fiscais: dict
    adquirentes: list = []
    implantacao: dict = {}


# ── Ações de triagem ──────────────────────────────────────────────────────────

class TriagemAprovar(BaseModel):
    template_ids: list[int]
    consultor: str | None = None
    prioridade: PrioridadeType = "normal"
    sla_dias: int = 30
    observacoes: str | None = None
    conversao_dados: bool = False

    @field_validator("template_ids")
    @classmethod
    def at_least_one(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("Selecione ao menos um módulo")
        return v


class TriagemRecusar(BaseModel):
    motivo: str
    campos_correcao: list[str] | None = None


class TriagemCancelar(BaseModel):
    motivo: str | None = None


class AtribuirResponsavelPayload(BaseModel):
    responsavel_id: int | None = None


# ── Responses ────────────────────────────────────────────────────────────────

class SolicitacaoListResponse(BaseModel):
    id: int
    razao_social: str
    nome_fantasia: str | None
    cnpj: str
    email: str
    telefone_celular: str
    responsavel: str | None
    status: StatusSolicitacaoType
    prioridade: PrioridadeType
    sla_horas: int
    sla_limite: datetime | None
    motivo_recusa: str | None
    campos_correcao: list[str] | None
    historico_recusas: list | None
    created_at: datetime
    responsavel_triagem_id: int | None = None
    responsavel_triagem_nome: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        if hasattr(obj, "responsavel_triagem") and obj.responsavel_triagem:
            instance.responsavel_triagem_nome = obj.responsavel_triagem.nome
        return instance


class SolicitacaoResponse(SolicitacaoListResponse):
    ie: str | None
    telefone_fixo: str | None
    endereco: dict | None
    contabilidade: dict | None
    dados_bancarios: dict | None
    dados_contabeis: dict | None
    formas_pagamento: dict | None
    dados_fiscais: dict | None
    adquirentes: list | None
    certificado_path: str | None
    observacoes_triagem: str | None
    motivo_recusa: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Schema público para o formulário de revisão (não expõe dados admin) ───────

class SolicitacaoRevisaoPublic(BaseModel):
    razao_social: str
    nome_fantasia: str | None
    cnpj: str
    ie: str | None
    email: str
    telefone_fixo: str | None
    telefone_celular: str
    responsavel: str | None
    endereco: dict | None
    contabilidade: dict | None
    dados_bancarios: dict | None
    dados_contabeis: dict | None
    formas_pagamento: dict | None
    dados_fiscais: dict | None
    adquirentes: list | None
    certificado_path: str | None
    motivo_recusa: str | None
    campos_correcao: list[str] | None

    model_config = {"from_attributes": True}
