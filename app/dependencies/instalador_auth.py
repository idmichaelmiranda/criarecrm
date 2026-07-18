import re

from fastapi import Depends, HTTPException, Path, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.cliente import Cliente
from app.services.auth_service import verify_password

api_key_header = APIKeyHeader(name="X-Api-Key", auto_error=False)


def get_cliente_autenticado(
    cnpj: str = Path(..., description="CNPJ somente dígitos, sem pontuação"),
    x_api_key: str | None = Security(api_key_header),
    db: Session = Depends(get_db),
) -> Cliente:
    # O CNPJ salvo tem pontuação (contém "/"), que quebraria o path param da URL —
    # por isso o instalador envia só dígitos e comparamos contra o CNPJ normalizado.
    digits = re.sub(r"\D", "", cnpj)
    cnpj_normalizado = func.replace(func.replace(func.replace(Cliente.cnpj, ".", ""), "/", ""), "-", "")
    cliente = db.execute(select(Cliente).where(cnpj_normalizado == digits)).scalar_one_or_none()
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")

    if not x_api_key or not cliente.chave_api_hash or not verify_password(x_api_key, cliente.chave_api_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Chave de API inválida")

    return cliente
