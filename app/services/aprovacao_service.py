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


def aprovar(db: Session, solicitacao_id: int, data: TriagemAprovar) -> Implantacao:
    sol = db.get(Solicitacao, solicitacao_id)
    if not sol or sol.status not in ["nova", "em_triagem"]:
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
        template_id=data.template_id,
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

    # 4. Gerar etapas + checklist a partir do template
    template = db.execute(
        select(Template)
        .options(selectinload(Template.etapas).selectinload(
            __import__("app.models.template", fromlist=["TemplateEtapa"]).TemplateEtapa.tarefas
        ))
        .where(Template.id == data.template_id)
    ).scalar_one_or_none()

    if template:
        _gerar_pipeline(db, implantacao, template)

    # 5. Timeline
    template_nome = template.nome if template else "Sem template"
    timeline_service.log(
        db,
        tipo="implantacao_criada",
        titulo="Implantação iniciada",
        descricao=(
            f"Aprovado. Implantação {codigo} criada. "
            f"Template: {template_nome}. "
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

    db.commit()
    db.refresh(implantacao)
    _dispatch_aprovacao_email(sol.email, sol.razao_social, codigo)
    return implantacao


def _dispatch_aprovacao_email(email: str, razao_social: str, codigo: str) -> None:
    from app.services import email_service
    cfg = email_service.get_config()
    if not cfg or not cfg.get("host"):
        print("[EMAIL] Config de email não encontrada — email não enviado.")
        return
    email_service.send_aprovacao_email_async(email, razao_social, codigo)


def _gerar_pipeline(db: Session, implantacao: Implantacao, template: Template) -> None:
    from app.models.template import TemplateEtapa

    etapas_template = db.execute(
        select(TemplateEtapa)
        .options(selectinload(TemplateEtapa.tarefas))
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

        for tarefa in sorted(t_etapa.tarefas, key=lambda x: x.ordem):
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
