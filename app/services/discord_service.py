import json
import os
import threading

import httpx


def _send(payload: dict) -> None:
    url = os.getenv("DISCORD_WEBHOOK_URL")
    if not url:
        print("[DISCORD] DISCORD_WEBHOOK_URL não configurada — notificação ignorada.")
        return
    try:
        resp = httpx.post(url, json=payload, timeout=8)
        if resp.status_code not in (200, 204):
            print(f"[DISCORD] Resposta inesperada: {resp.status_code} {resp.text[:200]}")
    except Exception as exc:
        print(f"[DISCORD] Erro ao enviar notificação: {exc}")


def _fire(payload: dict) -> None:
    threading.Thread(target=_send, args=(payload,), daemon=True).start()


def notify_nova_triagem(razao_social: str, cnpj: str | None = None) -> None:
    fields = [{"name": "Empresa", "value": razao_social, "inline": True}]
    if cnpj:
        fields.append({"name": "CNPJ", "value": cnpj, "inline": True})
    _fire({
        "embeds": [{
            "title": "📥 Nova triagem recebida",
            "color": 0x6366F1,
            "fields": fields,
        }]
    })


def notify_nova_instalacao(
    codigo: str,
    cliente: str,
    tipos: str,
    responsavel: str | None = None,
    data_agendada: str | None = None,
) -> None:
    fields = [
        {"name": "Código", "value": codigo, "inline": True},
        {"name": "Cliente", "value": cliente, "inline": True},
        {"name": "Produto", "value": tipos, "inline": False},
    ]
    if responsavel:
        fields.append({"name": "Responsável", "value": responsavel, "inline": True})
    if data_agendada:
        fields.append({"name": "Agendada para", "value": data_agendada, "inline": True})
    _fire({
        "embeds": [{
            "title": "🔧 Nova instalação criada",
            "color": 0x3B82F6,
            "fields": fields,
        }]
    })


def notify_instalacao_concluida(
    codigo: str,
    cliente: str,
    finalizado_por: str,
    duracao_min: int,
) -> None:
    horas = duracao_min // 60
    mins = duracao_min % 60
    duracao_str = f"{horas}h {mins}min" if horas else f"{mins}min"
    _fire({
        "embeds": [{
            "title": "✅ Instalação concluída",
            "color": 0x10B981,
            "fields": [
                {"name": "Código", "value": codigo, "inline": True},
                {"name": "Cliente", "value": cliente, "inline": True},
                {"name": "Finalizado por", "value": finalizado_por, "inline": True},
                {"name": "Duração", "value": duracao_str, "inline": True},
            ],
        }]
    })
