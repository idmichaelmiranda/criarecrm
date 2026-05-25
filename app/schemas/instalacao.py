import json
from datetime import datetime, date
from typing import Literal
from pydantic import BaseModel, model_validator

TipoInstalacaoType = str  # aceita qualquer slug de template de instalação
StatusInstalacaoType = Literal["agendada", "em_execucao", "concluida", "cancelada"]
PrioridadeType = Literal["normal", "alta", "urgente"]
StatusItemType = Literal["pendente", "concluido", "nao_aplicavel"]

class TipoInstalacaoInfo(BaseModel):
    id: int
    nome: str
    tipo: str
    cor: str
    n_tarefas: int
    ativo: bool


TIPO_LABELS = {
    "pdv": "PDV Adicional",
    "coletor": "Coletor Mobile",
    "forca_vendas": "Força de Vendas",
    "impressora": "Impressora",
    "outro": "Outro",
}


# ── Checklist ─────────────────────────────────────────────────────────────────

class ChecklistItemResponse(BaseModel):
    id: int
    titulo: str
    status: str
    obrigatoria: bool
    ordem: int
    nota: str | None = None
    tipo: str | None = None
    data_conclusao: datetime | None

    model_config = {"from_attributes": True}


class ChecklistItemCreate(BaseModel):
    titulo: str
    obrigatoria: bool = True


class ChecklistItemUpdate(BaseModel):
    status: StatusItemType | None = None
    titulo: str | None = None
    nota: str | None = None


# ── Comentários ───────────────────────────────────────────────────────────────

class ComentarioResponse(BaseModel):
    id: int
    usuario: str
    conteudo: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ComentarioCreate(BaseModel):
    conteudo: str
    usuario: str = "Admin"


# ── Instalação ────────────────────────────────────────────────────────────────

class InstalacaoCreate(BaseModel):
    cliente_id: int
    tipos: list[TipoInstalacaoType]   # multi-type (replaces single tipo)
    quantidade: int = 1
    prioridade: PrioridadeType = "normal"
    responsavel_id: int | None = None
    observacoes: str | None = None
    data_agendada: date | None = None
    contato_nome: str | None = None
    contato_telefone: str | None = None

    @model_validator(mode="after")
    def _validate_tipos(self):
        if not self.tipos:
            raise ValueError("Selecione ao menos um tipo de produto.")
        return self


class InstalacaoUpdate(BaseModel):
    status: StatusInstalacaoType | None = None
    prioridade: PrioridadeType | None = None
    responsavel_id: int | None = None
    observacoes: str | None = None
    data_agendada: date | None = None
    data_conclusao: date | None = None
    contato_nome: str | None = None
    contato_telefone: str | None = None


def _parse_tipos(inst) -> list[str]:
    """Derive tipos list from tipos_json, falling back to legacy tipo field."""
    raw = getattr(inst, "tipos_json", None)
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list) and parsed:
                return parsed
        except Exception:
            pass
    fallback = getattr(inst, "tipo", None)
    return [fallback] if fallback else []


class InstalacaoListResponse(BaseModel):
    id: int
    codigo: str
    tipo: str
    tipos: list[str] = []
    quantidade: int
    status: str
    prioridade: str
    responsavel_id: int | None = None
    responsavel_nome: str | None = None
    responsavel_avatar_url: str | None = None
    data_agendada: date | None
    data_conclusao: date | None
    progresso: int
    created_at: datetime

    cliente_id: int
    cliente_nome: str | None = None
    cliente_cnpj: str | None = None
    contato_nome: str | None = None
    contato_telefone: str | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _derive_tipos(cls, data):
        if hasattr(data, "__dict__"):
            data.__dict__.setdefault("tipos", _parse_tipos(data))
        return data


class InstalacaoFullResponse(BaseModel):
    id: int
    codigo: str
    tipo: str
    tipos: list[str] = []
    quantidade: int
    status: str
    prioridade: str
    responsavel_id: int | None = None
    responsavel_nome: str | None = None
    responsavel_avatar_url: str | None = None
    observacoes: str | None = None
    contato_nome: str | None = None
    contato_telefone: str | None = None
    data_agendada: date | None
    data_conclusao: date | None
    iniciado_em: datetime | None = None
    finalizado_em: datetime | None = None
    duracao_minutos: int | None = None
    progresso: int
    created_at: datetime
    updated_at: datetime

    cliente_id: int
    template_id: int | None = None
    template_pop_pdf_path: str | None = None
    checklist: list[ChecklistItemResponse] = []
    comentarios: list[ComentarioResponse] = []

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _derive_tipos(cls, data):
        if hasattr(data, "__dict__"):
            data.__dict__.setdefault("tipos", _parse_tipos(data))
        return data
