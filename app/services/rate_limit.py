"""Rate limiter simples em memória para tentativas de login."""
import time
import threading
from collections import defaultdict

from fastapi import HTTPException

_lock = threading.Lock()
_failures: dict[str, list[float]] = defaultdict(list)

WINDOW_SECONDS = 15 * 60  # 15 minutos
MAX_FAILURES = 5


def _client_ip(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_login_rate(key: str) -> None:
    now = time.monotonic()
    with _lock:
        _failures[key] = [t for t in _failures[key] if now - t < WINDOW_SECONDS]
        if len(_failures[key]) >= MAX_FAILURES:
            raise HTTPException(
                status_code=429,
                detail=f"Muitas tentativas de login. Aguarde {WINDOW_SECONDS // 60} minutos.",
                headers={"Retry-After": str(WINDOW_SECONDS)},
            )


def record_login_failure(key: str) -> None:
    now = time.monotonic()
    with _lock:
        _failures[key].append(now)


def clear_login_failures(key: str) -> None:
    with _lock:
        _failures.pop(key, None)
