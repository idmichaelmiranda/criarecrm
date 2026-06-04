import json
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from app.database.connection import get_db
from app.models.implantacao import Implantacao
from app.models.instalacao import Instalacao
from app.models.cliente import Cliente
from app.models.usuario import Usuario

router = APIRouter(prefix="/resultados", tags=["resultados"])

# ── Helpers ───────────────────────────────────────────────────────────────────

TIPO_LABEL = {
    "instalacao_pdv": "PDV Adicional", "pdv": "PDV Adicional",
    "instalacao_sia_pdv": "SIA PDV", "sia_pdv": "SIA PDV",
    "instalacao_sia": "SIA", "sia": "SIA",
    "instalacao_coletor": "Coletor Mobile", "coletor": "Coletor Mobile",
    "instalacao_forca_vendas": "Força de Vendas", "forca_vendas": "Força de Vendas",
    "instalacao_impressora": "Impressora", "impressora": "Impressora",
    "instalacao_outro": "Outro", "outro": "Outro",
}

ESTADO_CENTROIDES = {
    "AC": (-8.77, -70.55), "AL": (-9.71, -35.73), "AM": (-3.47, -65.10),
    "AP": (1.41, -51.77),  "BA": (-12.96, -38.51), "CE": (-3.72, -38.54),
    "DF": (-15.83, -47.86), "ES": (-19.19, -40.34), "GO": (-16.64, -49.31),
    "MA": (-2.55, -44.30),  "MG": (-18.10, -44.38), "MS": (-20.51, -54.54),
    "MT": (-12.64, -55.42), "PA": (-5.53, -52.29),  "PB": (-7.28, -36.72),
    "PE": (-8.28, -35.07),  "PI": (-8.28, -43.68),  "PR": (-24.89, -51.55),
    "RJ": (-22.84, -43.15), "RN": (-5.81, -36.59),  "RO": (-11.22, -62.80),
    "RR": (1.99, -61.33),   "RS": (-30.17, -53.50),  "SC": (-27.45, -50.95),
    "SE": (-10.57, -37.45), "SP": (-22.19, -48.79),  "TO": (-9.47, -48.33),
}

def _normalizar_tipo(t: str) -> str:
    """Converte 'instalacao_sia_pdv' → busca no TIPO_LABEL; fallback: humaniza."""
    if t in TIPO_LABEL:
        return TIPO_LABEL[t]
    # Remove prefixo instalacao_ e humaniza
    chave = t.replace("instalacao_", "").replace("_", " ").title()
    return chave or t

def _parse_tipos(inst: Instalacao) -> list[str]:
    raw = inst.tipos_json
    if not raw:
        return [inst.tipo] if inst.tipo else []
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        return parsed if isinstance(parsed, list) else [inst.tipo]
    except Exception:
        return [inst.tipo] if inst.tipo else []

def _get_estado(cliente: Cliente | None) -> str:
    if not cliente or not cliente.endereco:
        return ""
    end = cliente.endereco if isinstance(cliente.endereco, dict) else {}
    return (end.get("estado") or "").upper().strip()

def _get_cidade(cliente: Cliente | None) -> str:
    if not cliente or not cliente.endereco:
        return ""
    end = cliente.endereco if isinstance(cliente.endereco, dict) else {}
    return (end.get("cidade") or "").strip()

def _desde(periodo_dias: int) -> date:
    return date.today() - timedelta(days=periodo_dias)

def _mes_label(d: date) -> str:
    meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
    return f"{meses[d.month - 1]}/{str(d.year)[2:]}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/visao-geral")
