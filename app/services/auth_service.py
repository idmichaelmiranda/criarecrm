import os
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import SECRET_KEY as _SECRET_KEY_ENV

_HARDCODED_FALLBACK = "criareti-crm-2024-change-in-production"

SECRET_KEY = _SECRET_KEY_ENV if _SECRET_KEY_ENV and _SECRET_KEY_ENV != "dev-secret-mude-em-producao" else _HARDCODED_FALLBACK

if SECRET_KEY == _HARDCODED_FALLBACK:
    print(
        "[SEGURANÇA] ATENÇÃO: SECRET_KEY não configurada via variável de ambiente. "
        "Defina SECRET_KEY no ambiente de produção. "
        "Gere uma chave segura com: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

# ── Blacklist de tokens revogados (em memória, com limpeza automática por TTL) ──
_revoked_lock = threading.Lock()
_revoked: dict[str, float] = {}  # jti → timestamp de expiração


def _cleanup_revoked() -> None:
    now = time.time()
    with _revoked_lock:
        expired = [k for k, v in _revoked.items() if v < now]
        for k in expired:
            del _revoked[k]


def revoke_token(jti: str, exp: float) -> None:
    _cleanup_revoked()
    with _revoked_lock:
        _revoked[jti] = exp


def is_token_revoked(jti: str) -> bool:
    with _revoked_lock:
        return jti in _revoked


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode["exp"] = expire
    to_encode["jti"] = secrets.token_hex(16)  # ID único para revogação
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
