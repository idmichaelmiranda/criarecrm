from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models.cliente import Cliente

_BASE_SQL_STORAGE = "configs/base_zerada.sql"


def _esc(val, max_len: int | None = None) -> str:
    """Escape value for MySQL single-quoted string. Returns NULL for None."""
    if val is None:
        return "NULL"
    s = str(val).strip()
    if not s:
        return "''"
    if max_len:
        s = s[:max_len]
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def _num(val, default: int = 0) -> int:
    try:
        return int(str(val).strip())
    except (TypeError, ValueError, AttributeError):
        return default


def _dec(val, default: str = "0.00") -> str:
    if val is None:
        return default
    try:
        # Normalize Brazilian decimal format (comma → dot) before parsing
        return f"{float(str(val).strip().replace(',', '.')):.2f}"
    except (TypeError, ValueError):
        return default


def _regime_int(regime_str: str | None) -> int:
    """Returns REGIME column value (1=simples, 2=presumido, 3=real)."""
    if not regime_str:
        return 0
    r = str(regime_str).strip()
    # Numeric index (current format)
    if r in ("1", "4"):  # 4 = MEI, maps to simples
        return 1
    if r == "2":
        return 2
    if r == "3":
        return 3
    # Legacy text fallback for records saved before migration
    rl = r.lower()
    if "simples" in rl or "mei" in rl:
        return 1
    if "presumido" in rl:
        return 2
    if "real" in rl:
        return 3
    return 0


def _resolve_crt(dc: dict) -> tuple[int, str, str]:
    """Returns (regime_int, crt_char, simples_federal_char) using explicit CRT when available."""
    explicit_crt = str(dc.get("crt") or "").strip()
    regime_int = _regime_int(dc.get("regime_tributario"))
    if explicit_crt in ("1", "2", "3"):
        crt = explicit_crt
    else:
        crt = "1" if regime_int == 1 else "3"
    simples = "S" if crt in ("1", "2") else "N"
    if not regime_int:
        regime_int = 1 if crt in ("1", "2") else 0
    return (regime_int, crt, simples)


def _condicao_st(val: str | None) -> str:
    """1 = Informante Substituto, 2 = Informante Substituído."""
    if not val:
        return "NULL"
    v = str(val).strip()
    if v == "1":
        return "1"
    if v == "2":
        return "2"
    return "NULL"


def _get_cert_bytes(cliente: Cliente, db: Optional[Session]) -> Optional[bytes]:
    """Baixa o certificado do storage (Supabase ou local) e retorna os bytes."""
    if not db or not cliente.solicitacao_id:
        return None
    from app.models.solicitacao import Solicitacao
    from app.services import storage_service as storage
    sol = db.get(Solicitacao, cliente.solicitacao_id)
    if not sol or not sol.certificado_path:
        return None
    sp = storage._to_storage_path(sol.certificado_path)
    return storage.download_sync(sp)


def _extract_serial(cert_bytes: bytes, password: Optional[str]) -> Optional[str]:
    try:
        from cryptography.hazmat.primitives.serialization import pkcs12
        pwd_bytes = password.encode() if password else None
        _, cert, _ = pkcs12.load_key_and_certificates(cert_bytes, pwd_bytes)
        if cert:
            return format(cert.serial_number, "X")
        return None
    except Exception:
        return None


