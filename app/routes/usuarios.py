import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database.connection import get_db
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse, AprovarRequest
from app.services.auth_service import hash_password
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("/pendentes/count")
def pendentes_count(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    count = db.execute(
        select(func.count()).select_from(Usuario).where(Usuario.pendente == True)
    ).scalar_one()
    return {"count": count}


@router.get("/", response_model=list[UsuarioResponse])
def listar(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    return db.execute(select(Usuario).order_by(Usuario.pendente.desc(), Usuario.nome)).scalars().all()


@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obter(
    usuario_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    return u


@router.post("/", response_model=UsuarioResponse, status_code=201)
def criar(
    data: UsuarioCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    existing = db.execute(
        select(Usuario).where(Usuario.email == data.email)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "E-mail já cadastrado")

    u = Usuario(
        nome=data.nome,
        email=data.email,
        senha_hash=hash_password(data.senha),
        grupo_id=data.grupo_id,
        ativo=data.ativo,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.post("/{usuario_id}/aprovar", response_model=UsuarioResponse)
def aprovar(
    usuario_id: int,
    data: AprovarRequest,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """Aprova um cadastro pendente, gera token de acesso e envia email de boas-vindas."""
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    if not u.pendente:
        raise HTTPException(400, "Este usuário não está pendente de aprovação.")

    token = secrets.token_urlsafe(40)
    u.grupo_id = data.grupo_id
    u.pendente = False
    u.access_token = token
    u.access_token_expires_at = datetime.now() + timedelta(hours=24)
    u.updated_at = datetime.now()
    db.commit()
    db.refresh(u)

    # Envia email em background — falha silenciosa para não bloquear a aprovação
    from app.services.email_service import get_config, send_boas_vindas_email_async
    cfg = get_config()
    if cfg and cfg.get("host"):
        frontend_url = (cfg.get("frontend_url") or "").rstrip("/")
        link = f"{frontend_url}/definir-senha/{token}" if frontend_url else f"/definir-senha/{token}"
        send_boas_vindas_email_async(u.email, u.nome, link)
    else:
        print(f"[AVISO] Email não enviado para {u.email}: SMTP não configurado.")

    return u


@router.post("/{usuario_id}/reenviar-senha")
def reenviar_senha(
    usuario_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """Regenera o token de acesso e reenvia o e-mail de definição de senha."""
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    if u.pendente:
        raise HTTPException(400, "Usuário ainda pendente de aprovação.")

    from app.services.email_service import get_config, send_boas_vindas_email_async
    cfg = get_config()
    if not cfg or not cfg.get("host"):
        raise HTTPException(400, "SMTP não configurado. Configure o email em Configurações > Email.")

    token = secrets.token_urlsafe(40)
    u.access_token = token
    u.access_token_expires_at = datetime.now() + timedelta(hours=24)
    u.updated_at = datetime.now()
    db.commit()

    frontend_url = (cfg.get("frontend_url") or "").rstrip("/")
    link = f"{frontend_url}/definir-senha/{token}" if frontend_url else f"/definir-senha/{token}"
    send_boas_vindas_email_async(u.email, u.nome, link)

    return {"ok": True, "message": f"E-mail enviado para {u.email}."}


@router.patch("/{usuario_id}", response_model=UsuarioResponse)
def atualizar(
    usuario_id: int,
    data: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")

    if data.nome is not None:
        u.nome = data.nome
    if data.email is not None:
        existing = db.execute(
            select(Usuario).where(Usuario.email == data.email, Usuario.id != usuario_id)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(400, "E-mail já cadastrado")
        u.email = data.email
    if data.senha is not None:
        u.senha_hash = hash_password(data.senha)
    if data.grupo_id is not None:
        u.grupo_id = data.grupo_id
    if data.ativo is not None:
        u.ativo = data.ativo

    u.updated_at = datetime.now()
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{usuario_id}", status_code=204)
def deletar(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    if u.id == current_user.id:
        raise HTTPException(400, "Você não pode excluir sua própria conta")
    db.delete(u)
    db.commit()
