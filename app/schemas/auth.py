from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class UsuarioTokenData(BaseModel):
    id: int
    nome: str
    email: str
    grupo_id: Optional[int]
    grupo_nome: Optional[str]
    permissoes: list[str]
    ativo: bool
    avatar_url: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioTokenData
