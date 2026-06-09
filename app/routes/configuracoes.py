import json
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
import app.services.storage_service as storage

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])

_auth = Depends(get_current_user)

_META_PATH = "configs/base_zerada_meta.json"


# ── Schemas de email ──────────────────────────────────────────────────────────

class EmailConfig(BaseModel):
    host: str
    port: int = 587
    user: str
    password: str = ""
    from_email: str = ""
    from_name: str = "CriareCRM"
    use_tls: bool = True
    frontend_url: str = ""


def _read_meta() -> dict:
    return storage.get_json_sync(_META_PATH) or {}


def _write_meta(data: dict) -> None:
    storage.put_json_sync(_META_PATH, data)


@router.get("/base-zerada/info")
def info_base():
    meta = _read_meta()
    if not meta:
        return {"exists": False}
    return {
        "exists": True,
        "size": meta.get("size"),
        "updated_at": meta.get("updated_at"),
        "versao": meta.get("versao") or None,
    }


@router.post("/base-zerada")
async def upload_base(
    file: UploadFile = File(...),
    versao: str = Form(""),
):
    if not file.filename.lower().endswith(".sql"):
        raise HTTPException(400, "O arquivo deve ter extensão .sql")

    content = await file.read()
    if len(content) < 1024:
        raise HTTPException(400, "Arquivo muito pequeno — verifique se é uma base válida")

    await storage.upload_async("configs/base_zerada.sql", content, "application/sql")

    now = datetime.now(timezone.utc).isoformat()
    _write_meta({"versao": versao.strip() or None, "updated_at": now, "size": len(content)})

    return {
        "message": "base_zerada.sql atualizado com sucesso",
        "size": len(content),
        "updated_at": now,
        "versao": versao.strip() or None,
    }


# ── Config de email ───────────────────────────────────────────────────────────

@router.get("/email", dependencies=[_auth])
def get_email_config():
    from app.services.email_service import get_config
    cfg = get_config() or {}
    # Retorna com senha mascarada para exibição
    safe = dict(cfg)
    if safe.get("password"):
        safe["password"] = "••••••••"
    return safe


@router.put("/email", dependencies=[_auth])
def save_email_config(data: EmailConfig):
    from app.services.email_service import get_config, save_config
    existing = get_config() or {}
    payload = data.model_dump()
    # Preserva a senha existente se o frontend enviar o placeholder mascarado
    if payload.get("password") == "••••••••":
        payload["password"] = existing.get("password", "")
    save_config(payload)
    return {"message": "Configuração de email salva com sucesso."}


@router.post("/email/testar", dependencies=[_auth])
def testar_email(data: dict):
    from app.services.email_service import get_config, save_config, send_revisao_email
    # Salva primeiro se vieram dados novos no body
    if data.get("host"):
        cfg_update = {**data}
        existing = get_config() or {}
        if cfg_update.get("password") == "••••••••":
            cfg_update["password"] = existing.get("password", "")
        save_config(cfg_update)

    cfg = get_config()
    if not cfg or not cfg.get("host"):
        raise HTTPException(400, "Configuração de email não encontrada.")

    dest = data.get("test_email") or cfg.get("user")
    if not dest:
        raise HTTPException(400, "Informe um email de destino para o teste.")

    try:
        send_revisao_email(
            to_email=dest,
            razao_social="Empresa Teste LTDA",
            motivo="Este é um email de teste para validar as configurações SMTP do CriareCRM.",
            link=(cfg.get("frontend_url") or "http://localhost:5173") + "/revisao/TOKEN_EXEMPLO",
        )
        return {"message": f"Email de teste enviado para {dest}."}
    except ValueError as exc:
        raise HTTPException(400, str(exc))


# ── Integração ERP ────────────────────────────────────────────────────────────

ERP_CLIENT_ENDPOINT = "/api/gerente/v2/CheckClient"
_ERP_CONFIG_PATH = "configs/erp_config.json"


def _read_erp_config() -> dict:
    return storage.get_json_sync(_ERP_CONFIG_PATH) or {}


def _write_erp_config(data: dict) -> None:
    storage.put_json_sync(_ERP_CONFIG_PATH, data)


class ErpConfig(BaseModel):
    base_url: str = ""
    api_token: str = ""
    timeout: int = 10


def _normalize_clients(raw) -> list[dict]:
    """Normaliza a resposta da API externa para [{id, nome, cnpj}]."""
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        if any(k in raw for k in ("RazaoSocial", "razao_social", "NomeCliente", "razao", "nome", "Name")):
            items = [raw]
        else:
            items = raw.get("clientes") or raw.get("data") or raw.get("result") or []
    else:
        items = []
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        nome = (
            item.get("RazaoSocial") or item.get("razao_social") or
            item.get("NomeCliente") or item.get("razao") or
            item.get("nome") or item.get("Name") or ""
        )
        cnpj = item.get("CNPJ") or item.get("cnpj") or item.get("Cnpj") or ""
        cod  = (
            item.get("CodCliente") or item.get("codigo") or
            item.get("id") or item.get("Id") or item.get("ID") or ""
        )
        cidade = item.get("cidade") or item.get("Cidade") or item.get("municipio") or ""
        estado = (item.get("estado") or item.get("Estado") or item.get("uf") or item.get("UF") or "").upper()
        if nome:
            result.append({"id": str(cod), "nome": nome, "cnpj": cnpj, "cidade": cidade, "estado": estado})
    return result


