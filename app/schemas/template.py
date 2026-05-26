from datetime import datetime
from pydantic import BaseModel


class TemplateTarefaResponse(BaseModel):
    id: int
    parent_id: int | None = None
    titulo: str
    descricao: str | None
    obrigatoria: bool
    ordem: int
    pop_pdf_path: str | None = None
    subitens: list["TemplateTarefaResponse"] = []

    model_config = {"from_attributes": True}


TemplateTarefaResponse.model_rebuild()


class TemplateEtapaResponse(BaseModel):
    id: int
    nome: str
    ordem: int
    sla_dias: int
    cor: str
    tarefas: list[TemplateTarefaResponse] = []

    model_config = {"from_attributes": True}


class TemplateResponse(BaseModel):
    id: int
    nome: str
    descricao: str | None
    tipo: str | None
    sla_total_dias: int
    ativo: bool
    pop_pdf_path: str | None = None
    etapas: list[TemplateEtapaResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    id: int
    nome: str
    descricao: str | None
    tipo: str | None
    sla_total_dias: int
    ativo: bool
    pop_pdf_path: str | None = None

    model_config = {"from_attributes": True}


# ── Create / Update ───────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    nome: str
    descricao: str | None = None
    tipo: str | None = None
    sla_total_dias: int = 30
    ativo: bool = True


class TemplateUpdate(BaseModel):
    nome: str | None = None
    descricao: str | None = None
    tipo: str | None = None
    sla_total_dias: int | None = None
    ativo: bool | None = None


class EtapaCreate(BaseModel):
    nome: str
    ordem: int
    sla_dias: int = 3
    cor: str = "#6366f1"


class EtapaUpdate(BaseModel):
    nome: str | None = None
    ordem: int | None = None
    sla_dias: int | None = None
    cor: str | None = None


class TarefaCreate(BaseModel):
    titulo: str
    descricao: str | None = None
    obrigatoria: bool = True
    ordem: int


class TarefaUpdate(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    obrigatoria: bool | None = None
    ordem: int | None = None
