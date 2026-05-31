"""Filtro de log que redact campos sensíveis antes de qualquer saída."""
import logging
import re

_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'"senha"\s*:\s*"[^"]*"', re.I), '"senha": "[REDACTED]"'),
    (re.compile(r'"password"\s*:\s*"[^"]*"', re.I), '"password": "[REDACTED]"'),
    (re.compile(r'"senha_hash"\s*:\s*"[^"]*"', re.I), '"senha_hash": "[REDACTED]"'),
    (re.compile(r'"senhasmtp"\s*:\s*"[^"]*"', re.I), '"SENHASMTP": "[REDACTED]"'),
    (re.compile(r'"access_token"\s*:\s*"[^"]{16,}"', re.I), '"access_token": "[REDACTED]"'),
    (re.compile(r'(SECRET_KEY|SENHASMTP|senha_hash)\s*=\s*\S+', re.I), r'\1=[REDACTED]'),
]


class _SanitizeFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
            for pattern, replacement in _PATTERNS:
                msg = pattern.sub(replacement, msg)
            record.msg = msg
            record.args = ()
        except Exception:
            pass
        return True


def configure_logging() -> None:
    sanitizer = _SanitizeFilter()
    for name in ("", "uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        logger = logging.getLogger(name)
        if not any(isinstance(f, _SanitizeFilter) for f in logger.filters):
            logger.addFilter(sanitizer)
