from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, model_validator
from app.config import BACKEND_URL


class GrupoMinimo(BaseModel):
    id: int
    nome: str
    model_config = {"from_attributes": True}


class UsuarioCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    grupo_id: Optional[int] = None
    ativo: bool = True


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    senha: Optional[str] = None
    grupo_id: Optional[int] = None
    ativo: Optional[bool] = None


class UsuarioResponse(BaseModel):
    id: int
    nome: str
    email: str
    grupo_id: Optional[int]
    grupo: Optional[GrupoMinimo]
    grupo_nome: Optional[str] = None
    ativo: bool
    pendente: bool = False
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _derive_fields(cls, data):
        if hasattr(data, "__dict__"):
            avatar_path = getattr(data, "avatar_path", None)
            data.__dict__.setdefault("avatar_url", f"{BACKEND_URL}/uploads/avatars/{avatar_path}" if avatar_path else None)
            grupo = getattr(data, "grupo", None)
            data.__dict__.setdefault("grupo_nome", grupo.nome if grupo else None)
        return data


# ── Auto-cadastro público ─────────────────────────────────────────────────────

class RegistroRequest(BaseModel):
    nome: str
    email: EmailStr


class AprovarRequest(BaseModel):
    grupo_id: int


class DefinirSenhaRequest(BaseModel):
    senha: str
