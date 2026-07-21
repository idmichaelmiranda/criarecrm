import re
import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.services.auth_service import hash_password


def normalizar_cnpj(cnpj: str) -> str:
    """Remove qualquer caractere que não seja dígito."""
    return re.sub(r"\D", "", cnpj or "")


def buscar_cliente_por_cnpj(cnpj: str, db: Session) -> Cliente | None:
    """Busca Cliente comparando o CNPJ normalizado (o CNPJ salvo tem pontuação)."""
    digits = normalizar_cnpj(cnpj)
    cnpj_normalizado = func.replace(func.replace(func.replace(Cliente.cnpj, ".", ""), "/", ""), "-", "")
    return db.execute(select(Cliente).where(cnpj_normalizado == digits)).scalar_one_or_none()


def emitir_chave_api(cliente: Cliente, criado_em) -> str:
    """Gera uma nova chave de API em texto puro para o cliente e grava só o hash nele.
    A chave anterior (se houver) é invalidada. O valor em texto puro nunca é persistido
    no Cliente — só é retornado aqui, uma única vez, para quem chamou."""
    chave = secrets.token_urlsafe(32)
    cliente.chave_api_hash = hash_password(chave)
    cliente.chave_api_criada_em = criado_em
    return chave
