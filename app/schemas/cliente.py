from datetime import datetime
from pydantic import BaseModel


class ClienteListResponse(BaseModel):
    id: int
    razao_social: str
    nome_fantasia: str | None
    cnpj: str
    email: str
    telefone_celular: str
    responsavel: str | None
    ativo: bool
    created_at: datetime
    updated_at: datetime
    endereco: dict | None = None
    dados_contabeis: dict | None = None

    model_config = {"from_attributes": True}


class ClienteResponse(ClienteListResponse):
    ie: str | None
    telefone_fixo: str | None
    solicitacao_id: int | None
    endereco: dict | None
    contabilidade: dict | None
    dados_bancarios: dict | None
    dados_contabeis: dict | None
    formas_pagamento: dict | None
    dados_fiscais: dict | None
    adquirentes: list | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClienteUpdate(BaseModel):
    razao_social: str | None = None
    nome_fantasia: str | None = None
    ie: str | None = None
    email: str | None = None
    telefone_fixo: str | None = None
    telefone_celular: str | None = None
    responsavel: str | None = None
    endereco: dict | None = None
    contabilidade: dict | None = None
    dados_bancarios: dict | None = None
    dados_contabeis: dict | None = None
    formas_pagamento: dict | None = None
    dados_fiscais: dict | None = None
    adquirentes: list | None = None
