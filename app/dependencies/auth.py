from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.services.auth_service import decode_token, is_token_revoked
from app.models.usuario import Usuario

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Usuario:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    jti = payload.get("jti")
    if jti and is_token_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão encerrada. Faça login novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.get(Usuario, int(user_id))
    if not user or not user.ativo:
        raise HTTPException(status_code=401, detail="Usuário não encontrado ou inativo")
    return user


def require_permission(permission: str):
    def checker(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        permissoes = current_user.grupo.permissoes if current_user.grupo else []
        if permission not in permissoes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permissão '{permission}' necessária",
            )
        return current_user
    return checker


def require_aprovador_instalador(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    """Autorização própria por usuário (não por grupo) para aprovar/recusar
    solicitações de instalação vindas do Assistente Criare."""
    if not current_user.pode_aprovar_instalador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para aprovar instalações via Assistente Criare",
        )
    return current_user
