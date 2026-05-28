from datetime import datetime, date
from typing import Literal
from pydantic import BaseModel

StatusImplantacaoType = Literal["em_andamento", "pausada", "concluida", "cancelada"]
StatusEtapaType = Literal["pendente", "em_andamento", "concluida", "bloqueada", "pulada"]
StatusItemType = Literal["pendente", "concluido", "bloqueado", "nao_aplicavel"]


class ChecklistItemResponse(BaseModel):
    id: int
    titulo: str
    descricao: str | None
    status: str
    obrigatoria: bool
    ordem: int
    data_conclusao: datetime | None
    etapa_id: int | None
    template_tarefa_id: int | None
    responsavel: str | None
    data_prazo: date | None
    pop_pdf_path: str | None = None
    parent_id: int | None = None
    arquivado: bool = False
    subitens: list["ChecklistItemResponse"] = []

    model_config = {"from_attributes": True}


ChecklistItemResponse.model_rebuild()


class ChecklistItemCreate(BaseModel):
    titulo: str
    etapa_id: int | None = None
    parent_id: int | None = None
    obrigatoria: bool = False
    descricao: str | None = None
    responsavel: str | None = None
    data_prazo: date | None = None


class ChecklistItemUpdate(BaseModel):
    status: StatusItemType | None = None
    descricao: str | None = None
    responsavel: str | None = None
    responsavel_id: int | None = None
    data_prazo: date | None = None
    etapa_id: int | None = None
    titulo: str | None = None
    arquivado: bool | None = None


class EtapaManualUpdate(BaseModel):
    status: StatusEtapaType


class EtapaCreate(BaseModel):
    nome: str
    cor: str = "#6366f1"
    sla_dias: int = 3


class EtapaPropsUpdate(BaseModel):
    nome: str | None = None
    cor: str | None = None
    sla_dias: int | None = None
    status: StatusEtapaType | None = None


class EtapaReorder(BaseModel):
    ordens: list[dict]  # [{id: int, ordem: int}]


class ChecklistReorder(BaseModel):
    ordens: list[dict]  # [{id: int, ordem: int}]


class EtapaResponse(BaseModel):
    id: int
    nome: str
    ordem: int
    status: str
    cor: str
    sla_dias: int
    data_inicio: datetime | None
    data_conclusao: datetime | None
    itens: list[ChecklistItemResponse] = []

    model_config = {"from_attributes": True}


class TimelineResponse(BaseModel):
    id: int
    tipo: str
    titulo: str | None
    descricao: str | None
    usuario: str | None
    icone: str | None
    cor: str | None
    dados: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ComentarioResponse(BaseModel):
    id: int
    usuario: str
    conteudo: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComentarioCreate(BaseModel):
    conteudo: str
    usuario: str = "Admin"


class ChecklistItemFlatResponse(BaseModel):
    """Flat (non-nested) checklist item — used to build subitems index on the frontend."""
    id: int
    parent_id: int | None = None
    etapa_id: int | None = None
    status: str
    arquivado: bool = False

    model_config = {"from_attributes": True}


class ImplantacaoListResponse(BaseModel):
    id: int
    codigo: str
    nome: str
    status: str
    progresso: int
    prioridade: str
    consultor: str | None
    sla_dias: int
    sla_limite: date | None
    sla_status: str
    data_inicio: date | None
    data_prevista: date | None
    created_at: datetime
    conversao_dados: bool = False

    # Info do cliente (join)
    cliente_id: int
    cliente_nome: str | None = None
    cliente_cnpj: str | None = None

    tarefas_vencidas: int = 0

    model_config = {"from_attributes": True}


class ImplantacaoUpdate(BaseModel):
    status: StatusImplantacaoType | None = None
    consultor: str | None = None
    observacoes: str | None = None
    prioridade: str | None = None
    data_prevista: date | None = None


class ImplantacaoFullResponse(BaseModel):
    id: int
    codigo: str
    nome: str
    status: str
    progresso: int
    prioridade: str
    consultor: str | None
    observacoes: str | None
    sla_dias: int
    sla_limite: date | None
    sla_status: str
    certificado_path: str | None
    data_inicio: date | None
    data_prevista: date | None
    data_conclusao: date | None
    created_at: datetime
    updated_at: datetime
    conversao_dados: bool = False

    cliente_id: int
    solicitacao_id: int | None
    etapas: list[EtapaResponse] = []
    checklist: list[ChecklistItemFlatResponse] = []
    timeline: list[TimelineResponse] = []
    comentarios: list[ComentarioResponse] = []

    model_config = {"from_attributes": True}
