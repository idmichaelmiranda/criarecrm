import secrets
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, UploadFile

from app.models.solicitacao import Solicitacao
from app.schemas.solicitacao import SolicitacaoCreate
from app.services import timeline_service


def create_solicitacao(db: Session, data: SolicitacaoCreate) -> Solicitacao:
    sol = Solicitacao(
        razao_social=data.cliente.razao_social,
        nome_fantasia=data.cliente.nome_fantasia,
        cnpj=data.cliente.cnpj,
        ie=data.cliente.ie,
        email=str(data.cliente.email),
        telefone_fixo=data.cliente.telefone_fixo,
        telefone_celular=data.cliente.telefone_celular,
        responsavel=data.cliente.responsavel,
        endereco=data.endereco,
        contabilidade=data.contabilidade,
        dados_bancarios=data.dados_bancarios,
        dados_contabeis=data.dados_contabeis,
        formas_pagamento=data.formas_pagamento,
        dados_fiscais=data.dados_fiscais,
        adquirentes=data.adquirentes,
        sla_limite=datetime.now() + timedelta(hours=48),
    )
    db.add(sol)
    db.flush()

    timeline_service.log(
        db,
        tipo="solicitacao_criada",
        titulo="Solicitação recebida",
        descricao=f"Solicitação de implantação recebida de {sol.razao_social}.",
        icone="inbox",
        cor="#6366f1",
        solicitacao_id=sol.id,
    )

    db.commit()
    db.refresh(sol)
    return sol


def atualizar(db: Session, solicitacao_id: int, data: SolicitacaoCreate) -> Solicitacao:
    sol = get_by_id(db, solicitacao_id)
    if sol.status == "aprovada":
        raise HTTPException(400, "Solicitação já aprovada não pode ser editada")

    sol.razao_social = data.cliente.razao_social
    sol.nome_fantasia = data.cliente.nome_fantasia
    sol.cnpj = data.cliente.cnpj
    sol.ie = data.cliente.ie
    sol.email = str(data.cliente.email)
    sol.telefone_fixo = data.cliente.telefone_fixo
    sol.telefone_celular = data.cliente.telefone_celular
    sol.responsavel = data.cliente.responsavel
    sol.endereco = data.endereco
    sol.contabilidade = data.contabilidade
    sol.dados_bancarios = data.dados_bancarios
    sol.dados_contabeis = data.dados_contabeis
    sol.formas_pagamento = data.formas_pagamento
    sol.dados_fiscais = data.dados_fiscais
    sol.adquirentes = data.adquirentes
    sol.updated_at = datetime.now()

    timeline_service.log(
        db, tipo="dados_editados", titulo="Dados editados pelo administrador",
        descricao="Dados da solicitação corrigidos diretamente pelo administrador.",
        icone="edit", cor="#6366f1",
        solicitacao_id=sol.id,
    )
    db.commit()
    db.refresh(sol)
    return sol


def get_all(db: Session, status: str | None = None) -> list[Solicitacao]:
    stmt = select(Solicitacao).order_by(Solicitacao.created_at.desc())
    if status:
        statuses = status.split(",")
        stmt = stmt.where(Solicitacao.status.in_(statuses))
    return db.execute(stmt).scalars().all()


