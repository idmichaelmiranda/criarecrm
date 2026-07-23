from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.database.connection import get_db
from app.schemas.solicitacao import (
    SolicitacaoCreate, SolicitacaoListResponse, SolicitacaoResponse,
    SolicitacaoRevisaoPublic, TriagemAprovar, TriagemRecusar, TriagemCancelar,
    AtribuirResponsavelPayload, ProdutosContratadosPayload,
)
from app.schemas.implantacao import ImplantacaoListResponse
from app.services import solicitacao_service, aprovacao_service
from app.dependencies.auth import get_current_user, require_permission
from app.models.usuario import Usuario
from app.models.solicitacao import Solicitacao

router = APIRouter(prefix="/solicitacoes", tags=["solicitacoes"])

_auth = Depends(require_permission("triagem.view"))


# ── Rotas PÚBLICAS (formulário externo + revisão pelo cliente) ────────────────

@router.post("/", response_model=SolicitacaoResponse, status_code=201)
def criar(payload: SolicitacaoCreate, db: Session = Depends(get_db)):
    return solicitacao_service.create_solicitacao(db, payload)


@router.post("/{sol_id}/certificado")
async def upload_certificado(
    sol_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    # Fix 18: impede upload em solicitações já processadas — evita sobrescrever dados reais
    # e reduz superfície de ataque do endpoint público (não requer autenticação)
    sol = db.execute(
        select(Solicitacao).where(Solicitacao.id == sol_id)
    ).scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitação não encontrada.")
    if sol.status not in ("nova", "em_triagem"):
        raise HTTPException(400, "Envio de certificado não permitido para este status.")
    path = await solicitacao_service.upload_certificado(db, sol_id, file)
    return {"certificado_path": path, "filename": file.filename}


@router.get("/revisao/{token}", response_model=SolicitacaoRevisaoPublic)
def obter_revisao(token: str, db: Session = Depends(get_db)):
    return solicitacao_service.get_by_token(db, token)


@router.put("/revisao/{token}", response_model=SolicitacaoResponse)
def submit_revisao(token: str, data: SolicitacaoCreate, db: Session = Depends(get_db)):
    return solicitacao_service.submit_revisao(db, token, data)


@router.post("/revisao/{token}/certificado")
async def upload_certificado_revisao(
    token: str, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    path = await solicitacao_service.upload_certificado_by_token(db, token, file)
    return {"certificado_path": path, "filename": file.filename}


# ── Rotas PROTEGIDAS (painel administrativo) ──────────────────────────────────

@router.get("/", response_model=list[SolicitacaoListResponse])
def listar(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = _auth,
):
    return solicitacao_service.get_all(db, status=status)


@router.get("/stats")
def stats(db: Session = Depends(get_db), _: Usuario = _auth):
    return solicitacao_service.stats(db)


@router.get("/{sol_id}", response_model=SolicitacaoResponse)
def obter(sol_id: int, db: Session = Depends(get_db), _: Usuario = _auth):
    return solicitacao_service.get_by_id(db, sol_id)


@router.post("/{sol_id}/triar", response_model=SolicitacaoResponse)
def triar(sol_id: int, db: Session = Depends(get_db), _: Usuario = _auth):
    return solicitacao_service.iniciar_triagem(db, sol_id)


@router.put("/{sol_id}", response_model=SolicitacaoResponse)
def atualizar(sol_id: int, data: SolicitacaoCreate, db: Session = Depends(get_db), _: Usuario = _auth):
    return solicitacao_service.atualizar(db, sol_id, data)


@router.post("/{sol_id}/atribuir", response_model=SolicitacaoResponse)
def atribuir_responsavel(
    sol_id: int,
    data: AtribuirResponsavelPayload,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("triagem.view")),
):
    return solicitacao_service.atribuir_responsavel(db, sol_id, data.responsavel_id, current_user.nome)


@router.put("/{sol_id}/produtos-contratados", response_model=SolicitacaoResponse)
def atualizar_produtos_contratados(
    sol_id: int, data: ProdutosContratadosPayload, db: Session = Depends(get_db), _: Usuario = _auth,
):
    return solicitacao_service.atualizar_produtos_contratados(db, sol_id, data)


@router.post("/{sol_id}/aprovar", response_model=ImplantacaoListResponse)
def aprovar(sol_id: int, data: TriagemAprovar, db: Session = Depends(get_db), current_user: Usuario = Depends(require_permission("triagem.view"))):
    try:
        impl = aprovacao_service.aprovar(db, sol_id, data, aprovador_id=current_user.id)
    except HTTPException:
        raise
    except IntegrityError as exc:
        db.rollback()
        orig = str(exc.orig)
        if "clientes.email" in orig:
            msg = (
                "O e-mail desta solicitação já está cadastrado em outro cliente. "
                "Edite a solicitação e corrija o e-mail antes de aprovar."
            )
        elif "clientes.cnpj" in orig:
            msg = "Este CNPJ já está cadastrado. Feche este modal e tente novamente — o sistema perguntará se deseja usar o cliente existente."
        else:
            msg = f"Conflito de dados ao criar implantação. Verifique os dados e tente novamente."
        raise HTTPException(409, msg) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(500, f"Erro interno ao aprovar solicitação: {exc}") from exc

    # Carrega o cliente explicitamente para evitar lazy-load após commit
    db.refresh(impl.cliente)
    impl.cliente_nome = impl.cliente.razao_social
    impl.cliente_cnpj = impl.cliente.cnpj
    return impl


@router.post("/{sol_id}/recusar", response_model=SolicitacaoResponse)
def recusar(sol_id: int, data: TriagemRecusar, db: Session = Depends(get_db), current_user: Usuario = _auth):
    return solicitacao_service.recusar(db, sol_id, data.motivo, data.campos_correcao, current_user.nome)


@router.post("/{sol_id}/cancelar", response_model=SolicitacaoResponse)
def cancelar(sol_id: int, data: TriagemCancelar, db: Session = Depends(get_db), _: Usuario = _auth):
    return solicitacao_service.cancelar(db, sol_id, data.motivo)


@router.post("/{sol_id}/reenviar-email", response_model=SolicitacaoResponse)
def reenviar_email(sol_id: int, db: Session = Depends(get_db), _: Usuario = _auth):
    return solicitacao_service.reenviar_email_correcao(db, sol_id)