def visao_geral(
    periodo_dias: int = Query(365),
    estado: str = Query(""),
    consultor: str = Query(""),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    implantacoes = db.execute(
        select(Implantacao)
        .options(selectinload(Implantacao.cliente))
        .where(Implantacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    instalacoes = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.cliente))
        .where(Instalacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    clientes = db.execute(select(Cliente)).scalars().all()

    if estado:
        implantacoes = [i for i in implantacoes if _get_estado(i.cliente) == estado.upper()]
        instalacoes  = [i for i in instalacoes  if _get_estado(i.cliente) == estado.upper()]
        clientes     = [c for c in clientes      if _get_estado(c) == estado.upper()]

    if consultor:
        implantacoes = [i for i in implantacoes if consultor.lower() in (i.consultor or "").lower()]

    impl_concluidas = sum(1 for i in implantacoes if i.status == "concluida")
    impl_andamento  = sum(1 for i in implantacoes if i.status == "em_andamento")
    impl_pausadas   = sum(1 for i in implantacoes if i.status == "pausada")
    inst_concluidas = sum(1 for i in instalacoes  if i.status == "concluida")
    inst_pendentes  = sum(1 for i in instalacoes  if i.status in ("agendada", "em_execucao"))

    total_fin  = len(implantacoes) + len(instalacoes)
    finalizados = impl_concluidas + inst_concluidas
    taxa = round(finalizados / total_fin * 100, 1) if total_fin > 0 else 0.0

    hoje = date.today()
    ini_mes  = hoje.replace(day=1)
    ini_ant  = (ini_mes - timedelta(days=1)).replace(day=1)
    mes_atual  = sum(1 for i in implantacoes if i.created_at.date() >= ini_mes)
    mes_passado = sum(1 for i in implantacoes if ini_ant <= i.created_at.date() < ini_mes)
    crescimento = round((mes_atual - mes_passado) / mes_passado * 100, 1) if mes_passado > 0 else 0.0

    return {
        "total_clientes":          len(clientes),
        "implantacoes_concluidas": impl_concluidas,
        "implantacoes_andamento":  impl_andamento,
        "implantacoes_pausadas":   impl_pausadas,
        "instalacoes_concluidas":  inst_concluidas,
        "instalacoes_pendentes":   inst_pendentes,
        "taxa_conclusao":          taxa,
        "crescimento_mensal":      crescimento,
    }


def _mes_range(hoje: date, meses_atras: int) -> tuple[date, date]:
    """Retorna (primeiro_dia, primeiro_dia_mes_seguinte) para N meses atrás."""
    mes = hoje.month - meses_atras
    ano = hoje.year
    while mes <= 0:
        mes += 12
        ano -= 1
    ref  = date(ano, mes, 1)
    prox = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)
    return ref, prox


@router.get("/evolucao-mensal")
def evolucao_mensal(
    meses: int = Query(12),
    db: Session = Depends(get_db),
):
    hoje = date.today()

    # Carrega todos uma vez e filtra em Python — evita N queries
    impl_all = db.execute(select(Implantacao)).scalars().all()
    inst_all = db.execute(select(Instalacao)).scalars().all()

    resultado = []
    for i in range(meses - 1, -1, -1):
        ref, prox = _mes_range(hoje, i)

        # Criados neste mês
        impl_mes = [x for x in impl_all if ref <= x.created_at.date() < prox]
        inst_mes = [x for x in inst_all if ref <= x.created_at.date() < prox]

        # Concluídos neste mês (pela data de conclusão real, não criação)
        impl_concl = sum(
            1 for x in impl_all
            if x.data_conclusao and ref <= x.data_conclusao < prox
        )
        inst_concl = sum(
            1 for x in inst_all
            if x.data_conclusao and ref <= x.data_conclusao < prox
        )

        resultado.append({
            "mes":          _mes_label(ref),
            "implantacoes": len(impl_mes),
            "instalacoes":  len(inst_mes),
            "concluidas":   impl_concl + inst_concl,
        })

    return resultado


@router.get("/equipe")
def equipe(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    instalacoes = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.responsavel))
        .where(
            Instalacao.created_at >= datetime.combine(desde, datetime.min.time()),
            Instalacao.responsavel_id.isnot(None),
        )
    ).scalars().all()

    usuarios = db.execute(select(Usuario).where(Usuario.ativo == True)).scalars().all()
    users_map = {u.id: u for u in usuarios}

    por_tecnico: dict[int, dict] = {}
    for inst in instalacoes:
        uid = inst.responsavel_id
        if uid not in por_tecnico:
            nome = users_map.get(uid, inst.responsavel)
            por_tecnico[uid] = {
                "id": uid,
                "nome": nome.nome if hasattr(nome, "nome") else str(nome),
                "avatar_url": nome.avatar_url if hasattr(nome, "avatar_url") else None,
                "total": 0, "concluidas": 0, "em_execucao": 0,
                "tempo_medio_min": 0, "_tempos": [],
            }
        por_tecnico[uid]["total"] += 1
        if inst.status == "concluida":
            por_tecnico[uid]["concluidas"] += 1
            if inst.duracao_minutos:
                por_tecnico[uid]["_tempos"].append(inst.duracao_minutos)
        elif inst.status == "em_execucao":
            por_tecnico[uid]["em_execucao"] += 1

    result = []
    for entry in por_tecnico.values():
        tempos = entry.pop("_tempos")
        entry["tempo_medio_min"] = round(sum(tempos) / len(tempos)) if tempos else 0
        entry["taxa_conclusao"] = round(entry["concluidas"] / entry["total"] * 100, 1) if entry["total"] else 0
        result.append(entry)

    result.sort(key=lambda x: x["concluidas"], reverse=True)
    for i, r in enumerate(result):
        r["ranking"] = i + 1

    return result


