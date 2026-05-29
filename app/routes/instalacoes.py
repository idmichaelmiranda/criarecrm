from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func
from pathlib import Path
import re
import unicodedata
import json

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
import app.services.storage_service as storage
from app.models.instalacao import Instalacao, InstalacaoChecklist, InstalacaoComentario, InstalacaoAnexo
from app.models.cliente import Cliente
from app.models.usuario import Usuario
from app.models.template import Template, TemplateEtapa, TemplateTarefa
from pydantic import BaseModel as PydanticBase

from app.schemas.instalacao import (
    InstalacaoCreate, InstalacaoUpdate, InstalacaoEditar,
    InstalacaoListResponse, InstalacaoFullResponse,
    ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemResponse, ChecklistItemToggleResponse,
    ComentarioCreate, ComentarioResponse,
    TipoInstalacaoInfo, AnexoResponse,
)

router = APIRouter(prefix="/instalacoes", tags=["instalacoes"])


def _criar_notif_atribuicao(db: Session, inst: "Instalacao", usuario_id: int) -> None:
    """Cria notificação para o usuário recém-atribuído como responsável da instalação."""
    from app.models.notificacao import Notificacao
    cliente = db.get(Cliente, inst.cliente_id)
    cliente_nome = cliente.razao_social if cliente else f"Cliente #{inst.cliente_id}"
    db.add(Notificacao(
        usuario_id=usuario_id,
        tipo="instalacao",
        titulo="Nova instalação atribuída a você",
        mensagem=f"{inst.codigo} — {cliente_nome}",
        dados={"instalacao_id": inst.id, "codigo": inst.codigo},
        lida=False,
    ))


def _criar_notif_conclusao(db: Session, inst: "Instalacao", finalizado_por: "Usuario") -> None:
    """Notifica criador + usuários com notif_conclusao=True quando instalação é finalizada."""
    from app.models.notificacao import Notificacao
    from app.models.usuario import Usuario as UsuarioModel
    from datetime import timezone as _tz
    from sqlalchemy import select as _select
    cliente = db.get(Cliente, inst.cliente_id)
    cliente_nome = cliente.razao_social if cliente else f"Cliente #{inst.cliente_id}"
    data_str = datetime.now(_tz.utc).strftime("%d/%m/%Y %H:%M")
    titulo = f"Instalação — {cliente_nome} finalizada"
    mensagem = f"Finalizado por {finalizado_por.nome} em {data_str}"
    dados = {"instalacao_id": inst.id, "codigo": inst.codigo}
    notificados: set[int] = {finalizado_por.id}
    if inst.criado_por_id and inst.criado_por_id not in notificados:
        db.add(Notificacao(usuario_id=inst.criado_por_id, tipo="instalacao",
                           titulo=titulo, mensagem=mensagem, dados=dados, lida=False))
        notificados.add(inst.criado_por_id)
    usuarios_flag = db.execute(
        _select(UsuarioModel).where(UsuarioModel.notif_conclusao == True, UsuarioModel.ativo == True)  # noqa: E712
    ).scalars().all()
    for u in usuarios_flag:
        if u.id not in notificados:
            db.add(Notificacao(usuario_id=u.id, tipo="instalacao",
                               titulo=titulo, mensagem=mensagem, dados=dados, lida=False))
            notificados.add(u.id)


def _safe_storage_name(original: str) -> str:
    """Converte nome de arquivo para path seguro no Supabase Storage.
    Remove acentos, substitui espaços/especiais por underscore, preserva extensão."""
    stem = Path(original).stem
    ext = Path(original).suffix  # inclui o ponto, ex.: ".pdf"
    # Remove acentos (NFD + encode ascii)
    stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode("ascii")
    # Substitui qualquer char que não seja alfanum, hífen ou ponto por underscore
    stem = re.sub(r"[^\w\-]", "_", stem)
    # Colapsa underscores múltiplos e remove das bordas
    stem = re.sub(r"_+", "_", stem).strip("_") or "arquivo"
    return f"{stem}{ext}"

# Prefixo do código: IN-YYYYMMDD-XXXX
def _gerar_codigo(db: Session) -> str:
    hoje = date.today().strftime("%Y%m%d")
    count = db.execute(
        select(func.count()).select_from(Instalacao)
    ).scalar_one()
    return f"IN-{hoje}-{count + 1:04d}"