@router.get("/erp", dependencies=[_auth])
def get_erp_config():
    cfg = _read_erp_config()
    safe = dict(cfg)
    if safe.get("api_token"):
        safe["api_token"] = "••••••••"
    return safe


@router.put("/erp", dependencies=[_auth])
def save_erp_config(data: ErpConfig):
    existing = _read_erp_config()
    payload = data.model_dump()
    if payload.get("api_token") == "••••••••":
        payload["api_token"] = existing.get("api_token", "")
    _write_erp_config(payload)
    return {"message": "Configuração ERP salva com sucesso."}


@router.get("/erp/clientes", dependencies=[_auth])
def erp_clientes(cnpj: str = ""):
    cfg = _read_erp_config()
    base_url = (cfg.get("base_url") or "").rstrip("/")
    if not base_url:
        raise HTTPException(400, "Integração ERP não configurada. Acesse Configurações > Integração ERP.")

    if not cnpj:
        return []

    # Strip formatting — ERP expects raw digits to avoid URL-encoding issues with slashes
    cnpj_digits = re.sub(r"\D", "", cnpj)
    if not cnpj_digits:
        return []

    url = f"{base_url}{ERP_CLIENT_ENDPOINT}"
    headers = {"Accept": "application/json"}
    if cfg.get("api_token"):
        headers["Authorization"] = f"Bearer {cfg['api_token']}"

    # Use a longer timeout for real lookups (DB query); fallback to config value if set higher
    lookup_timeout = max(int(cfg.get("timeout") or 10), 30)

    try:
        with httpx.Client(timeout=lookup_timeout) as client:
            resp = client.get(url, headers=headers, params={"CNPJ": cnpj_digits})
            if resp.status_code >= 400:
                # ERP uses 4xx/5xx for "not found" — return empty rather than propagating
                return []
            raw = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, f"Timeout ({lookup_timeout}s) ao consultar o ERP. Verifique se o servidor está acessível.")
    except Exception as e:
        raise HTTPException(502, f"Falha ao conectar ao ERP: {str(e)}")

    return _normalize_clients(raw)


@router.post("/erp/clientes/resolve", dependencies=[_auth])
def erp_resolve_cliente(data: dict, db: Session = Depends(get_db)):
    """
    Recebe {nome, cnpj, id} do ERP e retorna o cliente_id do CRM.
    Busca por CNPJ; se não encontrar, cria um stub para manter o FK íntegro.
    """
    from sqlalchemy import select
    from app.models.cliente import Cliente

    cnpj_raw = (data.get("cnpj") or "").strip()
    nome     = (data.get("nome") or "").strip()
    if not nome:
        raise HTTPException(400, "Nome do cliente é obrigatório.")

    cnpj_digits = re.sub(r"\D", "", cnpj_raw) if cnpj_raw else ""

    existing = None
    if cnpj_raw:
        existing = db.execute(select(Cliente).where(Cliente.cnpj == cnpj_raw)).scalar_one_or_none()
    if not existing and len(cnpj_digits) == 14:
        fmt = f"{cnpj_digits[:2]}.{cnpj_digits[2:5]}.{cnpj_digits[5:8]}/{cnpj_digits[8:12]}-{cnpj_digits[12:14]}"
        existing = db.execute(select(Cliente).where(Cliente.cnpj == fmt)).scalar_one_or_none()

    cidade = (data.get("cidade") or "").strip()
    estado = (data.get("estado") or "").strip().upper()

    if not existing:
        cnpj_store = cnpj_raw or cnpj_digits or f"erp_{nome[:10]}"
        email_stub = f"erp_{cnpj_digits or re.sub(chr(32), '_', nome[:20])}@erp.local"
        endereco = {}
        if cidade:
            endereco["cidade"] = cidade
        if estado:
            endereco["estado"] = estado
        stub = Cliente(
            razao_social=nome,
            cnpj=cnpj_store,
            email=email_stub,
            telefone_celular="",
            ativo=True,
            origem="erp",
            endereco=endereco or None,
        )
        db.add(stub)
        db.commit()
        db.refresh(stub)
        existing = stub
    elif (cidade or estado) and not (existing.endereco or {}).get("cidade"):
        # Atualiza stub existente que ainda não tem endereço
        end = dict(existing.endereco or {})
        if cidade:
            end["cidade"] = cidade
        if estado:
            end["estado"] = estado
        existing.endereco = end
        db.commit()

    return {"cliente_id": existing.id, "nome": existing.razao_social, "cnpj": existing.cnpj}


