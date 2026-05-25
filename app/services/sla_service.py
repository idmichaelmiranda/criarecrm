import threading
import time
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.implantacao import Implantacao


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


def start_worker() -> None:
    from app.database.connection import SessionLocal

    def _loop() -> None:
        while True:
            time.sleep(900)  # 15 min
            try:
                db = SessionLocal()
                try:
                    n = recalculate(db)
                    if n:
                        print(f"[SLA] {n} implantacao(es) atualizadas")
                except Exception as exc:
                    print(f"[SLA] Erro no worker: {exc}")
                finally:
                    db.close()
            except Exception:
                pass

    t = threading.Thread(target=_loop, daemon=True, name="sla-worker")
    t.start()
    print("[SLA] Worker iniciado (intervalo: 15 min)")
