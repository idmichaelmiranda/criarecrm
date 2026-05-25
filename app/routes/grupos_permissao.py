from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database.connection import get_db
from app.models.grupo_permissao import GrupoPermissao
from app.models.usuario import Usuario
from app.schemas.grupo_permissao import GrupoCreate, GrupoUpdate, GrupoResponse
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/grupos-permissao", tags=["grupos"])


def _enrich(g: GrupoPermissao, db: Session) -> GrupoResponse:
    total = db.execute(
        select(func.count()).select_from(Usuario).where(Usuario.grupo_id == g.id)
    ).scalar_one()
    resp = GrupoResponse.model_validate(g)
    resp.total_usuarios = total
    return resp


@router.get("/", response_model=list[GrupoResponse])
def listar(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    grupos = db.execute(select(GrupoPermissao).order_by(GrupoPermissao.nome)).scalars().all()
    return [_enrich(g, db) for g in grupos]


@router.get("/{grupo_id}", response_model=GrupoResponse)
def obter(
    grupo_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    g = db.get(GrupoPermissao, grupo_id)
    if not g:
        raise HTTPException(404, "Grupo não encontrado")
    return _enrich(g, db)


@router.post("/", response_model=GrupoResponse, status_code=201)
def criar(
    data: GrupoCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    existing = db.execute(
        select(GrupoPermissao).where(GrupoPermissao.nome == data.nome)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Já existe um grupo com este nome")

    g = GrupoPermissao(
        nome=data.nome,
        descricao=data.descricao,
        permissoes=data.permissoes,
        ativo=data.ativo,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return _enrich(g, db)


@router.patch("/{grupo_id}", response_model=GrupoResponse)
def atualizar(
    grupo_id: int,
    data: GrupoUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    g = db.get(GrupoPermissao, grupo_id)
    if not g:
        raise HTTPException(404, "Grupo não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(g, field, value)
    g.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(g)
    return _enrich(g, db)


@router.delete("/{grupo_id}", status_code=204)
def deletar(
    grupo_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    g = db.get(GrupoPermissao, grupo_id)
    if not g:
        raise HTTPException(404, "Grupo não encontrado")
    total = db.execute(
        select(func.count()).select_from(Usuario).where(Usuario.grupo_id == grupo_id)
    ).scalar_one()
    if total > 0:
        raise HTTPException(400, f"Grupo possui {total} usuário(s) vinculado(s). Remova-os antes.")
    db.delete(g)
    db.commit()