def gerar_sql(cliente: Cliente, db: Optional[Session] = None, ambiente: int = 1) -> bytes:
    """
    ambiente: 1 = Produção, 2 = Homologação
    """
    from app.services import storage_service as storage
    base_bytes = storage.download_sync(_BASE_SQL_STORAGE)
    if base_bytes is None:
        raise FileNotFoundError("base_zerada.sql não encontrado — faça upload em Configurações")

    addr = cliente.endereco or {}
    ct = cliente.contabilidade or {}
    dc = cliente.dados_contabeis or {}
    df = cliente.dados_fiscais or {}

    regime_int, crt, simples = _resolve_crt(dc)
    fone = (cliente.telefone_fixo or cliente.telefone_celular or "")[:14]
    fone_contador = ct.get("telefone_fixo") or ct.get("telefone_celular")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    pairs: list[tuple[str, str]] = [
        ("`SIMPLES_MINAS`",    "'N'"),
        ("`NOME`",             _esc(cliente.nome_fantasia or cliente.razao_social or "", 60)),
        ("`RAZAO`",            _esc(cliente.razao_social or "", 60)),
        ("`CGC`",              _esc(cliente.cnpj or "", 18)),
        ("`INSCRICAO`",        _esc(cliente.ie or "", 15)),
        ("`FONE`",             _esc(fone, 14)),
        ("`EMAIL`",            _esc(cliente.email, 100)),
        ("`CONTATO`",          _esc(cliente.responsavel, 30)),
        ("`ENDERECO`",         _esc(addr.get("endereco") or "", 40)),
        ("`NUMERO`",           str(_num(addr.get("numero")))),
        ("`COMPLEMENTO`",      _esc(addr.get("complemento"), 60)),
        ("`BAIRRO`",           _esc(addr.get("bairro") or "", 35)),
        ("`CIDADE`",           _esc(addr.get("cidade") or "", 30)),
        ("`ESTADO`",           _esc(addr.get("estado") or "", 2)),
        ("`CEP`",              _esc(addr.get("cep") or "", 10)),
        ("`IM`",               "''"),
        ("`WEBSERVICEUF`",         _esc(addr.get("estado") or "", 2)),
        ("`UF_AUTORIZADORA_NFCE`", _esc(addr.get("estado") or "", 2)),
        ("`REGIME`",           str(regime_int)),
        ("`CRT`",              f"'{crt}'"),
        ("`SIMPLESFEDERAL`",   f"'{simples}'"),
        ("`IR`",               _dec(dc.get("imposto_renda"))),
        ("`CSSL`",             _dec(dc.get("csll"))),
        ("`CONDICAOST`",       _condicao_st(dc.get("condicao_st"))),
        ("`NOMECONTADOR`",     _esc(ct.get("nome_contador"), 50)),
        ("`CPFCONTADOR`",      _esc(ct.get("cpf"), 14)),
        ("`CRC`",              _esc(ct.get("crc"), 20)),
        ("`CNPJCONTADOR`",     _esc(ct.get("cnpj"), 18)),
        ("`CEPCONTADOR`",      _esc(ct.get("cep"), 10)),
        ("`ENDERECOCONTADOR`", _esc(ct.get("endereco"), 50)),
        ("`NUMEROCONTADOR`",   str(_num(ct.get("numero")))),
        ("`BAIRROCONTADOR`",   _esc(ct.get("bairro"), 40)),
        ("`TELEFONECONTADOR`", _esc(fone_contador, 18)),
        ("`EMAILCONTADOR`",    _esc(ct.get("email"), 100)),
        ("`ATIVO`",            "'S'"),
        ("`MATRIZ`",           "'S'"),
    ]

    serie       = df.get("serie_nfe")
    csc         = df.get("csc")
    token       = df.get("token")
    senha_cert  = df.get("senha_certificado")
    aliq_sn     = dc.get("aliq_simples")
    receita_sn  = dc.get("receita_bruta")
    if serie:
        pairs.append(("`SERIE`",             _esc(serie, 3)))
    if csc:
        pairs.append(("`TOKEN_NFCE`",        _esc(csc, 50)))
    if token:
        pairs.append(("`ID_TOKEN_NFCE`",     _esc(token, 50)))
    if senha_cert:
        pairs.append(("`SENHACERTIFICADO`",  _esc(senha_cert, 100)))
    if regime_int == 1:
        pairs.append(("`ALIQUOTA_SN`",       _dec(aliq_sn) if aliq_sn else "1.0"))
        pairs.append(("`RECEITA_BRUTA_SN`",  _dec(receita_sn) if receita_sn else "1.0"))
    if regime_int in (2, 3):
        pairs.append(("`ENQUADRADOSPED`",               "'S'"))
        pairs.append(("`ENQUADRADO_SPED_CONTRIBUICOES`", "'S'"))

    cert_bytes  = _get_cert_bytes(cliente, db)
    cert_hex    = ("0x" + cert_bytes.hex().upper()) if cert_bytes else None
    cert_serial = _extract_serial(cert_bytes, senha_cert) if cert_bytes else None
    if cert_hex:
        pairs.append(("`DADOSPFX`",           cert_hex))
    if cert_serial:
        pairs.append(("`SERIALCERTIFICADO`",  _esc(cert_serial, 100)))

    max_col = max(len(col) for col, _ in pairs)
    set_lines = [f"  {col.ljust(max_col)} = {val}" for col, val in pairs]
    set_clause = ",\n".join(set_lines)

    ambiente_label = "PRODUCAO" if ambiente == 1 else "HOMOLOGACAO"

    update_empresa_sql = (
        f"\n\n"
        f"-- ============================================================\n"
        f"-- DADOS DA EMPRESA: {cliente.razao_social}\n"
        f"-- CNPJ: {cliente.cnpj}\n"
        f"-- Ambiente: {ambiente_label}\n"
        f"-- Gerado pelo CRM CriareTI em: {now}\n"
        f"-- ============================================================\n\n"
        f"UPDATE `empresas` SET\n"
        f"{set_clause}\n"
        f"WHERE `CODIGO_N` = 1;\n"
    )

    config_cols = [
        ("`SSLLIB`",             "1"),
        ("`CRYPTLIB`",           "1"),
        ("`HTTPLIB`",            "2"),
        ("`XMLSIGNLIB`",         "4"),
        ("`SSLTYPE`",            "5"),
        ("`VERSAO_NFCE`",        "2"),
        ("`FORMA_EMISSAO_NFCE`", "2"),
        ("`MODELO_DANFE_NFCE`",  "6"),
        ("`AMBIENTE`",           str(ambiente)),
        ("`AMBIENTE_NFCE`",      str(ambiente)),
    ]
    max_cfg = max(len(c) for c, _ in config_cols)
    cfg_lines = [f"  {c.ljust(max_cfg)} = {v}" for c, v in config_cols]

    update_config_sql = (
        f"\n"
        f"-- ============================================================\n"
        f"-- CONFIGURACOES TECNICAS E AMBIENTE ({ambiente_label})\n"
        f"-- ============================================================\n\n"
        f"UPDATE `empresas` SET\n"
        + ",\n".join(cfg_lines) + "\n"
        f"WHERE `CODIGO_N` = 1;\n"
    )

    # ── Dados bancários ───────────────────────────────────────────────────────
    db_data   = cliente.dados_bancarios or {}
    db_banco  = str(db_data.get("codigo_banco") or "").strip()
    db_nome   = str(db_data.get("nome_banco")   or "").strip()
    db_ag     = str(db_data.get("agencia")      or "").strip()
    db_dv_ag  = str(db_data.get("dv_agencia")   or "").strip()
    db_ct     = str(db_data.get("conta")        or "").strip()
    db_dv_ct  = str(db_data.get("dv_conta")     or "").strip()

    banco_cols: list[tuple[str, str]] = [
        ("`METODOIMPRESSAO`",           "1"),
        ("`TIPO_LAYOUT_REMESSA_ACBR`",  "1"),
        ("`TIPO_CARTEIRA_ACBR`",        "1"),
        ("`RESPONSAVEL_EMISSAO_ACBR`",  "4"),
        ("`TIPO_COBRANCA_ACBR`",        "0"),
        ("`TIPO_INSCRICAO_ACBR`",       "2"),
        ("`CARACTERISTICA_TITULO_ACBR`","1"),
    ]
    if db_banco:
        banco_cols.append(("`BANCO`",               _esc(db_banco, 10)))
    if db_nome:
        banco_cols.append(("`NOME`",                _esc(db_nome,  60)))
    if db_ag:
        banco_cols.append(("`AGENCIA`",             _esc(db_ag,    10)))
        banco_cols.append(("`AGENCIA_ACBR`",        _esc(db_ag,    10)))
    if db_dv_ag:
        banco_cols.append(("`DIGITO_AGENCIA`",      _esc(db_dv_ag,  5)))
        banco_cols.append(("`DIGITO_AGENCIA_ACBR`", _esc(db_dv_ag,  5)))
    if db_ct:
        banco_cols.append(("`CONTA`",               _esc(db_ct,    15)))
        banco_cols.append(("`CONTA_ACBR`",          _esc(db_ct,    15)))
    if db_dv_ct:
        banco_cols.append(("`DIGITO_CONTA`",        _esc(db_dv_ct,  5)))
        banco_cols.append(("`DIGITO_CONTA_ACBR`",   _esc(db_dv_ct,  5)))

    max_bk = max(len(c) for c, _ in banco_cols)
    bk_lines = [f"  {c.ljust(max_bk)} = {v}" for c, v in banco_cols]
    update_banco_sql = (
        f"\n"
        f"-- ============================================================\n"
        f"-- DADOS BANCARIOS / CONFIGURACAO ACBr\n"
        f"-- ============================================================\n\n"
        f"UPDATE `bancos` SET\n"
        + ",\n".join(bk_lines) + "\n"
        f"WHERE `ID_EMPRESA` = 1;\n"
    )

    fp = cliente.formas_pagamento or {}
    PGTO_ID_MAP = {
        "dinheiro":        1,
        "cheque":          2,
        "cartao_pos":      3,
        "pagamento_prazo": 4,
        "pix":             5,
        "cartao_tef":      6,
    }
    selected_ids = [str(id_) for key, id_ in PGTO_ID_MAP.items() if fp.get(key)]

    update_pgto_sql = (
        f"\n"
        f"-- ============================================================\n"
        f"-- FORMAS DE PAGAMENTO\n"
        f"-- ============================================================\n\n"
        f"UPDATE `formaspgto` SET `ENVIA_PDV` = 'N';\n"
    )
    if selected_ids:
        id_list = ", ".join(selected_ids)
        update_pgto_sql += f"UPDATE `formaspgto` SET `ENVIA_PDV` = 'S' WHERE `ID` IN ({id_list});\n"

    header = b"create database bdsia;\nuse bdsia;\n\n"
    return (
        header
        + base_bytes
        + update_empresa_sql.encode("utf-8")
        + update_config_sql.encode("utf-8")
        + update_banco_sql.encode("utf-8")
        + update_pgto_sql.encode("utf-8")
    )
