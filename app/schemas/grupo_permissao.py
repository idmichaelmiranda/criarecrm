from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class GrupoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    permissoes: list[str] = []
    ativo: bool = True


class GrupoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    permissoes: Optional[list[str]] = None
    ativo: Optional[bool] = None


class GrupoResponse(BaseModel):
    id: int
    nome: str
    descricao: Optional[str]
    permissoes: list[str]
    ativo: bool
    total_usuarios: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