def _load(instalacao_id: int, db: Session) -> Instalacao:
    inst = db.execute(
        select(Instalacao)
        .options(
            selectinload(Instalacao.checklist),
            selectinload(Instalacao.comentarios),
            selectinload(Instalacao.responsavel),
            selectinload(Instalacao.criado_por),
            selectinload(Instalacao.anexos),
        )
        .where(Instalacao.id == instalacao_id)
    ).scalar_one_or_none()
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    return inst


def _to_list_response(inst: Instalacao, cliente: Cliente | None) -> InstalacaoListResponse:
    item = InstalacaoListResponse.model_validate(inst)
    item.cliente_nome = cliente.razao_social if cliente else None
    item.cliente_cnpj = cliente.cnpj if cliente else None
    item.responsavel_nome = inst.responsavel.nome if inst.responsavel else None
    if inst.responsavel and inst.responsavel.avatar_path:
        item.responsavel_avatar_url = storage.avatar_url(inst.responsavel.avatar_path)
    return item


def _to_full_response(inst: Instalacao, db: Session | None = None) -> InstalacaoFullResponse:
    resp = InstalacaoFullResponse.model_validate(inst)
    resp.responsavel_nome = inst.responsavel.nome if inst.responsavel else None
    if inst.responsavel and inst.responsavel.avatar_path:
        resp.responsavel_avatar_url = storage.avatar_url(inst.responsavel.avatar_path)
    resp.criado_por_nome = inst.criado_por.nome if inst.criado_por else None
    if db:
        # For single-type installs use tipo; for multi-type use first tipo
        from app.schemas.instalacao import _parse_tipos
        tipos = _parse_tipos(inst)
        primary = tipos[0] if tipos else inst.tipo
        # Normaliza: evita duplo prefixo quando o slug já é "instalacao_xxx"
        primary_slug = primary.removeprefix("instalacao_")
        template_tipo = f"instalacao_{primary_slug}"
        t = db.execute(
            select(Template).where(Template.tipo == template_tipo, Template.ativo == True)
        ).scalar_one_or_none()
        if t:
            resp.template_id = t.id
            resp.template_pop_pdf_path = t.pop_pdf_path
    return resp


def _recalcular_progresso(inst: Instalacao) -> None:
    total = len(inst.checklist)
    if total == 0:
        inst.progresso = 0
        return
    concluidos = sum(1 for i in inst.checklist if i.status == "concluido")
    inst.progresso = round(concluidos / total * 100)


def _checklist_from_template(tipo: str, db: Session) -> list[tuple[str, bool]]:
    """Busca tarefas do template de instalação. Retorna lista de (titulo, obrigatoria).
    Se o produto tiver checklist_template_id configurado, usa esse template;
    caso contrário usa as tarefas do próprio template do produto."""
    template_tipo = tipo if tipo.startswith("instalacao_") else f"instalacao_{tipo}"
    t = db.execute(
        select(Template).where(Template.tipo == template_tipo, Template.ativo == True)
    ).scalar_one_or_none()
    if t:
        source_id = t.checklist_template_id if t.checklist_template_id else t.id
        tarefas = db.execute(
            select(TemplateTarefa)
            .join(TemplateEtapa)
            .where(TemplateEtapa.template_id == source_id, TemplateTarefa.parent_id == None)  # noqa: E711
            .order_by(TemplateEtapa.ordem, TemplateTarefa.ordem)
        ).scalars().all()
        if tarefas:
            return [(ta.titulo, ta.obrigatoria) for ta in tarefas]
    return [
        ("Levantamento de requisitos", True),
        ("Instalação / configuração",  True),
        ("Testes e validação",         True),
        ("Aprovação do cliente",       True),
    ]


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[InstalacaoListResponse])
def listar(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.responsavel))
        .order_by(Instalacao.created_at.desc())
    ).scalars().all()
    return [_to_list_response(inst, db.get(Cliente, inst.cliente_id)) for inst in rows]


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    rows = db.execute(select(Instalacao)).scalars().all()
    return {
        "total": len(rows),
        "agendadas": sum(1 for r in rows if r.status == "agendada"),
        "em_execucao": sum(1 for r in rows if r.status == "em_execucao"),
        "concluidas": sum(1 for r in rows if r.status == "concluida"),
        "canceladas": sum(1 for r in rows if r.status == "cancelada"),
        "sem_responsavel": sum(
            1 for r in rows
            if not r.responsavel_id and r.status not in ("concluida", "cancelada")
        ),
    }


