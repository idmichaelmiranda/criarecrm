from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator, model_validator
import app.services.storage_service as storage

_MIN_PASSWORD_LEN = 8


def _check_password(v: str) -> str:
    if len(v) < _MIN_PASSWORD_LEN:
        raise ValueError(f"A senha deve ter pelo menos {_MIN_PASSWORD_LEN} caracteres.")
    return v


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
    notif_conclusao: bool = False

    @field_validator("senha")
    @classmethod
    def senha_minima(cls, v: str) -> str:
        return _check_password(v)


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    senha: Optional[str] = None
    grupo_id: Optional[int] = None
    ativo: Optional[bool] = None
    notif_conclusao: Optional[bool] = None

    @field_validator("senha")
    @classmethod
    def senha_minima(cls, v: Optional[str]) -> Optional[str]:
        return _check_password(v) if v is not None else v


class UsuarioResponse(BaseModel):
    id: int
    nome: str
    email: str
    grupo_id: Optional[int]
    grupo: Optional[GrupoMinimo]
    grupo_nome: Optional[str] = None
    ativo: bool
    pendente: bool = False
    notif_conclusao: bool = False
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _derive_fields(cls, data):
        if hasattr(data, "__dict__"):
            avatar_path = getattr(data, "avatar_path", None)
            data.__dict__.setdefault("avatar_url", storage.avatar_url(avatar_path))
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

    @field_validator("senha")
    @classmethod
    def senha_minima(cls, v: str) -> str:
        return _check_password(v)


class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    senha_nova: str

    @field_validator("senha_nova")
    @classmethod
    def senha_minima(cls, v: str) -> str:
        return _check_password(v)
