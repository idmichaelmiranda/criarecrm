import threading
import time
from collections import defaultdict
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.implantacao import Implantacao

# Hora local em que as notificações de atraso são disparadas (07h00)
_HORA_NOTIF_ATRASO = 7


def recalculate(db: Session) -> int:
    today = date.today()
    implantacoes = db.execute(
        select(Implantacao).where(
            Implantacao.status.in_(["em_andamento", "pausada"]),
            Implantacao.sla_limite.isnot(None),
        )
    ).scalars().all()

    updated = 0
    for impl in implantacoes:
        days = (impl.sla_limite - today).days
        if days < 0:
            new = "atrasada"
        elif days <= 3:
            new = "critico"
        else:
            new = "ok"
        if impl.sla_status != new:
            impl.sla_status = new
            updated += 1

    if updated:
        db.commit()

    return updated


def _notificar_atrasos(db: Session) -> int:
    """Envia uma notificação consolidada por usuário com instalações e tarefas em atraso.
    Idempotente: verifica se já foi enviada hoje antes de inserir."""
    from app.models.notificacao import Notificacao
    from app.models.instalacao import Instalacao
    from app.models.checklist import ChecklistItem
    from app.models.usuario import Usuario

    today = date.today()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Instalações com responsável definido, agendadas para antes de hoje e não finalizadas
    instalacoes_atrasadas = db.execute(
        select(Instalacao).where(
            Instalacao.data_agendada < today,
            Instalacao.status.not_in(["concluida", "cancelada"]),
            Instalacao.responsavel_id.isnot(None),
        )
    ).scalars().all()

    # Tarefas de implantação com prazo vencido e responsável definido
    tarefas_atrasadas = db.execute(
        select(ChecklistItem).where(
            ChecklistItem.data_prazo < today,
            ChecklistItem.status.not_in(["concluido", "nao_aplicavel"]),
            ChecklistItem.arquivado == False,  # noqa: E712
            ChecklistItem.responsavel_id.isnot(None),
        )
    ).scalars().all()

    # Agrupa por usuário
    por_usuario: dict[int, dict] = defaultdict(lambda: {"instalacoes": 0, "tarefas": 0})
    for inst in instalacoes_atrasadas:
        por_usuario[inst.responsavel_id]["instalacoes"] += 1
    for item in tarefas_atrasadas:
        por_usuario[item.responsavel_id]["tarefas"] += 1

    if not por_usuario:
        return 0

    # Carrega usuários ativos de uma vez
    usuarios_ativos = {
        u.id for u in db.execute(
            select(Usuario).where(Usuario.ativo == True, Usuario.id.in_(list(por_usuario.keys())))  # noqa: E712
        ).scalars().all()
    }

    enviados = 0
    for usuario_id, contagens in por_usuario.items():
        if usuario_id not in usuarios_ativos:
            continue

        # Deduplicação: não envia se já existe notif de atraso hoje para este usuário
        ja_enviada = db.execute(
            select(Notificacao).where(
                Notificacao.usuario_id == usuario_id,
                Notificacao.tipo == "atraso",
                Notificacao.created_at >= today_start,
            )
        ).scalar_one_or_none()
        if ja_enviada:
            continue

        n_inst  = contagens["instalacoes"]
        n_tref  = contagens["tarefas"]
        partes  = []
        if n_inst:
            partes.append(f"{n_inst} instalação{'ões' if n_inst > 1 else ''[1:]} em atraso" if n_inst > 1 else "1 instalação em atraso")
        if n_tref:
            partes.append(f"{n_tref} tarefa{'s' if n_tref > 1 else ''} em atraso")

        db.add(Notificacao(
            usuario_id=usuario_id,
            tipo="atraso",
            titulo="Itens em atraso",
            mensagem=" e ".join(partes) + ".",
            dados={"instalacoes": n_inst, "tarefas": n_tref},
            lida=False,
        ))
        enviados += 1

    if enviados:
        db.commit()
        print(f"[ATRASO] {enviados} notificação(ões) de atraso enviadas")

    return enviados


def start_worker() -> None:
    from app.database.connection import SessionLocal

    last_notif_date: list[date] = [None]  # mutável dentro da closure

    def _loop() -> None:
        while True:
            time.sleep(900)  # 15 min
            try:
                db = SessionLocal()
                try:
                    n = recalculate(db)
                    if n:
                        print(f"[SLA] {n} implantacao(es) atualizadas")

                    # Dispara notificações de atraso às 07h (uma vez por dia)
                    now = datetime.now()
                    today = date.today()
                    if now.hour == _HORA_NOTIF_ATRASO and last_notif_date[0] != today:
                        last_notif_date[0] = today
                        _notificar_atrasos(db)

                except Exception as exc:
                    print(f"[SLA] Erro no worker: {exc}")
                finally:
                    db.close()
            except Exception:
                pass

    t = threading.Thread(target=_loop, daemon=True, name="sla-worker")
    t.start()
    print("[SLA] Worker iniciado (intervalo: 15 min | notif atraso: 07h00)")
