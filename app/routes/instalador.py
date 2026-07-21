from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.instalador_auth import get_cliente_autenticado
from app.models.cliente import Cliente
from app.services import sql_generator_service
from app.services.api_key_service import buscar_cliente_por_cnpj
from app.services import solicitacao_instalador_service as sol_service

router = APIRouter(prefix="/instalador/clientes", tags=["instalador"])
router_solicitacoes = APIRouter(prefix="/instalador/solicitacoes", tags=["instalador"])


@router.get("/{cnpj}")
def buscar_cliente(cliente: Cliente = Depends(get_cliente_autenticado)):
    return {"encontrado": True, "nome": cliente.razao_social, "cnpj": cliente.cnpj}


@router.get("/{cnpj}/gerar-base")
def gerar_base(
    ambiente: int = Query(1, ge=1, le=2, description="1=Produção, 2=Homologação"),
    cliente: Cliente = Depends(get_cliente_autenticado),
    db: Session = Depends(get_db),
):
    try:
        content = sql_generator_service.gerar_sql(cliente, db, ambiente=ambiente)
    except FileNotFoundError as e:
        raise HTTPException(500, str(e))

    return Response(content=content, media_type="text/plain; charset=utf-8")


@router.get("/{cnpj}/preview")
def preview_cliente(cnpj: str, db: Session = Depends(get_db)):
    """Sem autenticação — o CNPJ não é sensível aqui, a decisão de segurança real é a
    ligação de confirmação antes da aprovação. SEMPRE 200: essa rota nunca devolve 404
    por "não encontrado", só a ausência do endpoint em si retornaria 404."""
    cliente = buscar_cliente_por_cnpj(cnpj, db)
    if not cliente:
        return {"encontrado": False, "nome": None, "cnpj": None}
    return {"encontrado": True, "nome": cliente.razao_social, "cnpj": cliente.cnpj}


@router.post("/{cnpj}/solicitar-instalacao")
def solicitar_instalacao(cnpj: str, db: Session = Depends(get_db)):
    sol = sol_service.criar_ou_reaproveitar(cnpj, db)
    return {"solicitacaoId": str(sol.id), "expiraEm": sol_service.formatar_iso(sol.expira_em)}


@router_solicitacoes.get("/{solicitacao_id}")
def status_solicitacao(solicitacao_id: str, db: Session = Depends(get_db)):
    sol = sol_service.obter_ou_404(solicitacao_id, db)
    status = sol_service.status_efetivo(sol, db)
    return {
        "status": status,
        "apiKey": sol.api_key if status == "aprovada" else None,
        "nome": sol.nome_cliente_snapshot if status == "aprovada" else None,
    }


@router_solicitacoes.post("/{solicitacao_id}/cancelar")
def cancelar_solicitacao(solicitacao_id: str, db: Session = Depends(get_db)):
    """Sem autenticação — chamado pelo instalador quando o técnico desiste enquanto
    a solicitação ainda está pendente. Se já não estiver mais pendente (aprovada,
    recusada ou expirada), é um no-op silencioso: nunca sobrescreve uma decisão já
    tomada. Isso é o que faz a solicitação sumir do painel de pendentes."""
    sol = sol_service.obter_ou_404(solicitacao_id, db)
    sol_service.cancelar(sol, db)
    return {"ok": True}