@router.get("/tipos", response_model=list[TipoInstalacaoInfo])
def listar_tipos(db: Session = Depends(get_db)):
    """Retorna todos os tipos de produto de instalação (ativos e inativos)."""
    templates = db.execute(
        select(Template)
        .options(selectinload(Template.etapas).selectinload(TemplateEtapa.tarefas))
        .where(Template.tipo.like("instalacao_%"))
        .order_by(Template.nome)
    ).scalars().all()
    return [
        TipoInstalacaoInfo(
            id=t.id,
            nome=t.nome_produto or t.nome,
            tipo=t.tipo,
            cor=t.etapas[0].cor if t.etapas else "#6366f1",
            n_tarefas=sum(len(e.tarefas) for e in t.etapas),
            ativo=t.ativo,
            checklist_template_id=t.checklist_template_id,
        )
        for t in templates
    ]


@router.post("/", response_model=InstalacaoFullResponse, status_code=201)
def criar(data: InstalacaoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    if not db.get(Cliente, data.cliente_id):
        raise HTTPException(404, "Cliente não encontrado")
    if data.responsavel_id and not db.get(Usuario, data.responsavel_id):
        raise HTTPException(404, "Usuário responsável não encontrado")

    tipo_primario = data.tipos[0]

    # Snapshot dos nomes de produto — independe de renomear o template depois
    tipo_nomes_map: dict[str, str] = {}
    for tipo in data.tipos:
        template_tipo = tipo if tipo.startswith("instalacao_") else f"instalacao_{tipo}"
        t_nome = db.execute(
            select(Template).where(Template.tipo == template_tipo, Template.ativo == True)
        ).scalar_one_or_none()
        tipo_nomes_map[tipo] = t_nome.nome if t_nome else tipo

    inst = Instalacao(
        codigo=_gerar_codigo(db),
        cliente_id=data.cliente_id,
        tipo=tipo_primario,
        tipos_json=json.dumps(data.tipos),
        tipos_nomes_json=json.dumps(tipo_nomes_map),
        quantidade=data.quantidade,
        prioridade=data.prioridade,
        responsavel_id=data.responsavel_id,
        criado_por_id=current_user.id,
        observacoes=data.observacoes,
        data_agendada=data.data_agendada,
        contato_nome=data.contato_nome,
        contato_telefone=data.contato_telefone,
    )
    db.add(inst)
    db.flush()

    if data.responsavel_id:
        _criar_notif_atribuicao(db, inst, data.responsavel_id)

    # Merge checklists from all selected types
    ordem = 1
    for tipo in data.tipos:
        for titulo, obrigatoria in _checklist_from_template(tipo, db):
            db.add(InstalacaoChecklist(
                instalacao_id=inst.id,
                titulo=titulo,
                obrigatoria=obrigatoria,
                ordem=ordem,
                tipo=tipo,
            ))
            ordem += 1

    db.commit()
    return _to_full_response(_load(inst.id, db), db)


@router.get("/{instalacao_id}", response_model=InstalacaoFullResponse)
def obter(instalacao_id: int, db: Session = Depends(get_db)):
    return _to_full_response(_load(instalacao_id, db), db)


@router.patch("/{instalacao_id}", response_model=InstalacaoFullResponse)
def atualizar(instalacao_id: int, data: InstalacaoUpdate, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")

    old_responsavel_id = inst.responsavel_id

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(inst, field, value)

    # responsavel_id=null deve ser honrado mesmo sendo None (exclude_none=True pularia)
    if "responsavel_id" in data.model_fields_set and data.responsavel_id is None:
        inst.responsavel_id = None

    # Notifica o novo responsável quando a atribuição muda
    new_responsavel_id = inst.responsavel_id
    if new_responsavel_id and new_responsavel_id != old_responsavel_id:
        _criar_notif_atribuicao(db, inst, new_responsavel_id)

    if inst.status == "concluida" and not inst.data_conclusao:
        inst.data_conclusao = date.today()

    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.put("/{instalacao_id}/editar", response_model=InstalacaoFullResponse)
def editar(instalacao_id: int, data: InstalacaoEditar, db: Session = Depends(get_db)):
    """Edição completa antes de iniciar — disponível apenas quando status='agendada'."""
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    if inst.status != "agendada":
        raise HTTPException(400, "Edição completa disponível apenas para instalações com status 'agendada'.")

    tipos_atuais = json.loads(inst.tipos_json or "[]") or ([inst.tipo] if inst.tipo else [])
    tipos_novos = data.tipos

    if tipos_novos is not None and set(tipos_novos) != set(tipos_atuais):
        # Bloqueia se algum item já foi marcado
        marcados = [i for i in inst.checklist if i.status != "pendente"]
        if marcados:
            raise HTTPException(
                400,
                f"Não é possível alterar produtos: {len(marcados)} item(ns) do checklist já foram marcados."
            )
        # Apaga checklist atual e gera novo
        for item in list(inst.checklist):
            db.delete(item)
        db.flush()

        inst.tipo = tipos_novos[0]
        inst.tipos_json = json.dumps(tipos_novos)

        tipo_nomes_map: dict[str, str] = {}
        for tipo in tipos_novos:
            template_tipo = tipo if tipo.startswith("instalacao_") else f"instalacao_{tipo}"
            t_nome = db.execute(
                select(Template).where(Template.tipo == template_tipo, Template.ativo == True)
            ).scalar_one_or_none()
            tipo_nomes_map[tipo] = t_nome.nome if t_nome else tipo
        inst.tipos_nomes_json = json.dumps(tipo_nomes_map)

        ordem = 1
        for tipo in tipos_novos:
            for titulo, obrigatoria in _checklist_from_template(tipo, db):
                db.add(InstalacaoChecklist(
                    instalacao_id=inst.id,
                    titulo=titulo,
                    obrigatoria=obrigatoria,
                    ordem=ordem,
                    tipo=tipo,
                ))
                ordem += 1

    # Campos simples
    for field in ("prioridade", "quantidade", "observacoes", "data_agendada",
                  "contato_nome", "contato_telefone"):
        val = getattr(data, field)
        if val is not None:
            setattr(inst, field, val)

    # responsavel_id pode ser null explícito
    if "responsavel_id" in data.model_fields_set:
        old_resp = inst.responsavel_id
        inst.responsavel_id = data.responsavel_id
        if data.responsavel_id and data.responsavel_id != old_resp:
            _criar_notif_atribuicao(db, inst, data.responsavel_id)

    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.delete("/{instalacao_id}", status_code=204)
def deletar(instalacao_id: int, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    db.delete(inst)
    db.commit()


# ── Checklist ─────────────────────────────────────────────────────────────────

@router.patch("/{instalacao_id}/checklist/{item_id}", response_model=ChecklistItemToggleResponse)
def atualizar_item(instalacao_id: int, item_id: int, data: ChecklistItemUpdate, db: Session = Depends(get_db)):
    item = db.get(InstalacaoChecklist, item_id)
    if not item or item.instalacao_id != instalacao_id:
        raise HTTPException(404, "Item não encontrado")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    if data.status == "concluido" and not item.data_conclusao:
        item.data_conclusao = datetime.now(timezone.utc)
    elif data.status in ("pendente", "nao_aplicavel"):
        item.data_conclusao = None

    inst = _load(instalacao_id, db)
    _recalcular_progresso(inst)

    # Única transição automática: agendada → em_execucao ao marcar o primeiro item.
    alguma_concluida = any(i.status == "concluido" for i in inst.checklist)
    if inst.status == "agendada" and alguma_concluida:
        inst.status = "em_execucao"

    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return ChecklistItemToggleResponse(
        item=ChecklistItemResponse.model_validate(item),
        progresso=inst.progresso,
        instalacao_status=inst.status,
    )


@router.post("/{instalacao_id}/checklist", response_model=InstalacaoFullResponse, status_code=201)
def adicionar_item(instalacao_id: int, data: ChecklistItemCreate, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")

    ordem = db.execute(
        select(func.max(InstalacaoChecklist.ordem))
        .where(InstalacaoChecklist.instalacao_id == instalacao_id)
    ).scalar_one_or_none() or 0

    db.add(InstalacaoChecklist(
        instalacao_id=instalacao_id,
        titulo=data.titulo,
        obrigatoria=data.obrigatoria,
        ordem=ordem + 1,
    ))
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.delete("/{instalacao_id}/checklist/{item_id}", response_model=InstalacaoFullResponse)
def deletar_item(instalacao_id: int, item_id: int, db: Session = Depends(get_db)):
    item = db.get(InstalacaoChecklist, item_id)
    if not item or item.instalacao_id != instalacao_id:
        raise HTTPException(404, "Item não encontrado")
    db.delete(item)

    inst = _load(instalacao_id, db)
    _recalcular_progresso(inst)
    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


# ── Timer ────────────────────────────────────────────────────────────────────

class FinalizarPayload(PydanticBase):
    observacao_final: str | None = None


@router.post("/{instalacao_id}/iniciar", response_model=InstalacaoFullResponse)
def iniciar(instalacao_id: int, db: Session = Depends(get_db)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    if inst.iniciado_em:
        raise HTTPException(400, "Instalação já foi iniciada")
    inst.iniciado_em = datetime.now(timezone.utc)
    inst.status = "em_execucao"
    inst.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.post("/{instalacao_id}/finalizar", response_model=InstalacaoFullResponse)
def finalizar(instalacao_id: int, data: FinalizarPayload, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    inst = db.get(Instalacao, instalacao_id)
    if not inst:
        raise HTTPException(404, "Instalação não encontrada")
    if not inst.iniciado_em:
        raise HTTPException(400, "Instalação não foi iniciada")
    if inst.finalizado_em:
        raise HTTPException(400, "Instalação já foi finalizada")

    now = datetime.now(timezone.utc)
    inst.finalizado_em = now
    iniciado = inst.iniciado_em if inst.iniciado_em.tzinfo else inst.iniciado_em.replace(tzinfo=timezone.utc)
    inst.duracao_minutos = max(1, round((now - iniciado).total_seconds() / 60))
    inst.status = "concluida"
    inst.data_conclusao = date.today()
    inst.updated_at = now

    if data.observacao_final:
        obs = (inst.observacoes or "").strip()
        suffix = f"[Conclusão] {data.observacao_final}"
        inst.observacoes = f"{obs}\n{suffix}".strip() if obs else suffix

    _criar_notif_conclusao(db, inst, current_user)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


# ── Comentários ───────────────────────────────────────────────────────────────

@router.post("/{instalacao_id}/comentarios", response_model=ComentarioResponse, status_code=201)
def adicionar_comentario(instalacao_id: int, data: ComentarioCreate, db: Session = Depends(get_db)):
    if not db.get(Instalacao, instalacao_id):
        raise HTTPException(404, "Instalação não encontrada")
    c = InstalacaoComentario(
        instalacao_id=instalacao_id,
        usuario=data.usuario,
        conteudo=data.conteudo,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


# ── Anexos ────────────────────────────────────────────────────────────────────

@router.post("/{instalacao_id}/anexos", response_model=InstalacaoFullResponse, status_code=201)
async def upload_anexo(
    instalacao_id: int,
    file: UploadFile = File(...),
    uploaded_by: str = Form("Admin"),
    db: Session = Depends(get_db),
):
    inst_check = db.get(Instalacao, instalacao_id)
    if not inst_check:
        raise HTTPException(404, "Instalação não encontrada")

    data = await file.read()
    safe_name = _safe_storage_name(file.filename or "arquivo")
    storage_path = f"instalacoes/{inst_check.codigo}/{safe_name}"
    await storage.upload_async(storage_path, data, file.content_type or "application/octet-stream")

    anexo = InstalacaoAnexo(
        instalacao_id=instalacao_id,
        filename=file.filename,
        storage_path=storage_path,
        content_type=file.content_type,
        tamanho_bytes=len(data),
        uploaded_by=uploaded_by,
    )
    db.add(anexo)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.delete("/{instalacao_id}/anexos/{anexo_id}", response_model=InstalacaoFullResponse)
def deletar_anexo(instalacao_id: int, anexo_id: int, db: Session = Depends(get_db)):
    anexo = db.get(InstalacaoAnexo, anexo_id)
    if not anexo or anexo.instalacao_id != instalacao_id:
        raise HTTPException(404, "Anexo não encontrado")
    storage.delete_sync(anexo.storage_path)
    db.delete(anexo)
    db.commit()
    return _to_full_response(_load(instalacao_id, db), db)


@router.get("/{instalacao_id}/anexos/{anexo_id}/download")
def download_anexo(instalacao_id: int, anexo_id: int, db: Session = Depends(get_db)):
    anexo = db.get(InstalacaoAnexo, anexo_id)
    if not anexo or anexo.instalacao_id != instalacao_id:
        raise HTTPException(404, "Anexo não encontrado")
    data = storage.download_sync(anexo.storage_path)
    if data is None:
        raise HTTPException(404, "Arquivo não encontrado no storage")
    return Response(
        content=data,
        media_type=anexo.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{anexo.filename}"'},
    )
