"""
Dual-mode file storage:
- Supabase Storage quando SUPABASE_URL + SUPABASE_SERVICE_KEY estão configurados (produção)
- Sistema de arquivos local caso contrário (desenvolvimento)

Buckets:
  uploads  (public)  — avatares apenas
  private  (private) — certificados, POPs, anexos, configs
"""
import json
from pathlib import Path
from typing import Optional

import httpx

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

BUCKET         = "uploads"   # público — só avatares
PRIVATE_BUCKET = "private"   # privado — tudo o resto

_USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
_LOCAL_BASE   = Path("uploads")

_AUTH_HEADERS: dict = {
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY or ''}",
    "apikey": SUPABASE_SERVICE_KEY or "",
}


def _bucket_for(storage_path: str) -> str:
    """Avatares ficam no bucket público; todo o resto vai para o privado."""
    return BUCKET if storage_path.startswith("avatars/") else PRIVATE_BUCKET


def _to_storage_path(db_path: str) -> str:
    """Normaliza path armazenado no banco para path relativo ao bucket."""
    if db_path.startswith("uploads/"):
        return db_path[len("uploads/"):]
    return db_path


# ── URLs ─────────────────────────────────────────────────────────────────────

def public_url(storage_path: str) -> str:
    """Apenas para avatares (bucket público)."""
    if _USE_SUPABASE:
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"
    return f"/uploads/{storage_path}"


def avatar_url(avatar_path: Optional[str]) -> Optional[str]:
    if not avatar_path:
        return None
    sp = avatar_path if "/" in avatar_path else f"avatars/{avatar_path}"
    return public_url(sp)


def signed_url(storage_path: str, expires: int = 3600) -> Optional[str]:
    """Gera signed URL temporária para arquivo no bucket privado."""
    if not _USE_SUPABASE:
        return f"/uploads/{storage_path}"
    bucket = _bucket_for(storage_path)
    url = f"{SUPABASE_URL}/storage/v1/object/sign/{bucket}/{storage_path}"
    with httpx.Client(timeout=10) as client:
        r = client.post(url, headers=_AUTH_HEADERS, json={"expiresIn": expires})
        if r.status_code != 200:
            return None
        data = r.json()
        signed = data.get("signedURL") or data.get("signedUrl") or ""
        if signed.startswith("/"):
            return f"{SUPABASE_URL}{signed}"
        return signed


# ── Upload ────────────────────────────────────────────────────────────────────

def upload_sync(storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    bucket = _bucket_for(storage_path)
    if not _USE_SUPABASE:
        dest = _LOCAL_BASE / storage_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return f"/uploads/{storage_path}"
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}"
    headers = {**_AUTH_HEADERS, "Content-Type": content_type, "x-upsert": "true"}
    with httpx.Client(timeout=60) as client:
        r = client.post(url, content=data, headers=headers)
        r.raise_for_status()
    return storage_path


async def upload_async(storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    bucket = _bucket_for(storage_path)
    if not _USE_SUPABASE:
        dest = _LOCAL_BASE / storage_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return f"/uploads/{storage_path}"
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}"
    headers = {**_AUTH_HEADERS, "Content-Type": content_type, "x-upsert": "true"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, content=data, headers=headers)
        r.raise_for_status()
    return storage_path


# ── Download ──────────────────────────────────────────────────────────────────

def _download_from_bucket(storage_path: str, bucket: str) -> Optional[bytes]:
    if not _USE_SUPABASE:
        p = _LOCAL_BASE / storage_path
        return p.read_bytes() if p.exists() else None
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}"
    with httpx.Client(timeout=60) as client:
        r = client.get(url, headers=_AUTH_HEADERS)
        if r.status_code in (400, 404):
            return None
        r.raise_for_status()
        return r.content


def download_sync(storage_path: str) -> Optional[bytes]:
    """Tenta bucket correto; se não encontrar faz fallback no outro (período de migração)."""
    primary   = _bucket_for(storage_path)
    secondary = BUCKET if primary == PRIVATE_BUCKET else PRIVATE_BUCKET
    data = _download_from_bucket(storage_path, primary)
    if data is None:
        data = _download_from_bucket(storage_path, secondary)
    return data


async def download_async(storage_path: str) -> Optional[bytes]:
    if not _USE_SUPABASE:
        p = _LOCAL_BASE / storage_path
        return p.read_bytes() if p.exists() else None
    primary   = _bucket_for(storage_path)
    secondary = BUCKET if primary == PRIVATE_BUCKET else PRIVATE_BUCKET
    for bucket in (primary, secondary):
        url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(url, headers=_AUTH_HEADERS)
            if r.status_code not in (400, 404):
                r.raise_for_status()
                return r.content
    return None


# ── Delete ────────────────────────────────────────────────────────────────────

def delete_sync(storage_path: str) -> None:
    bucket = _bucket_for(storage_path)
    if not _USE_SUPABASE:
        p = _LOCAL_BASE / storage_path
        if p.exists():
            p.unlink()
        return
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}"
    with httpx.Client(timeout=10) as client:
        client.request("DELETE", url, headers=_AUTH_HEADERS, json={"prefixes": [storage_path]})


def _delete_from_bucket(storage_path: str, bucket: str) -> None:
    """Remove arquivo de um bucket específico (ignora se não existir)."""
    if not _USE_SUPABASE:
        return
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}"
    with httpx.Client(timeout=10) as client:
        client.request("DELETE", url, headers=_AUTH_HEADERS, json={"prefixes": [storage_path]})


# ── Misc ──────────────────────────────────────────────────────────────────────

def exists_sync(storage_path: str) -> bool:
    if not _USE_SUPABASE:
        return (_LOCAL_BASE / storage_path).exists()
    return download_sync(storage_path) is not None


def get_json_sync(storage_path: str) -> Optional[dict]:
    data = download_sync(storage_path)
    if data is None:
        return None
    try:
        return json.loads(data.decode("utf-8"))
    except Exception:
        return None


def put_json_sync(storage_path: str, obj: dict) -> None:
    upload_sync(
        storage_path,
        json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8"),
        "application/json",
    )


# ── Migration helper ──────────────────────────────────────────────────────────

def migrate_to_private(storage_path: str) -> bool:
    """Copia arquivo de uploads→private. Retorna True se migrou, False se já estava lá."""
    if not _USE_SUPABASE or storage_path.startswith("avatars/"):
        return False
    # Verifica se já existe no private
    existing = _download_from_bucket(storage_path, PRIVATE_BUCKET)
    if existing is not None:
        return False
    # Baixa do bucket público
    data = _download_from_bucket(storage_path, BUCKET)
    if data is None:
        return False
    # Sobe para o privado
    url = f"{SUPABASE_URL}/storage/v1/object/{PRIVATE_BUCKET}/{storage_path}"
    headers = {**_AUTH_HEADERS, "Content-Type": "application/octet-stream", "x-upsert": "true"}
    with httpx.Client(timeout=60) as client:
        r = client.post(url, content=data, headers=headers)
        r.raise_for_status()
    return True
