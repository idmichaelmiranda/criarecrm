import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database.connection import get_db
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, TokenResponse, UsuarioTokenData
from app.schemas.usuario import RegistroRequest, DefinirSenhaRequest
from app.services.auth_service import verify_password, hash_password, create_access_token
from app.dependencies.auth import get_current_user
import app.services.storage_service as storage

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
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(
        select(Usuario).where(Usuario.email == data.email)
    ).scalar_one_or_none()

    if not user or not verify_password(data.senha, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )
    if user.pendente:
        raise HTTPException(status_code=403, detail="Cadastro pendente de aprovação pelo administrador.")
    if not user.ativo:
        raise HTTPException(status_code=403, detail="Usuário inativo.")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, usuario=_usuario_data(user))


@router.get("/me", response_model=UsuarioTokenData)
def me(current_user: Usuario = Depends(get_current_user)):
    return _usuario_data(current_user)


@router.post("/me/avatar", response_model=UsuarioTokenData)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Arquivo deve ser uma imagem.")
    ext = Path(file.filename).suffix.lower() or ".jpg"
    storage_path = f"avatars/{current_user.id}{ext}"
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "Imagem deve ter no máximo 5 MB.")
    await storage.upload_async(storage_path, content, file.content_type or "image/jpeg")
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
    if existing:
        raise HTTPException(400, "E-mail já cadastrado. Entre em contato com a administração.")

    user = Usuario(
        nome=data.nome.strip(),
        email=email_norm,
        senha_hash=hash_password(secrets.token_urlsafe(20)),  # senha aleatória inutilizável
        ativo=False,
        pendente=True,
    )
    db.add(user)
    db.commit()
    return {"message": "Solicitação enviada! Aguarde aprovação do administrador."}


@router.post("/definir-senha/{token}")
def definir_senha(token: str, data: DefinirSenhaRequest, db: Session = Depends(get_db)):
    """Usado no primeiro acesso após aprovação — define a senha via token enviado por email."""
    user = db.execute(
        select(Usuario).where(Usuario.access_token == token)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(404, "Link de acesso inválido.")
    if user.access_token_expires_at and datetime.now(timezone.utc) > user.access_token_expires_at:
        raise HTTPException(410, "Este link expirou. Solicite um novo ao administrador.")
    if len(data.senha) < 6:
        raise HTTPException(400, "A senha deve ter pelo menos 6 caracteres.")

    user.senha_hash = hash_password(data.senha)
    user.ativo = True
    user.pendente = False
    user.access_token = None
    user.access_token_expires_at = None
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Senha definida com sucesso! Você já pode fazer login."}
