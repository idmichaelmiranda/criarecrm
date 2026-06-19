from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.solicitacao import Solicitacao
from app.models.cliente import Cliente
from app.models.template import Template
from app.models.implantacao import Implantacao
from app.models.etapa import ImplantacaoEtapa
from app.models.checklist import ChecklistItem
from app.schemas.solicitacao import TriagemAprovar
from app.services import timeline_service


def aprovar(db: Session, solicitacao_id: int, data: TriagemAprovar, aprovador_id: int | None = None) -> Implantacao:
    sol = db.get(Solicitacao, solicitacao_id)
    if not sol or sol.status not in ["nova", "em_triagem", "aguardando_correcao"]:
        raise HTTPException(400, "Solicitação inválida para aprovação")

    # 1. Criar cliente ou reutilizar existente pelo CNPJ
    cliente = db.execute(
        select(Cliente).where(Cliente.cnpj == sol.cnpj)
    ).scalar_one_or_none()

    if cliente:
        # Atualiza dados da solicitação no cliente já existente
        # Se era um stub ERP, promove para cliente de triagem com dados completos
        cliente.razao_social = sol.razao_social
        cliente.nome_fantasia = sol.nome_fantasia
        cliente.ie = sol.ie
        cliente.email = sol.email
        cliente.telefone_fixo = sol.telefone_fixo
        cliente.telefone_celular = sol.telefone_celular
        cliente.responsavel = sol.responsavel
        cliente.endereco = sol.endereco
        cliente.contabilidade = sol.contabilidade
        cliente.dados_bancarios = sol.dados_bancarios
        cliente.dados_contabeis = sol.dados_contabeis
        cliente.formas_pagamento = sol.formas_pagamento
        cliente.dados_fiscais = sol.dados_fiscais
        cliente.adquirentes = sol.adquirentes
        cliente.solicitacao_id = sol.id
        cliente.origem = "triagem"
        db.flush()
    else:
        cliente = Cliente(
            solicitacao_id=sol.id,
            razao_social=sol.razao_social,
            nome_fantasia=sol.nome_fantasia,
            cnpj=sol.cnpj,
            ie=sol.ie,
            email=sol.email,
            telefone_fixo=sol.telefone_fixo,
            telefone_celular=sol.telefone_celular,
            responsavel=sol.responsavel,
            endereco=sol.endereco,
            contabilidade=sol.contabilidade,
            dados_bancarios=sol.dados_bancarios,
            dados_contabeis=sol.dados_contabeis,
            formas_pagamento=sol.formas_pagamento,
            dados_fiscais=sol.dados_fiscais,
            adquirentes=sol.adquirentes,
            origem="triagem",
        )
        db.add(cliente)
        db.flush()

    # 2. Gerar código único
    total = db.execute(select(func.count()).select_from(Implantacao)).scalar_one()
    codigo = f"IMP-{datetime.now().year}-{total + 1:04d}"

    # 3. Criar implantação
    data_inicio = date.today()
    sla_limite = data_inicio + timedelta(days=data.sla_dias)

    implantacao = Implantacao(
        cliente_id=cliente.id,
        template_id=data.template_ids[0],
        solicitacao_id=sol.id,
        codigo=codigo,
        nome=f"Implantação — {sol.razao_social}",
        status="em_andamento",
        consultor=data.consultor,
        observacoes=data.observacoes,
        data_inicio=data_inicio,
        data_prevista=sla_limite,
        sla_dias=data.sla_dias,
        sla_limite=sla_limite,
        prioridade=data.prioridade,
        certificado_path=sol.certificado_path,
        conversao_dados=data.conversao_dados,
    )
    db.add(implantacao)
    db.flush()

    # 4. Gerar etapas + checklist a partir dos templates selecionados
    from app.models.template import TemplateEtapa as _TE
    templates = db.execute(
        select(Template)
        .options(selectinload(Template.etapas).selectinload(_TE.tarefas))
        .where(Template.id.in_(data.template_ids))
    ).scalars().all()

    if templates:
        _gerar_pipeline_merged(db, implantacao, templates)

    # 5. Timeline
    modulos = ", ".join(t.nome for t in templates) if templates else "Sem template"
    timeline_service.log(
        db,
        tipo="implantacao_criada",
        titulo="Implantação iniciada",
        descricao=(
            f"Aprovado. Implantação {codigo} criada. "
            f"Módulos: {modulos}. "
            f"Consultor: {data.consultor or 'Não atribuído'}. "
            f"SLA: {data.sla_dias} dias."
        ),
        icone="rocket",
        cor="#10b981",
        implantacao_id=implantacao.id,
        solicitacao_id=sol.id,
    )

    # 6. Atualizar solicitação
    sol.status = "aprovada"
    sol.updated_at = datetime.now()
    # Se nenhum responsável foi atribuído previamente, quem aprova assume
    if not sol.responsavel_triagem_id and aprovador_id:
        sol.responsavel_triagem_id = aprovador_id

    db.commit()
    db.refresh(implantacao)

    from app.services import discord_service
    from app.models.usuario import Usuario as _Usuario
    _aprovador = db.get(_Usuario, aprovador_id) if aprovador_id else None
    discord_service.notify_triagem_aprovada(
        empresa=sol.razao_social,
        cnpj=sol.cnpj,
        codigo=codigo,
        modulos=modulos,
        consultor=data.consultor,
        aprovado_por=_aprovador.nome if _aprovador else None,
    )

    _dispatch_aprovacao_email(sol.email, sol.razao_social, codigo)
    return implantacao


