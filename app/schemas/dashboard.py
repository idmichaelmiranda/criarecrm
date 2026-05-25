from pydantic import BaseModel


class DashboardKPIs(BaseModel):
    total_solicitacoes: int
    solicitacoes_novas: int
    solicitacoes_em_triagem: int
    total_implantacoes: int
    implantacoes_em_andamento: int
    implantacoes_concluidas: int
    implantacoes_atrasadas: int
    taxa_conclusao: float
