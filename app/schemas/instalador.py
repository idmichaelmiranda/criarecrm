from typing import Literal
from pydantic import BaseModel, Field

# Payloads do contrato do CriareInstaller (instalador desktop) — o corpo chega em
# camelCase, fixo pelo lado do instalador; aceitamos por alias e trabalhamos em
# snake_case no resto do backend.


class DiscoInfo(BaseModel):
    model_config = {"populate_by_name": True}

    tipo: Literal["SSD", "HDD", "desconhecido"] | None = None
    espaco_total_gb: float | None = Field(None, alias="espacoTotalGb")
    espaco_livre_gb: float | None = Field(None, alias="espacoLivreGb")


class WindowsInfo(BaseModel):
    model_config = {"populate_by_name": True}

    versao: str | None = None
    build: str | None = None
    arquitetura: str | None = None


class MaquinaInfo(BaseModel):
    model_config = {"populate_by_name": True}

    processador: str | None = None
    nucleos: int | None = None
    memoria_ram_gb: float | None = Field(None, alias="memoriaRamGb")
    disco: DiscoInfo | None = None
    windows: WindowsInfo | None = None


class SolicitarInstalacaoPayload(BaseModel):
    """Corpo opcional do POST /instalador/clientes/{cnpj}/solicitar-instalacao —
    instaladores antigos que ainda não enviam nada continuam funcionando (default None)."""
    model_config = {"populate_by_name": True}

    maquina: MaquinaInfo | None = None


EtapaStatusType = Literal["em_andamento", "concluida", "falhou"]


class EtapaProgressoPayload(BaseModel):
    model_config = {"populate_by_name": True}

    nome: str
    total_etapas: int | None = Field(None, alias="totalEtapas")
    status: EtapaStatusType
    percentual: float | None = None
    mensagem: str | None = None
