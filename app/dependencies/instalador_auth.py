import uuid

from fastapi import Depends, HTTPException, Path, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.cliente import Cliente
from app.models.solicitacao_instalador import SolicitacaoInstalador
from app.services.api_key_service import buscar_cliente_por_cnpj
from app.services.auth_service import verify_password

api_key_header = APIKeyHeader(name="X-Api-Key", auto_error=False)


def get_cliente_autenticado(
    cnpj: str = Path(..., description="CNPJ somente dígitos, sem pontuação"),
    x_api_key: str | None = Security(api_key_header),
    db: Session = Depends(get_db),
) -> Cliente:
    # O CNPJ salvo tem pontuação (contém "/"), que quebraria o path param da URL —
    # por isso o instalador envia só dígitos e comparamos contra o CNPJ normalizado.
    cliente = buscar_cliente_por_cnpj(cnpj, db)
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")

    if not x_api_key or not cliente.chave_api_hash or not verify_password(x_api_key, cliente.chave_api_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Chave de API inválida")

    return cliente


def get_solicitacao_autenticada(
    solicitacao_id: str = Path(...),
    x_api_key: str | None = Security(api_key_header),
    db: Session = Depends(get_db),
) -> SolicitacaoInstalador:
    """Autentica pela mesma chave de API emitida na aprovação da solicitação (a que o
    instalador já usa em RequestDatabaseGenerationAsync e afins). Só existe request
    válido aqui depois de aprovada — antes disso não tem chave pra verificar, e
    reportar progresso de etapas não faz sentido mesmo. 404 tanto pra id inexistente
    quanto pra solicitação não aprovada (expirada/recusada/cancelada/ainda pendente):
    o instalador trata isso como best-effort e não precisa distinguir os casos."""
    try:
        sid = uuid.UUID(solicitacao_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitação não encontrada")

    sol = db.get(SolicitacaoInstalador, sid)
    if not sol or sol.status != "aprovada":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitação não encontrada")

    cliente = sol.cliente
    if not x_api_key or not cliente or not cliente.chave_api_hash or not verify_password(x_api_key, cliente.chave_api_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Chave de API inválida")

    return sol
