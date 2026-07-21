import secrets
import json as _json
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database.connection import get_db
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse, AprovarRequest, AlterarSenhaRequest
from app.services.auth_service import hash_password, verify_password
from app.dependencies.auth import get_current_user, require_permission

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


_SENHA_DIA_URL = "http://criaresuporte1.no-ip.info:9000/api/gerente/v2/getpasswordfortoday"
_SENHA_DIA_ALLOWED_KEYS = {"password", "senha", "data", "value"}


@router.get("/senha-dia")
def senha_dia(_: Usuario = Depends(require_permission("usuarios.edit"))):
    """Proxy para buscar a senha do dia do servidor de suporte interno.
    Restrito a usuários com permissão usuarios.edit (gestores/admin).
    A URL de destino é fixa — não aceita parâmetros externos."""
    try:
        with urllib.request.urlopen(_SENHA_DIA_URL, timeout=5) as resp:
            if resp.status != 200:
                raise HTTPException(503, "Servidor de senha indisponível")
            raw = resp.read(4096).decode("utf-8", errors="replace").strip()
        try:
            data = _json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError("resposta inesperada")
            senha = next(
                (str(data[k]) for k in _SENHA_DIA_ALLOWED_KEYS if k in data and data[k]),
                raw,
            )
        except Exception:
            senha = raw
        return {"senha": senha}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Servidor de senha indisponível")


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
    _: Usuario = Depends(require_permission("usuarios.view")),
):
    return db.execute(select(Usuario).order_by(Usuario.pendente.desc(), Usuario.nome)).scalars().all()


@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obter(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    # Permite auto-consulta; caso contrário exige usuarios.view
    if current_user.id != usuario_id:
        permissoes = current_user.grupo.permissoes if current_user.grupo else []
        if "usuarios.view" not in permissoes:
            raise HTTPException(403, "Permissão 'usuarios.view' necessária")
    return u


@router.post("/", response_model=UsuarioResponse, status_code=201)
def criar(
    data: UsuarioCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_permission("usuarios.create")),
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
        notif_conclusao=data.notif_conclusao,
        pode_aprovar_instalador=data.pode_aprovar_instalador,
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
    _: Usuario = Depends(require_permission("usuarios.edit")),
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
    u.access_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    u.updated_at = datetime.now(timezone.utc)
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
    _: Usuario = Depends(require_permission("usuarios.edit")),
):
    """Regenera o token de acesso e reenvia o e-mail de definição de senha."""
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    if u.pendente:
        raise HTTPException(400, "Usuário ainda pendente de aprovação.")

    from app.services.email_service import get_config, send_boas_vindas_email_async
    from app.config import RESEND_API_KEY
    cfg = get_config()
    if not RESEND_API_KEY and (not cfg or not cfg.get("host")):
        raise HTTPException(400, "Nenhum provider de email configurado. Configure SMTP em Configurações > Email ou defina RESEND_API_KEY.")

    token = secrets.token_urlsafe(40)
    u.access_token = token
    u.access_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    u.updated_at = datetime.now(timezone.utc)
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

    permissoes = current_user.grupo.permissoes if current_user.grupo else []
    tem_permissao_edit = "usuarios.edit" in permissoes
    is_self = current_user.id == usuario_id

    # Campos que exigem permissão administrativa — não podem ser auto-editados
    campos_admin = [data.nome, data.email, data.senha, data.grupo_id, data.ativo, data.pode_aprovar_instalador]
    editando_campos_admin = any(v is not None for v in campos_admin)

    if editando_campos_admin and not tem_permissao_edit:
        raise HTTPException(403, "Permissão 'usuarios.edit' necessária para alterar esses campos")

    if not is_self and not tem_permissao_edit:
        raise HTTPException(403, "Permissão 'usuarios.edit' necessária para editar outros usuários")

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
    if data.notif_conclusao is not None:
        u.notif_conclusao = data.notif_conclusao
    if data.pode_aprovar_instalador is not None:
        u.pode_aprovar_instalador = data.pode_aprovar_instalador

    u.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(u)
    return u


@router.post("/me/alterar-senha")
def alterar_minha_senha(
    data: AlterarSenhaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if not verify_password(data.senha_atual, current_user.senha_hash):
        raise HTTPException(400, "Senha atual incorreta.")
    current_user.senha_hash = hash_password(data.senha_nova)
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


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