@router.post("/erp/fix-enderecos", dependencies=[_auth])
def fix_enderecos_erp(db: Session = Depends(get_db)):
    """
    Endpoint de uso único: consulta o ERP para todos os clientes de instalações
    que não têm cidade/estado gravados e corrige o banco de dados.
    """
    from app.models.instalacao import Instalacao
    from app.models.cliente import Cliente
    from sqlalchemy.orm import selectinload

    cfg = _read_erp_config()
    base_url = (cfg.get("base_url") or "").rstrip("/")
    if not base_url:
        raise HTTPException(400, "Integração ERP não configurada.")

    token = cfg.get("api_token") or ""
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    instalacoes = db.execute(
        select(Instalacao).options(selectinload(Instalacao.cliente))
    ).scalars().all()

    # Deduplica clientes para não consultar o mesmo CNPJ mais de uma vez
    clientes_sem_end = {}
    for inst in instalacoes:
        c = inst.cliente
        if c and not (c.endereco or {}).get("cidade") and c.cnpj:
            clientes_sem_end[c.id] = c

    resultados = []
    with httpx.Client(timeout=20) as client:
        for c in clientes_sem_end.values():
            cnpj_digits = re.sub(r"\D", "", c.cnpj)
            if len(cnpj_digits) not in (11, 14):
                resultados.append({"cliente": c.razao_social, "status": "cnpj_invalido"})
                continue
            try:
                resp = client.get(
                    f"{base_url}{ERP_CLIENT_ENDPOINT}",
                    headers=headers,
                    params={"CNPJ": cnpj_digits},
                )
                if resp.status_code >= 400:
                    resultados.append({"cliente": c.razao_social, "status": "nao_encontrado_erp"})
                    continue
                data = resp.json()
                cidade = (data.get("cidade") or "").strip()
                estado = (data.get("estado") or "").strip().upper()
                if cidade or estado:
                    end = dict(c.endereco or {})
                    if cidade:
                        end["cidade"] = cidade
                    if estado:
                        end["estado"] = estado
                    c.endereco = end
                    db.commit()
                    resultados.append({"cliente": c.razao_social, "cidade": cidade, "estado": estado, "status": "corrigido"})
                else:
                    resultados.append({"cliente": c.razao_social, "status": "sem_dados_erp"})
            except Exception as e:
                resultados.append({"cliente": c.razao_social, "status": f"erro: {str(e)}"})

    return {
        "total_instalacoes": len(instalacoes),
        "clientes_corrigidos": sum(1 for r in resultados if r["status"] == "corrigido"),
        "detalhes": resultados,
    }


@router.post("/erp/testar", dependencies=[_auth])
def testar_erp(data: ErpConfig):
    existing = _read_erp_config()
    base_url = (data.base_url or existing.get("base_url") or "").rstrip("/")
    if not base_url:
        raise HTTPException(400, "Informe a URL base do ERP.")

    token = data.api_token if data.api_token != "••••••••" else existing.get("api_token", "")
    url = f"{base_url}{ERP_CLIENT_ENDPOINT}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    timeout = int(data.timeout or existing.get("timeout") or 10)

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, headers=headers)
            # ERP returns 500 when CNPJ param is missing — that still means the server is reachable
            if resp.status_code >= 400:
                body = resp.text or ""
                if "CNPJ" in body or "obrigatório" in body or "cadastrado" in body:
                    return {"message": "Conexão estabelecida — servidor ERP acessível.", "total": 0}
                raise httpx.HTTPStatusError(
                    f"HTTP {resp.status_code}", request=resp.request, response=resp
                )
            raw = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, f"Timeout ({timeout}s). Verifique se o servidor está acessível.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"ERP retornou HTTP {e.response.status_code}.")
    except Exception as e:
        raise HTTPException(502, f"Falha ao conectar: {str(e)}")

    clientes = _normalize_clients(raw)
    return {"message": f"Conexão OK — {len(clientes)} cliente(s) encontrado(s).", "total": len(clientes)}


@router.get("/discord/testar")
@router.post("/discord/testar", dependencies=[_auth])
def testar_discord():
    import os
    url = os.getenv("DISCORD_WEBHOOK_URL")
    if not url:
        raise HTTPException(400, "Variável DISCORD_WEBHOOK_URL não configurada no servidor.")
    try:
        resp = httpx.post(url, json={
            "embeds": [{
                "title": "🧪 Teste de conexão",
                "description": "Webhook do CriareCRM funcionando corretamente.",
                "color": 0x10B981,
            }]
        }, timeout=8)
        if resp.status_code in (200, 204):
            return {"ok": True, "message": "Mensagem enviada com sucesso!"}
        raise HTTPException(502, f"Discord retornou HTTP {resp.status_code}: {resp.text[:200]}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Erro ao enviar: {str(exc)}")
