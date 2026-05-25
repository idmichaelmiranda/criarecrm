"""
Dual-mode file storage:
- Supabase Storage quando SUPABASE_URL + SUPABASE_SERVICE_KEY estão configurados (produção)
- Sistema de arquivos local caso contrário (desenvolvimento)
"""
import json
from pathlib import Path
from typing import Optional

import httpx

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

BUCKET = "uploads"
_USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
_LOCAL_BASE = Path("uploads")

_AUTH_HEADERS: dict = {
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY or ''}",
    "apikey": SUPABASE_SERVICE_KEY or "",
}


# ── URL pública ───────────────────────────────────────────────────────────────

def public_url(storage_path: str) -> str:
    if _USE_SUPABASE:
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"
    return f"/uploads/{storage_path}"


def avatar_url(avatar_path: Optional[str]) -> Optional[str]:
    """Gera URL do avatar tratando formato antigo (só filename) e novo (com subpasta)."""
    if not avatar_path:
        return None
    sp = avatar_path if "/" in avatar_path else f"avatars/{avatar_path}"
    return public_url(sp)


def _to_storage_path(db_path: str) -> str:
    """Normaliza path armazenado no banco para path relativo ao bucket."""
    if db_path.startswith("uploads/"):
        return db_path[len("uploads/"):]
    return db_path


# ── Sync ──────────────────────────────────────────────────────────────────────

def upload_sync(storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    if not _USE_SUPABASE:
        dest = _LOCAL_BASE / storage_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return f"/uploads/{storage_path}"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"
    headers = {**_AUTH_HEADERS, "Content-Type": content_type, "x-upsert": "true"}
    with httpx.Client(timeout=60) as client:
        r = client.post(url, content=data, headers=headers)
        r.raise_for_status()
    return public_url(storage_path)


def download_sync(storage_path: str) -> Optional[bytes]:
    if not _USE_SUPABASE:
        p = _LOCAL_BASE / storage_path
        return p.read_bytes() if p.exists() else None
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"
    with httpx.Client(timeout=60) as client:
        r = client.get(url, headers=_AUTH_HEADERS)
        if r.status_code in (400, 404):
            return None
        r.raise_for_status()
        return r.content


def delete_sync(storage_path: str) -> None:
    if not _USE_SUPABASE:
        p = _LOCAL_BASE / storage_path
        if p.exists():
            p.unlink()
        return
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}"
    with httpx.Client(timeout=10) as client:
        client.request("DELETE", url, headers=_AUTH_HEADERS, json={"prefixes": [storage_path]})


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


# ── Async ─────────────────────────────────────────────────────────────────────

async def upload_async(storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    if not _USE_SUPABASE:
        dest = _LOCAL_BASE / storage_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return f"/uploads/{storage_path}"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"
    headers = {**_AUTH_HEADERS, "Content-Type": content_type, "x-upsert": "true"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, content=data, headers=headers)
        r.raise_for_status()
    return public_url(storage_path)


async def download_async(storage_path: str) -> Optional[bytes]:
    if not _USE_SUPABASE:
        p = _LOCAL_BASE / storage_path
        return p.read_bytes() if p.exists() else None
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(url, headers=_AUTH_HEADERS)
        if r.status_code in (400, 404):
            return None
        r.raise_for_status()
        return r.content
