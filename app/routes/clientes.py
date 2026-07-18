import secrets
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.database.connection import get_db
from app.schemas.cliente import ClienteListResponse, ClienteResponse, ClienteUpdate
from app.models.cliente import Cliente
from app.dependencies.auth import get_current_user, require_permission
from app.models.usuario import Usuario
from app.services import sql_generator_service
from app.services.auth_service import hash_password

router = APIRouter(prefix="/clientes", tags=["clientes"])

_auth = Depends(get_current_user)


@router.get("/", response_model=list[ClienteListResponse])
def listar(db: Session = Depends(get_db)):
    return db.execute(
        select(Cliente)
        .where(Cliente.origem == "triagem")
        .order_by(Cliente.updated_at.desc())
    ).scalars().all()


@router.get("/buscar-cnpj", response_model=ClienteListResponse)
def buscar_por_cnpj(
    cnpj: str = Query(..., description="CNPJ do cliente"),
    db: Session = Depends(get_db),
    _: Usuario = _auth,
):
    """Verifica se já existe um cliente cadastrado com o CNPJ informado."""
    c = db.execute(select(Cliente).where(Cliente.cnpj == cnpj)).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Nenhum cliente encontrado com este CNPJ")
    return c


@router.get("/buscar-email", response_model=ClienteListResponse)
def buscar_por_email(
    email: str = Query(..., description="E-mail do cliente"),
    db: Session = Depends(get_db),
    _: Usuario = _auth,
):
    """Verifica se já existe um cliente cadastrado com o e-mail informado."""
    c = db.execute(select(Cliente).where(Cliente.email == email)).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Nenhum cliente encontrado com este e-mail")
    return c


@router.get("/{cliente_id}", response_model=ClienteResponse)
def obter(cliente_id: int, db: Session = Depends(get_db)):
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    return c


@router.patch("/{cliente_id}", response_model=ClienteResponse)
def atualizar(cliente_id: int, data: ClienteUpdate, db: Session = Depends(get_db)):
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
        if isinstance(value, (dict, list)):
            flag_modified(c, field)
    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{cliente_id}/gerar-base")
def gerar_base(
    cliente_id: int,
    ambiente: int = Query(1, ge=1, le=2, description="1=Produção, 2=Homologação"),
    db: Session = Depends(get_db),
):
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")

    try:
        content = sql_generator_service.gerar_sql(c, db, ambiente=ambiente)
    except FileNotFoundError as e:
        raise HTTPException(500, str(e))

    cnpj_clean = c.cnpj.replace(".", "").replace("/", "").replace("-", "")
    sufixo = "prod" if ambiente == 1 else "homolog"
    filename = f"base_{cnpj_clean}_{sufixo}.sql"

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{cliente_id}/gerar-chave-api")
def gerar_chave_api(
    cliente_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_permission("clientes.edit")),
):
    """Gera uma nova chave de API para o instalador deste cliente. A chave só é exibida
    nesta resposta (apenas o hash é persistido) — gerar novamente invalida a anterior."""
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")

    chave = secrets.token_urlsafe(32)
    c.chave_api_hash = hash_password(chave)
    c.chave_api_criada_em = datetime.now(timezone.utc)
    db.commit()

    return {"chave_api": chave}


def _get_cert_storage_path(cliente: Cliente, db: Session):
    if not cliente.solicitacao_id:
        return None, None
    from app.models.solicitacao import Solicitacao
    import app.services.storage_service as storage
    sol = db.get(Solicitacao, cliente.solicitacao_id)
    if not sol or not sol.certificado_path:
        return None, None
    sp = storage._to_storage_path(sol.certificado_path)
    return sp, sp.split("/")[-1]


@router.get("/{cliente_id}/certificado/info")
def info_certificado(cliente_id: int, db: Session = Depends(get_db)):
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    sp, filename = _get_cert_storage_path(c, db)
    if not sp:
        return {"exists": False, "filename": None}
    return {"exists": True, "filename": filename}


@router.get("/{cliente_id}/certificado")
def baixar_certificado(cliente_id: int, db: Session = Depends(get_db)):
    import app.services.storage_service as storage
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    sp, filename = _get_cert_storage_path(c, db)
    if not sp:
        raise HTTPException(404, "Certificado não encontrado")
    data = storage.download_sync(sp)
    if data is None:
        raise HTTPException(404, "Arquivo não encontrado no storage")
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
