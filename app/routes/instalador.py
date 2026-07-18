from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.instalador_auth import get_cliente_autenticado
from app.models.cliente import Cliente
from app.services import sql_generator_service

router = APIRouter(prefix="/instalador/clientes", tags=["instalador"])


@router.get("/{cnpj}")
def buscar_cliente(cliente: Cliente = Depends(get_cliente_autenticado)):
    return {"encontrado": True, "nome": cliente.razao_social, "cnpj": cliente.cnpj}


@router.get("/{cnpj}/gerar-base")
def gerar_base(
    ambiente: int = Query(1, ge=1, le=2, description="1=Produção, 2=Homologação"),
    cliente: Cliente = Depends(get_cliente_autenticado),
    db: Session = Depends(get_db),
):
    try:
        content = sql_generator_service.gerar_sql(cliente, db, ambiente=ambiente)
    except FileNotFoundError as e:
        raise HTTPException(500, str(e))

    return Response(content=content, media_type="text/plain; charset=utf-8")
