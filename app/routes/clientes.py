from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.database.connection import get_db
from app.schemas.cliente import ClienteListResponse, ClienteResponse, ClienteUpdate
from app.models.cliente import Cliente
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
from app.services import sql_generator_service

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
    c.updated_at = datetime.now()
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


def _get_cert_path(cliente: Cliente, db: Session) -> Path | None:
    if not cliente.solicitacao_id:
        return None
    from app.models.solicitacao import Solicitacao
    sol = db.get(Solicitacao, cliente.solicitacao_id)
    if not sol or not sol.certificado_path:
        return None
    p = Path(sol.certificado_path)
    return p if p.exists() else None


@router.get("/{cliente_id}/certificado/info")
def info_certificado(cliente_id: int, db: Session = Depends(get_db)):
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    p = _get_cert_path(c, db)
    if not p:
        return {"exists": False, "filename": None}
    return {"exists": True, "filename": p.name}


@router.get("/{cliente_id}/certificado")
def baixar_certificado(cliente_id: int, db: Session = Depends(get_db)):
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    p = _get_cert_path(c, db)
    if not p:
        raise HTTPException(404, "Certificado não encontrado")
    return Response(
        content=p.read_bytes(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{p.name}"'},
    )
