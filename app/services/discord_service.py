import os
import threading
from datetime import datetime, timezone

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


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Triagem ───────────────────────────────────────────────────────────────────

def notify_nova_triagem(razao_social: str, cnpj: str | None = None) -> None:
    fields = [{"name": "Empresa", "value": razao_social, "inline": True}]
    if cnpj:
        fields.append({"name": "CNPJ", "value": cnpj, "inline": True})
    _fire({
        "embeds": [{
            "title": "📥 Nova triagem recebida",
            "color": 0x6366F1,
            "fields": fields,
            "timestamp": _ts(),
        }]
    })


def notify_triagem_iniciada(empresa: str, cnpj: str | None, iniciado_por: str | None = None) -> None:
    fields = [{"name": "Empresa", "value": empresa, "inline": True}]
    if cnpj:
        fields.append({"name": "CNPJ", "value": cnpj, "inline": True})
    if iniciado_por:
        fields.append({"name": "Iniciado por", "value": iniciado_por, "inline": True})
    _fire({
        "embeds": [{
            "title": "🔎 Triagem iniciada",
            "color": 0x6366F1,
            "fields": fields,
            "timestamp": _ts(),
        }]
    })


def notify_triagem_atribuida(
    empresa: str,
    cnpj: str | None,
    responsavel: str,
    atribuido_por: str,
) -> None:
    fields = [
        {"name": "Empresa", "value": empresa, "inline": True},
    ]
    if cnpj:
        fields.append({"name": "CNPJ", "value": cnpj, "inline": True})
    fields += [
        {"name": "Responsável", "value": responsavel, "inline": True},
        {"name": "Atribuído por", "value": atribuido_por, "inline": True},
    ]
    _fire({
        "embeds": [{
            "title": "👤 Triagem atribuída",
            "color": 0x6366F1,
            "fields": fields,
            "timestamp": _ts(),
        }]
    })


def notify_triagem_aprovada(
    empresa: str,
    cnpj: str | None,
    codigo: str,
    modulos: str,
    consultor: str | None,
    aprovado_por: str | None,
) -> None:
    fields = [
        {"name": "Empresa", "value": empresa, "inline": True},
        {"name": "Código", "value": codigo, "inline": True},
    ]
    if cnpj:
        fields.append({"name": "CNPJ", "value": cnpj, "inline": True})
    fields.append({"name": "Módulos", "value": modulos, "inline": False})
    if consultor:
        fields.append({"name": "Consultor", "value": consultor, "inline": True})
    if aprovado_por:
        fields.append({"name": "Aprovado por", "value": aprovado_por, "inline": True})
    _fire({
        "embeds": [{
            "title": "✅ Triagem aprovada",
            "color": 0x10B981,
            "fields": fields,
            "timestamp": _ts(),
        }]
    })


def notify_triagem_recusada(
    empresa: str,
    cnpj: str | None,
    motivo: str,
    recusado_por: str | None,
) -> None:
    fields = [{"name": "Empresa", "value": empresa, "inline": True}]
    if cnpj:
        fields.append({"name": "CNPJ", "value": cnpj, "inline": True})
    fields.append({"name": "Motivo", "value": motivo, "inline": False})
    if recusado_por:
        fields.append({"name": "Recusado por", "value": recusado_por, "inline": True})
    _fire({
        "embeds": [{
            "title": "❌ Triagem recusada",
            "color": 0xEF4444,
            "fields": fields,
            "timestamp": _ts(),
        }]
    })


# ── Instalações ───────────────────────────────────────────────────────────────

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
            "timestamp": _ts(),
        }]
    })


def notify_atribuicao(codigo: str, cliente: str, responsavel: str) -> None:
    _fire({
        "embeds": [{
            "title": "👤 Instalação atribuída",
            "color": 0xF59E0B,
            "fields": [
                {"name": "Código", "value": codigo, "inline": True},
                {"name": "Cliente", "value": cliente, "inline": True},
                {"name": "Responsável", "value": responsavel, "inline": False},
            ],
            "timestamp": _ts(),
        }]
    })


def notify_colaborador_adicionado(
    codigo: str,
    cliente: str,
    colaborador: str,
    adicionado_por: str,
) -> None:
    _fire({
        "embeds": [{
            "title": "👥 Colaborador adicionado",
            "color": 0x8B5CF6,
            "fields": [
                {"name": "Código", "value": codigo, "inline": True},
                {"name": "Cliente", "value": cliente, "inline": True},
                {"name": "Colaborador", "value": colaborador, "inline": True},
                {"name": "Adicionado por", "value": adicionado_por, "inline": True},
            ],
            "timestamp": _ts(),
        }]
    })


def notify_instalacao_iniciada(codigo: str, cliente: str, iniciado_por: str) -> None:
    _fire({
        "embeds": [{
            "title": "▶️ Instalação iniciada",
            "color": 0x3B82F6,
            "fields": [
                {"name": "Código", "value": codigo, "inline": True},
                {"name": "Cliente", "value": cliente, "inline": True},
                {"name": "Iniciado por", "value": iniciado_por, "inline": False},
            ],
            "timestamp": _ts(),
        }]
    })


def notify_instalacao_pausada(
    codigo: str,
    cliente: str,
    pausado_por: str,
    motivo: str | None = None,
    duracao_min: int | None = None,
) -> None:
    fields = [
        {"name": "Código", "value": codigo, "inline": True},
        {"name": "Cliente", "value": cliente, "inline": True},
        {"name": "Pausado por", "value": pausado_por, "inline": False},
    ]
    if motivo:
        fields.append({"name": "Motivo", "value": motivo, "inline": True})
    if duracao_min is not None:
        h, m = divmod(duracao_min, 60)
        fields.append({"name": "Duração da pausa", "value": f"{h}h {m}min" if h else f"{m}min", "inline": True})
    _fire({
        "embeds": [{
            "title": "⏸️ Instalação pausada",
            "color": 0xF59E0B,
            "fields": fields,
            "timestamp": _ts(),
        }]
    })


def notify_implantacao_concluida(
    codigo: str,
    cliente: str,
    consultor: str | None = None,
    data_conclusao: str | None = None,
) -> None:
    fields = [
        {"name": "Código",  "value": codigo,  "inline": True},
        {"name": "Cliente", "value": cliente, "inline": True},
    ]
    if consultor:
        fields.append({"name": "Consultor", "value": consultor, "inline": True})
    if data_conclusao:
        fields.append({"name": "Concluída em", "value": data_conclusao, "inline": True})
    _fire({
        "embeds": [{
            "title": "🎉 Implantação concluída",
            "color": 0x10B981,
            "fields": fields,
            "timestamp": _ts(),
        }]
    })


def notify_instalacao_concluida(
    codigo: str,
    cliente: str,
    finalizado_por: str,
    duracao_min: int,
    produto: str | None = None,
) -> None:
    horas = duracao_min // 60
    mins = duracao_min % 60
    duracao_str = f"{horas}h {mins}min" if horas else f"{mins}min"
    fields = [
        {"name": "Código",        "value": codigo,        "inline": True},
        {"name": "Cliente",       "value": cliente,       "inline": True},
        {"name": "Finalizado por","value": finalizado_por,"inline": True},
        {"name": "Duração",       "value": duracao_str,   "inline": True},
    ]
    if produto:
        fields.append({"name": "Produto", "value": produto, "inline": False})
    _fire({
        "embeds": [{
            "title": "✅ Instalação concluída",
            "color": 0x10B981,
            "fields": fields,
            "timestamp": _ts(),
        }]
    })