def _dispatch_aprovacao_email(email: str, razao_social: str, codigo: str) -> None:
    from app.services import email_service
    from app.config import RESEND_API_KEY
    cfg = email_service.get_config()
    if not RESEND_API_KEY and (not cfg or not cfg.get("host")):
        print("[EMAIL] Nenhum provider configurado (RESEND_API_KEY ausente e SMTP sem host) — aprovação não enviada.")
        return
    email_service.send_aprovacao_email_async(email, razao_social, codigo)


def _gerar_pipeline(db: Session, implantacao: Implantacao, template: Template) -> None:
    from app.models.template import TemplateEtapa

    from app.models.template import TemplateTarefa
    etapas_template = db.execute(
        select(TemplateEtapa)
        .options(
            selectinload(TemplateEtapa.tarefas)
            .selectinload(TemplateTarefa.subitens)
        )
        .where(TemplateEtapa.template_id == template.id)
        .order_by(TemplateEtapa.ordem)
    ).scalars().all()

    for i, t_etapa in enumerate(etapas_template):
        etapa = ImplantacaoEtapa(
            implantacao_id=implantacao.id,
            template_etapa_id=t_etapa.id,
            nome=t_etapa.nome,
            ordem=t_etapa.ordem,
            cor=t_etapa.cor,
            sla_dias=t_etapa.sla_dias,
            status="em_andamento" if i == 0 else "pendente",
            data_inicio=datetime.now() if i == 0 else None,
        )
        db.add(etapa)
        db.flush()

        root_tarefas = sorted([t for t in t_etapa.tarefas if t.parent_id is None], key=lambda x: x.ordem)
        for tarefa in root_tarefas:
            item = ChecklistItem(
                implantacao_id=implantacao.id,
                etapa_id=etapa.id,
                template_tarefa_id=tarefa.id,
                titulo=tarefa.titulo,
                descricao=tarefa.descricao,
                obrigatoria=tarefa.obrigatoria,
                ordem=tarefa.ordem,
            )
            db.add(item)
            db.flush()

            for subtarefa in sorted(tarefa.subitens, key=lambda x: x.ordem):
                db.add(ChecklistItem(
                    implantacao_id=implantacao.id,
                    etapa_id=None,
                    template_tarefa_id=subtarefa.id,
                    titulo=subtarefa.titulo,
                    descricao=subtarefa.descricao,
                    obrigatoria=subtarefa.obrigatoria,
                    ordem=subtarefa.ordem,
                    parent_id=item.id,
                ))


def _gerar_pipeline_merged(db: Session, implantacao: Implantacao, templates: list) -> None:
    """1 coluna por produto/template; cards = tarefas de todas as etapas internas achatadas."""
    from app.models.template import TemplateEtapa, TemplateTarefa

    for i, template in enumerate(templates):
        etapas = db.execute(
            select(TemplateEtapa)
            .options(
                selectinload(TemplateEtapa.tarefas)
                .selectinload(TemplateTarefa.subitens)
            )
            .where(TemplateEtapa.template_id == template.id)
            .order_by(TemplateEtapa.ordem)
        ).scalars().all()

        cor = etapas[0].cor if etapas and etapas[0].cor else "#6366f1"

        etapa = ImplantacaoEtapa(
            implantacao_id=implantacao.id,
            template_etapa_id=None,
            nome=template.nome,
            ordem=i + 1,
            cor=cor,
            status="em_andamento" if i == 0 else "pendente",
            data_inicio=datetime.now() if i == 0 else None,
        )
        db.add(etapa)
        db.flush()

        ordem_item = 1
        for t_etapa in etapas:
            root_tarefas = sorted(
                [t for t in t_etapa.tarefas if t.parent_id is None],
                key=lambda x: x.ordem,
            )
            for tarefa in root_tarefas:
                item = ChecklistItem(
                    implantacao_id=implantacao.id,
                    etapa_id=etapa.id,
                    template_tarefa_id=tarefa.id,
                    titulo=tarefa.titulo,
                    descricao=tarefa.descricao,
                    obrigatoria=tarefa.obrigatoria,
                    ordem=ordem_item,
                )
                db.add(item)
                db.flush()
                ordem_item += 1

                for subtarefa in sorted(tarefa.subitens, key=lambda x: x.ordem):
                    db.add(ChecklistItem(
                        implantacao_id=implantacao.id,
                        etapa_id=None,
                        template_tarefa_id=subtarefa.id,
                        titulo=subtarefa.titulo,
                        descricao=subtarefa.descricao,
                        obrigatoria=subtarefa.obrigatoria,
                        ordem=subtarefa.ordem,
                        parent_id=item.id,
                    ))