def get_by_id(db: Session, solicitacao_id: int) -> Solicitacao:
    sol = db.get(Solicitacao, solicitacao_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    return sol


def iniciar_triagem(db: Session, solicitacao_id: int) -> Solicitacao:
    sol = get_by_id(db, solicitacao_id)
    if sol.status != "nova":
        raise HTTPException(400, "Apenas solicitações novas podem iniciar triagem")
    sol.status = "em_triagem"
    sol.updated_at = datetime.now()
    timeline_service.log(
        db, tipo="triagem_iniciada", titulo="Triagem iniciada",
        descricao="Revisão da solicitação iniciada pela equipe.", icone="search", cor="#f59e0b",
        solicitacao_id=sol.id,
    )
    db.commit()
    db.refresh(sol)
    _dispatch_triagem_email(sol.email, sol.razao_social)
    return sol


def recusar(db: Session, solicitacao_id: int, motivo: str, campos_correcao: list[str] | None = None, usuario: str | None = None) -> Solicitacao:
    sol = get_by_id(db, solicitacao_id)
    if sol.status not in ("nova", "em_triagem", "aguardando_correcao"):
        raise HTTPException(400, "Solicitação não pode ser recusada neste estado")

    token = secrets.token_urlsafe(40)
    expires = datetime.now() + timedelta(days=7)

    # Acumula entrada no histórico de recusas
    entrada = {
        "data": datetime.now().isoformat(timespec="seconds"),
        "motivo": motivo,
        "campos": campos_correcao or [],
        "usuario": usuario,
    }
    historico = list(sol.historico_recusas or [])
    historico.append(entrada)

    sol.status = "aguardando_correcao"
    sol.motivo_recusa = motivo
    sol.campos_correcao = campos_correcao or []
    sol.historico_recusas = historico
    sol.review_token = token
    sol.review_token_expires_at = expires
    sol.sla_limite = expires  # prazo do cliente = prazo do token
    sol.updated_at = datetime.now()

    secoes_txt = ", ".join(campos_correcao) if campos_correcao else "não especificadas"
    timeline_service.log(
        db, tipo="recusada", titulo="Solicitação recusada",
        descricao=f"Motivo: {motivo}. Seções para correção: {secoes_txt}.",
        icone="x-circle", cor="#ef4444",
        solicitacao_id=sol.id,
        usuario=usuario or "Sistema",
    )
    db.commit()
    db.refresh(sol)

    _dispatch_revisao_email(sol.email, sol.razao_social, motivo, token)
    return sol


def reenviar_email_correcao(db: Session, solicitacao_id: int) -> Solicitacao:
    sol = get_by_id(db, solicitacao_id)
    if sol.status != "aguardando_correcao":
        raise HTTPException(400, "Solicitação não está aguardando correção.")
    if not sol.motivo_recusa:
        raise HTTPException(400, "Sem motivo de recusa registrado.")

    # Regenera token com prazo fresco de 7 dias (token antigo pode estar expirado)
    token = secrets.token_urlsafe(40)
    expires = datetime.now() + timedelta(days=7)
    sol.review_token = token
    sol.review_token_expires_at = expires
    sol.sla_limite = expires
    sol.updated_at = datetime.now()

    timeline_service.log(
        db, tipo="email_reenviado", titulo="Email de correção reenviado",
        descricao=f"Link de correção reenviado para {sol.email}. Novo prazo: 7 dias.",
        icone="mail", cor="#f59e0b",
        solicitacao_id=sol.id,
    )
    db.commit()
    db.refresh(sol)
    _dispatch_revisao_email(sol.email, sol.razao_social, sol.motivo_recusa, token)
    return sol


def cancelar(db: Session, solicitacao_id: int, motivo: str | None = None) -> Solicitacao:
    sol = get_by_id(db, solicitacao_id)
    if sol.status == "aprovada":
        raise HTTPException(400, "Solicitação já aprovada não pode ser cancelada — cancele a implantação diretamente.")
    if sol.status == "cancelada":
        raise HTTPException(400, "Solicitação já foi cancelada.")

    sol.status = "cancelada"
    sol.updated_at = datetime.now()

    descricao = f"Motivo: {motivo}." if motivo else "Cancelada sem motivo registrado."
    timeline_service.log(
        db, tipo="cancelada", titulo="Solicitação cancelada",
        descricao=descricao,
        icone="ban", cor="#6b7280",
        solicitacao_id=sol.id,
    )
    db.commit()
    db.refresh(sol)
    return sol


def _dispatch_revisao_email(email: str, razao_social: str, motivo: str, token: str) -> None:
    from app.services import email_service
    cfg = email_service.get_config()
    if not cfg or not cfg.get("host"):
        print("[EMAIL] Config de email não encontrada — email não enviado.")
        return
    frontend_url = (cfg.get("frontend_url") or "").rstrip("/")
    link = f"{frontend_url}/revisao/{token}"
    email_service.send_revisao_email_async(email, razao_social, motivo, link)


def _dispatch_triagem_email(email: str, razao_social: str) -> None:
    from app.services import email_service
    cfg = email_service.get_config()
    if not cfg or not cfg.get("host"):
        print("[EMAIL] Config de email não encontrada — email não enviado.")
        return
    email_service.send_triagem_email_async(email, razao_social)


def get_by_token(db: Session, token: str) -> Solicitacao:
    sol = db.execute(
        select(Solicitacao).where(Solicitacao.review_token == token)
    ).scalar_one_or_none()

    if not sol:
        raise HTTPException(404, "Link inválido ou expirado.")
    if sol.review_token_expires_at and sol.review_token_expires_at < datetime.now():
        raise HTTPException(410, "Este link expirou. Entre em contato com nossa equipe.")
    return sol


def submit_revisao(db: Session, token: str, data: SolicitacaoCreate) -> Solicitacao:
    sol = get_by_token(db, token)

    sol.razao_social = data.cliente.razao_social
    sol.nome_fantasia = data.cliente.nome_fantasia
    sol.cnpj = data.cliente.cnpj
    sol.ie = data.cliente.ie
    sol.email = str(data.cliente.email)
    sol.telefone_fixo = data.cliente.telefone_fixo
    sol.telefone_celular = data.cliente.telefone_celular
    sol.responsavel = data.cliente.responsavel
    sol.endereco = data.endereco
    sol.contabilidade = data.contabilidade
    sol.dados_bancarios = data.dados_bancarios
    sol.dados_contabeis = data.dados_contabeis
    sol.formas_pagamento = data.formas_pagamento
    sol.dados_fiscais = data.dados_fiscais
    sol.adquirentes = data.adquirentes

    # Volta para em_triagem (não "nova" — já passou por análise) e invalida o token
    sol.status = "em_triagem"
    sol.sla_limite = datetime.now() + timedelta(hours=48)
    sol.review_token = None
    sol.review_token_expires_at = None
    sol.updated_at = datetime.now()

    timeline_service.log(
        db, tipo="revisao_enviada", titulo="Dados corrigidos pelo cliente",
        descricao="O cliente corrigiu os dados e reenviou para análise. SLA reiniciado.",
        icone="check-circle", cor="#10b981",
        solicitacao_id=sol.id,
    )
    db.commit()
    db.refresh(sol)
    return sol


async def upload_certificado(db: Session, solicitacao_id: int, file: UploadFile) -> str:
    sol = get_by_id(db, solicitacao_id)
    upload_dir = Path("uploads/certificados")
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"sol_{solicitacao_id}_{file.filename}"
    file_path = upload_dir / safe_name
    content = await file.read()
    file_path.write_bytes(content)
    sol.certificado_path = str(file_path)
    db.commit()
    return str(file_path)


async def upload_certificado_by_token(db: Session, token: str, file: UploadFile) -> str:
    sol = get_by_token(db, token)
    return await upload_certificado(db, sol.id, file)


def stats(db: Session) -> dict:
    from sqlalchemy import func
    rows = db.execute(
        select(Solicitacao.status, func.count().label("n"))
        .group_by(Solicitacao.status)
    ).all()
    return {r.status: r.n for r in rows}