@router.get("/produtos")
def produtos(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    instalacoes = db.execute(
        select(Instalacao).where(
            Instalacao.created_at >= datetime.combine(desde, datetime.min.time()),
        )
    ).scalars().all()

    contagem: dict[str, dict] = {}
    for inst in instalacoes:
        tipos = _parse_tipos(inst)
        for t in tipos:
            chave = _normalizar_tipo(t)
            if chave not in contagem:
                contagem[chave] = {"produto": chave, "total": 0, "concluidas": 0, "tempos": []}
            contagem[chave]["total"] += 1
            if inst.status == "concluida":
                contagem[chave]["concluidas"] += 1
                if inst.duracao_minutos:
                    contagem[chave]["tempos"].append(inst.duracao_minutos)

    result = []
    for entry in contagem.values():
        tempos = entry.pop("tempos")
        entry["tempo_medio_min"] = round(sum(tempos) / len(tempos)) if tempos else 0
        entry["taxa_conclusao"] = round(entry["concluidas"] / entry["total"] * 100, 1) if entry["total"] else 0
        result.append(entry)

    result.sort(key=lambda x: x["total"], reverse=True)
    return result


@router.get("/por-estado")
def por_estado(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    clientes = db.execute(select(Cliente)).scalars().all()

    implantacoes = db.execute(
        select(Implantacao)
        .options(selectinload(Implantacao.cliente))
        .where(Implantacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    instalacoes = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.cliente))
        .where(Instalacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    por_uf: dict[str, dict] = {}

    for c in clientes:
        uf = _get_estado(c) or "N/A"
        if uf not in por_uf:
            por_uf[uf] = {"estado": uf, "clientes": 0, "implantacoes": 0, "instalacoes": 0, "concluidas": 0}
        por_uf[uf]["clientes"] += 1

    for i in implantacoes:
        uf = _get_estado(i.cliente) or "N/A"
        if uf not in por_uf:
            por_uf[uf] = {"estado": uf, "clientes": 0, "implantacoes": 0, "instalacoes": 0, "concluidas": 0}
        por_uf[uf]["implantacoes"] += 1
        if i.status == "concluida":
            por_uf[uf]["concluidas"] += 1

    for i in instalacoes:
        uf = _get_estado(i.cliente) or "N/A"
        if uf not in por_uf:
            por_uf[uf] = {"estado": uf, "clientes": 0, "implantacoes": 0, "instalacoes": 0, "concluidas": 0}
        por_uf[uf]["instalacoes"] += 1

    result = sorted(por_uf.values(), key=lambda x: x["clientes"], reverse=True)
    return result


@router.get("/clientes-mapa")
def clientes_mapa(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    implantacoes = db.execute(
        select(Implantacao)
        .options(selectinload(Implantacao.cliente))
        .where(Implantacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    result = []
    for impl in implantacoes:
        c = impl.cliente
        if not c:
            continue
        uf = _get_estado(c)
        cidade = _get_cidade(c)
        coords = ESTADO_CENTROIDES.get(uf)
        if not coords:
            continue

        # Pequeno deslocamento determinístico por ID (evita sobreposição total)
        lat = coords[0] + (impl.id % 11 - 5) * 0.15
        lng = coords[1] + (impl.id % 7  - 3) * 0.20

        result.append({
            "id":          impl.id,
            "cliente_id":  c.id,
            "cliente_nome": c.razao_social,
            "cidade":      cidade,
            "estado":      uf,
            "lat":         round(lat, 4),
            "lng":         round(lng, 4),
            "status":      impl.status,
            "consultor":   impl.consultor or "",
            "data_prevista": impl.data_prevista.isoformat() if impl.data_prevista else None,
            "progresso":   impl.progresso,
            "sla_status":  impl.sla_status,
        })

    return result


@router.get("/por-consultor")
def por_consultor(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    implantacoes = db.execute(
        select(Implantacao).where(
            Implantacao.created_at >= datetime.combine(desde, datetime.min.time()),
            Implantacao.consultor.isnot(None),
        )
    ).scalars().all()

    por_consultor: dict[str, dict] = {}
    for impl in implantacoes:
        nome = (impl.consultor or "Sem consultor").strip()
        if nome not in por_consultor:
            por_consultor[nome] = {"consultor": nome, "total": 0, "concluidas": 0, "andamento": 0, "progresso_medio": []}
        por_consultor[nome]["total"] += 1
        if impl.status == "concluida":
            por_consultor[nome]["concluidas"] += 1
        elif impl.status == "em_andamento":
            por_consultor[nome]["andamento"] += 1
        por_consultor[nome]["progresso_medio"].append(impl.progresso or 0)

    result = []
    for entry in por_consultor.values():
        progs = entry.pop("progresso_medio")
        entry["progresso_medio"] = round(sum(progs) / len(progs)) if progs else 0
        entry["taxa_conclusao"] = round(entry["concluidas"] / entry["total"] * 100, 1) if entry["total"] else 0
        result.append(entry)

    result.sort(key=lambda x: x["total"], reverse=True)
    return result
