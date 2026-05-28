from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database.connection import engine, Base, SessionLocal
from app.models import (  # noqa: F401 — registra todos os modelos no metadata
    Solicitacao, Cliente, Template, TemplateEtapa, TemplateTarefa,
    Implantacao, ImplantacaoEtapa, ChecklistItem, TimelineEvento, Comentario,
    GrupoPermissao, Usuario,
    Instalacao, InstalacaoChecklist, InstalacaoComentario, InstalacaoAnexo,
    Notificacao,
)
from app.routes.solicitacoes import router as solicitacoes_router
from app.routes.implantacoes import router as implantacoes_router
from app.routes.clientes import router as clientes_router
from app.routes.templates import router as templates_router
from app.routes.dashboard import router as dashboard_router
from app.routes.configuracoes import router as configuracoes_router
from app.routes.auth import router as auth_router
from app.routes.usuarios import router as usuarios_router
from app.routes.grupos_permissao import router as grupos_router
from app.routes.bd_restore import router as bd_restore_router
from app.routes.instalacoes import router as instalacoes_router
from app.routes.notificacoes import router as notificacoes_router
from app.dependencies.auth import get_current_user

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite()
    _migrate_postgres()
    db = SessionLocal()
    try:
        _seed_templates(db)
        _seed_auth(db)
        _migrate_permissions(db)
        from app.services import sla_service
        n = sla_service.recalculate(db)
        if n:
            print(f"[SLA] Startup: {n} implantacao(es) recalculadas")
    finally:
        db.close()
    from app.services import sla_service
    sla_service.start_worker()
    yield


app = FastAPI(
    title="CriareCRM",
    description="Plataforma Operacional de Implantações",
    version="2.0.0",
    lifespan=lifespan,
)

from app.config import FRONTEND_URL

_cors_origins = ["http://localhost:5173"]
if FRONTEND_URL:
    _cors_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _migrate_sqlite():
    """Adiciona colunas novas em tabelas SQLite existentes. No-op em PostgreSQL (create_all já resolve)."""
    from app.database.connection import IS_SQLITE
    if not IS_SQLITE:
        return
    from sqlalchemy import text
    new_cols = [
        "ALTER TABLE solicitacoes ADD COLUMN review_token VARCHAR(64)",
        "ALTER TABLE solicitacoes ADD COLUMN review_token_expires_at DATETIME",
        "ALTER TABLE usuarios ADD COLUMN pendente BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE usuarios ADD COLUMN access_token VARCHAR(80)",
        "ALTER TABLE usuarios ADD COLUMN access_token_expires_at DATETIME",
        "ALTER TABLE checklist_itens ADD COLUMN responsavel VARCHAR(100)",
        "ALTER TABLE checklist_itens ADD COLUMN data_prazo DATE",
        "ALTER TABLE implantacoes ADD COLUMN conversao_dados BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE template_tarefas ADD COLUMN pop_pdf_path VARCHAR(500)",
        "ALTER TABLE templates ADD COLUMN pop_pdf_path VARCHAR(500)",
        "ALTER TABLE instalacoes ADD COLUMN responsavel_id INTEGER REFERENCES usuarios(id)",
        "ALTER TABLE instalacoes ADD COLUMN iniciado_em DATETIME",
        "ALTER TABLE instalacoes ADD COLUMN finalizado_em DATETIME",
        "ALTER TABLE instalacoes ADD COLUMN duracao_minutos INTEGER",
        "ALTER TABLE instalacao_checklist ADD COLUMN nota TEXT",
        "ALTER TABLE usuarios ADD COLUMN avatar_path VARCHAR(500)",
        "ALTER TABLE instalacoes ADD COLUMN tipos_json TEXT",
        "ALTER TABLE instalacoes ADD COLUMN contato_nome VARCHAR(150)",
        "ALTER TABLE instalacoes ADD COLUMN contato_telefone VARCHAR(30)",
        "ALTER TABLE instalacoes ADD COLUMN tipos_nomes_json TEXT",
        "ALTER TABLE instalacao_checklist ADD COLUMN tipo VARCHAR(50)",
        "ALTER TABLE clientes ADD COLUMN origem VARCHAR(20) NOT NULL DEFAULT 'triagem'",
        "ALTER TABLE solicitacoes ADD COLUMN campos_correcao JSON",
        "ALTER TABLE solicitacoes ADD COLUMN historico_recusas JSON",
        "ALTER TABLE checklist_itens ADD COLUMN parent_id INTEGER REFERENCES checklist_itens(id)",
        "ALTER TABLE template_tarefas ADD COLUMN parent_id INTEGER REFERENCES template_tarefas(id)",
        "ALTER TABLE templates ADD COLUMN nome_produto VARCHAR(150)",
        "ALTER TABLE checklist_itens ADD COLUMN arquivado BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE templates ADD COLUMN checklist_template_id INTEGER REFERENCES templates(id)",
        "ALTER TABLE instalacoes ADD COLUMN criado_por_id INTEGER REFERENCES usuarios(id)",
    ]
    with engine.connect() as conn:
        for ddl in new_cols:
            try:
                conn.execute(text(ddl))
                conn.commit()
            except Exception:
                pass  # coluna já existe
        # Corrige sub-itens criados com etapa_id incorreto (devem ter etapa_id=NULL)
        try:
            conn.execute(text("UPDATE checklist_itens SET etapa_id = NULL WHERE parent_id IS NOT NULL"))
            conn.commit()
        except Exception:
            pass
        # Marca stubs gerados pelo ERP como origem='erp'
        try:
            conn.execute(text("UPDATE clientes SET origem='erp' WHERE (email LIKE 'erp_%@erp.local') AND origem='triagem'"))
            conn.commit()
        except Exception:
            pass
        # Corrige sla_limite de registros aguardando_correcao que ainda têm o SLA antigo de triagem
        try:
            conn.execute(text("""
                UPDATE solicitacoes
                SET sla_limite = review_token_expires_at
                WHERE status = 'aguardando_correcao'
                  AND review_token_expires_at IS NOT NULL
                  AND sla_limite < review_token_expires_at
            """))
            conn.commit()
        except Exception:
            pass


