import re

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/cnpj", tags=["cnpj"])


@router.get("/{cnpj}/receita-ws")
def consultar_receita_ws(cnpj: str):
    """
    Proxy para a ReceitaWS — usado como fallback quando a busca direta do navegador na
    BrasilAPI não encontra o CNPJ (ex.: empresas recém-abertas, ainda não indexadas lá).
    A ReceitaWS não envia cabeçalhos CORS, então uma chamada direta do frontend é
    bloqueada pelo navegador; por isso passa pelo backend.
    """
    digits = re.sub(r"\D", "", cnpj)
    if len(digits) != 14:
        raise HTTPException(400, "CNPJ inválido")

    try:
        with httpx.Client(timeout=8) as client:
            resp = client.get(f"https://receitaws.com.br/v1/cnpj/{digits}")
    except httpx.TimeoutException:
        raise HTTPException(504, "Timeout ao consultar ReceitaWS")
    except Exception as exc:
        raise HTTPException(502, f"Falha ao consultar ReceitaWS: {exc}")

    if resp.status_code != 200:
        raise HTTPException(404, "CNPJ não encontrado")
    data = resp.json()
    if data.get("status") == "ERROR":
        raise HTTPException(404, "CNPJ não encontrado")
    return data
