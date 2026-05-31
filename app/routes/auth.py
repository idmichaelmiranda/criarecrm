import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database.connection import get_db
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, TokenResponse, UsuarioTokenData
from app.schemas.usuario import RegistroRequest, DefinirSenhaRequest
from app.services.auth_service import verify_password, hash_password, create_access_token, decode_token, revoke_token
from app.services.rate_limit import _client_ip, check_login_rate, record_login_failure, clear_login_failures
from app.dependencies.auth import get_current_user
from app.utils.file_magic import detect_image
import app.services.storage_service as storage

_bearer_optional = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/auth", tags=["auth"])


def _usuario_data(user: Usuario) -> UsuarioTokenData:
    return UsuarioTokenData(
        id=user.id,
        nome=user.nome,
        email=user.email,
        grupo_id=user.grupo_id,
        grupo_nome=user.grupo.nome if user.grupo else None,
        permissoes=user.grupo.permissoes if user.grupo else [],
        ativo=user.ativo,
        avatar_url=storage.avatar_url(user.avatar_path),
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    check_login_rate(ip)

    user = db.execute(
        select(Usuario).where(func.lower(Usuario.email) == data.email.strip().lower())
    ).scalar_one_or_none()

    if not user or not verify_password(data.senha, user.senha_hash):
        record_login_failure(ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )
    if user.pendente:
        record_login_failure(ip)
        raise HTTPException(status_code=403, detail="Cadastro pendente de aprovação pelo administrador.")
    if not user.ativo:
        record_login_failure(ip)
        raise HTTPException(status_code=403, detail="Usuário inativo.")

    clear_login_failures(ip)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, usuario=_usuario_data(user))


@router.post("/logout")
def logout(credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional)):
    """Revoga o token JWT atual — impede reuso mesmo antes da expiração."""
    if credentials:
        payload = decode_token(credentials.credentials)
        if payload:
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                revoke_token(jti, float(exp))
    return {"ok": True}


@router.get("/me", response_model=UsuarioTokenData)
def me(current_user: Usuario = Depends(get_current_user)):
    return _usuario_data(current_user)


@router.post("/me/avatar", response_model=UsuarioTokenData)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "Imagem deve ter no máximo 5 MB.")
    # Fix 16: valida por magic bytes — Content-Type pode ser falsificado
    ext, mime = detect_image(content)
    if ext is None:
        raise HTTPException(400, "Arquivo não reconhecido como imagem válida (JPEG, PNG, GIF ou WebP).")
    storage_path = f"avatars/{current_user.id}{ext}"
    await storage.upload_async(storage_path, content, mime)
    current_user.avatar_path = storage_path
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    return _usuario_data(current_user)


@router.post("/registro", status_code=201)
def registro(data: RegistroRequest, db: Session = Depends(get_db)):
    """Cadastro público — cria usuário pendente de aprovação pelo admin."""
    email_norm = data.email.strip().lower()
    existing = db.execute(
        select(Usuario).where(Usuario.email == email_norm)
    ).scalar_one_or_none()
    # Fix 13: equaliza o tempo de resposta para evitar enumeração de e-mails por timing.
    # A mensagem de retorno é idêntica independentemente de o e-mail existir ou não.
    _dummy_hash = hash_password(secrets.token_urlsafe(20))
    if existing:
        return {"message": "Solicitação enviada! Aguarde aprovação do administrador."}

    user = Usuario(
        nome=data.nome.strip(),
        email=email_norm,
        senha_hash=_dummy_hash,  # mesmo hash já calculado
        ativo=False,
        pendente=True,
    )
    db.add(user)
    db.commit()
    return {"message": "Solicitação enviada! Aguarde aprovação do administrador."}


@router.post("/definir-senha/{token}")
def definir_senha(token: str, data: DefinirSenhaRequest, request: Request, db: Session = Depends(get_db)):
    """Usado no primeiro acesso após aprovação — define a senha via token enviado por email."""
    # Fix 15: rate limit por IP para bloquear força bruta de tokens
    ip = _client_ip(request)
    check_login_rate(f"definir:{ip}")

    user = db.execute(
        select(Usuario).where(Usuario.access_token == token)
    ).scalar_one_or_none()

    if not user:
        record_login_failure(f"definir:{ip}")
        raise HTTPException(404, "Link de acesso inválido.")
    expires = user.access_token_expires_at
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
    if expires and datetime.now(timezone.utc) > expires:
        record_login_failure(f"definir:{ip}")
        raise HTTPException(410, "Este link expirou. Solicite um novo ao administrador.")

    # Fix 14: mínimo de 8 caracteres (validado pelo schema, mas redundância intencional)
    if len(data.senha) < 8:
        raise HTTPException(400, "A senha deve ter pelo menos 8 caracteres.")

    clear_login_failures(f"definir:{ip}")
    user.senha_hash = hash_password(data.senha)
    user.ativo = True
    user.pendente = False
    user.access_token = None
    user.access_token_expires_at = None
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Senha definida com sucesso! Você já pode fazer login."}