def _migrate_postgres() -> None:
    """Adiciona colunas novas em tabelas PostgreSQL existentes. No-op em SQLite."""
    from app.database.connection import IS_SQLITE
    if IS_SQLITE:
        return
    from sqlalchemy import text
    new_cols = [
        "ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES checklist_itens(id)",
        "ALTER TABLE instalacoes ADD COLUMN IF NOT EXISTS tipos_nomes_json TEXT",
        "ALTER TABLE template_tarefas ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES template_tarefas(id)",
        "ALTER TABLE templates ADD COLUMN IF NOT EXISTS nome_produto VARCHAR(150)",
        "ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE templates ADD COLUMN IF NOT EXISTS checklist_template_id INTEGER REFERENCES templates(id)",
        "ALTER TABLE instalacoes ADD COLUMN IF NOT EXISTS criado_por_id INTEGER REFERENCES usuarios(id)",
        """CREATE TABLE IF NOT EXISTS instalacao_anexos (
            id SERIAL PRIMARY KEY,
            instalacao_id INTEGER NOT NULL REFERENCES instalacoes(id) ON DELETE CASCADE,
            filename VARCHAR(500) NOT NULL,
            storage_path VARCHAR(1000) NOT NULL,
            content_type VARCHAR(100),
            tamanho_bytes INTEGER,
            uploaded_by VARCHAR(150),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS notificacoes (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo VARCHAR(50) NOT NULL,
            titulo VARCHAR(200) NOT NULL,
            mensagem TEXT,
            dados JSON,
            lida BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_notificacoes_usuario_id ON notificacoes (usuario_id)",
    ]
    with engine.connect() as conn:
        for ddl in new_cols:
            try:
                conn.execute(text(ddl))
                conn.commit()
            except Exception:
                pass
        # Corrige sub-itens criados com etapa_id incorreto (devem ter etapa_id=NULL)
        try:
            conn.execute(text("UPDATE checklist_itens SET etapa_id = NULL WHERE parent_id IS NOT NULL"))
            conn.commit()
        except Exception:
            pass


def _migrate_permissions(db: Session) -> None:
    """Garante que o grupo Administrador sempre tenha todas as permissões definidas em ALL_PERMISSIONS."""
    admin = db.execute(select(GrupoPermissao).where(GrupoPermissao.nome == "Administrador")).scalar_one_or_none()
    if not admin:
        return
    current = set(admin.permissoes or [])
    missing = [p for p in ALL_PERMISSIONS if p not in current]
    if missing:
        admin.permissoes = list(current | set(missing))
        db.commit()
        print(f"[OK] Permissões adicionadas ao grupo Administrador: {missing}")


import os
os.makedirs("uploads/avatars", exist_ok=True)
from app.config import SUPABASE_URL as _SUPABASE_URL
if not _SUPABASE_URL:
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")



# ── Rotas públicas (sem auth) ─────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")

# ── Rotas mistas: POST / e POST /{id}/certificado são públicas; demais exigem auth
app.include_router(solicitacoes_router, prefix="/api/v1")

# ── Rotas protegidas (exigem JWT válido) ──────────────────────────────────────
_auth_dep = [Depends(get_current_user)]
app.include_router(implantacoes_router,  prefix="/api/v1", dependencies=_auth_dep)
app.include_router(clientes_router,      prefix="/api/v1", dependencies=_auth_dep)
app.include_router(templates_router,     prefix="/api/v1", dependencies=_auth_dep)
app.include_router(dashboard_router,     prefix="/api/v1", dependencies=_auth_dep)
app.include_router(configuracoes_router, prefix="/api/v1", dependencies=_auth_dep)
app.include_router(usuarios_router,      prefix="/api/v1", dependencies=_auth_dep)
app.include_router(grupos_router,        prefix="/api/v1", dependencies=_auth_dep)
app.include_router(bd_restore_router,    prefix="/api/v1", dependencies=_auth_dep)
app.include_router(instalacoes_router,   prefix="/api/v1", dependencies=_auth_dep)
app.include_router(notificacoes_router,  prefix="/api/v1", dependencies=_auth_dep)


@app.api_route("/api/v1/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok", "version": "2.0.0"}


# ── Seeds ─────────────────────────────────────────────────────────────────────

ALL_PERMISSIONS = [
    "dashboard.view",
    "triagem.view",
    "implantacoes.view", "implantacoes.edit",
    "instalacoes.view",  "instalacoes.edit",
    "clientes.view",     "clientes.edit",
    "templates.view",    "templates.edit",
    "configuracoes.view","configuracoes.edit",
    "usuarios.view",     "usuarios.create", "usuarios.edit", "usuarios.delete",
    "grupos.view",       "grupos.create",   "grupos.edit",   "grupos.delete",
]

ANALISTA_PERMISSIONS = [
    "dashboard.view",
    "triagem.view",
    "implantacoes.view",
    "instalacoes.view",
    "clientes.view",
]


def _seed_auth(db: Session) -> None:
    from app.services.auth_service import hash_password

    if db.execute(select(func.count()).select_from(GrupoPermissao)).scalar_one() > 0:
        return

    admin_group = GrupoPermissao(
        nome="Administrador",
        descricao="Acesso total ao sistema",
        permissoes=ALL_PERMISSIONS,
        ativo=True,
    )
    analista_group = GrupoPermissao(
        nome="Analista",
        descricao="Acesso operacional — triagem, implantações e clientes",
        permissoes=ANALISTA_PERMISSIONS,
        ativo=True,
    )
    db.add(admin_group)
    db.add(analista_group)
    db.flush()

    admin_user = Usuario(
        nome="Administrador",
        email="admin@criare.com.br",
        senha_hash=hash_password("admin123"),
        grupo_id=admin_group.id,
        ativo=True,
    )
    db.add(admin_user)
    db.commit()
    print("[OK] Auth seed: grupos 'Administrador' e 'Analista' + usuário admin@criare.com.br criados")


def _seed_templates(db: Session) -> None:
    count = db.execute(select(func.count()).select_from(Template)).scalar_one()
    if count > 0:
        return

    template = Template(
        nome="ERP Varejo",
        descricao="Template padrão para implantação de ERP no varejo",
        tipo="erp",
        sla_total_dias=30,
        ativo=True,
    )
    db.add(template)
    db.flush()

    etapas = [
        ("Infraestrutura",    1, 2, "#3b82f6", [
            "Criar banco de dados no servidor",
            "Configurar ambiente de produção",
            "Liberar acessos e portas de rede",
        ]),
        ("Configuração",      2, 3, "#8b5cf6", [
            "Configurar dados da empresa",
            "Configurar regime tributário",
            "Importar certificado digital",
            "Configurar CSC e Token NFC-e",
            "Configurar módulos do sistema",
        ]),
        ("Migração de Dados", 3, 5, "#f59e0b", [
            "Receber base de dados atual",
            "Executar script de migração",
            "Validar integridade dos dados",
        ]),
        ("Treinamento",       4, 3, "#ec4899", [
            "Treinamento — frente de caixa",
            "Treinamento — módulo fiscal",
            "Treinamento — relatórios gerenciais",
            "Entrega de manual do usuário",
        ]),
        ("Homologação",       5, 2, "#06b6d4", [
            "Emitir NF-e de teste",
            "Emitir NFC-e de teste",
            "Validar TEF e meios de pagamento",
            "Aprovação formal pelo cliente",
        ]),
        ("Go Live",           6, 1, "#10b981", [
            "Virada para ambiente de produção",
            "Acompanhamento hora 1",
            "Validação final com cliente",
        ]),
        ("Pós-implantação",   7, 7, "#6366f1", [
            "Acompanhamento semana 1",
            "Resolução de pendências",
            "Feedback formal do cliente",
            "Encerramento e arquivamento",
        ]),
    ]

    for nome, ordem, sla_dias, cor, tarefas in etapas:
        etapa = TemplateEtapa(
            template_id=template.id,
            nome=nome,
            ordem=ordem,
            sla_dias=sla_dias,
            cor=cor,
        )
        db.add(etapa)
        db.flush()
        for i, titulo in enumerate(tarefas, 1):
            db.add(TemplateTarefa(etapa_id=etapa.id, titulo=titulo, obrigatoria=True, ordem=i))

    db.commit()
    print("[OK] Template 'ERP Varejo' criado com 7 etapas e 25 tarefas")


