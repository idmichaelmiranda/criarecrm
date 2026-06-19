import os
import tempfile
import uuid
from datetime import datetime, timedelta, date, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.models.usuario import Usuario
from app.dependencies.auth import require_permission

router = APIRouter(prefix="/bd-restore", tags=["BD Restore"])

_BASE_SQL_STORAGE = "configs/base_zerada.sql"

# Tabelas Firebird → chave de resposta (Passo 2)
TABELAS = {
    "empresas":            "EMPRESAS",
    "produto":             "PRODUTO",
    "clientes":            "CLIENTES",
    "perfilclientes":      "PERFILCLIENTES",
    "admcartao":           "ADMCARTAO",
    "aliquotas":           "ALIQUOTAS",
    "certificado_digital": "CERTIFICADO_DIGITAL",
    "formaspagamento":     "FORMASPAGAMENTO",
}

_PRODUTO_PK_CANDIDATES = [
    "IDPRODUTO", "ID_PRODUTO", "CODPRODUTO", "COD_PRODUTO", "ID", "CODIGO",
]

# Cache de sessão em memória — TTL de 2 horas
_sessions: dict[str, dict] = {}
_SESSION_TTL = timedelta(hours=2)

# ── Mapeamentos de campos ─────────────────────────────────────────────────────

# Campos de EMPRESAS: mapeamento direto (mesmo nome Firebird ↔ MySQL)
_EMPRESAS_DIRECT_FIELDS = [
    "NOME", "ENDERECO", "CIDADE", "ESTADO", "CEP", "FONE",
    "CGC", "INSCRICAO", "BAIRRO", "RAZAO", "CONTATO",
    "REGIME", "CONDICAOST", "CRT", "NUMERO",
    # ID_CIDADE não entra aqui — o valor Firebird é PK interna do PAF e não
    # corresponde aos IDs da tabela cidades da base zerada MySQL.
    # Resolvido via subquery por nome+UF no bloco de geração (ver gerar endpoint).
    "MENSAGEM_EMAIL_NFCE", "HOSTSMTP", "PORTASMTP",
    "USUARIOSMTP", "SENHASMTP", "EMAIL", "ASSUNTOEMAIL",
    "SMTPSEGURO", "EMAILCONTADOR", "CPFCONTADOR", "CNPJCONTADOR",
    "CONTADORABREXML", "CALC_IMP_MEDIO_SIMPLIFICADO_SN",
    "ALIQ_MEDIA_ST_SN", "ALIQUOTA_SN", "RAMO",
]

# CERTIFICADO_DIGITAL Firebird → EMPRESAS MySQL (campos com renomeação)
_CERT_FIELD_MAP = {
    "NUMERO_SERIE": "SERIALCERTIFICADO",
    "SENHA":        "SENHACERTIFICADO",
    "WEBSERVICEUF": "WEBSERVICEUF",
    "TOKEN":        "TOKEN_NFCE",
    "ID_TOKEN":     "ID_TOKEN_NFCE",
}

# 55 colunas de CLIENTES_CONV (Firebird) → clientes (MySQL) — mapeamento direto
# Tabela fonte no Firebird: CLIENTES_CONV (fallback: CLIENTES)
_CLIENTES_COLS = [
    "CODIGOCLI", "NOMECLI", "ENDERCLI", "BAIRROCLI", "CIDADECLI", "ESTADOCLI",
    "CEPCLI", "FONECLI", "FAXCLI", "NOMEPAI", "NOMEMAE", "INSCMUNI", "LOCTRAB",
    "DTNASCIMENTO", "OBSERVACAO", "CPFCGC", "IDENINSC", "CARGO", "EMAIL", "ULTCOMPRA",
    "CONJUGE", "REFEREN", "RENDA_TITULAR", "RENDA_DEPENDENTES", "RENDA_FAMILIAR",
    "RENDA_OUTRAS", "MORADA", "ALUGUEL", "BANCO", "CONTA", "AGENCIA", "ESPECIAL",
    "ESPECIAL_LIMITE", "CRT_VISA", "CRT_MASTERCARD", "CRT_AMEX", "CRT_CREDICARD",
    "CRT_REDE", "CRT_OUTRO", "ATIVO", "TIPO", "RAZAO", "CONVENIADO", "LIMITE_CONVENIO",
    "CADASTRADO", "VENCIMENTO",
    "ID_PERFIL", "CONTROLA_LIMITE", "LIMITE_CREDITO",
    "ID_CIDADE", "NUMERO", "CLIENTEESPECIAL",
    "DATA_LIMITE_SEM_APROV_PDV", "SENHA_LIBERACAO_VENDA", "HABILITAR_LIBERACAO_POR_SENHA",
]

_CLIENTES_INSERT_BATCH = 500  # linhas por bloco INSERT

# ── Mapeamento PRODUTO ────────────────────────────────────────────────────────
# _PRODUTO_MYSQL_COLS[i]  → coluna destino  (tabela produto   MySQL)
# _PRODUTO_FB_COLS[i]     → coluna origem   (tabela produto_conv Firebird)
# Única diferença de nome: balanca (MySQL) ← pesavel (Firebird)
#                          coditem (MySQL) ← id_produto (Firebird)
_PRODUTO_MYSQL_COLS = [
    "coditem", "codbarra", "grupo", "abrevia", "unitario", "unidade", "aliquotasaida",
    "promocao", "cesta", "custo", "descricao", "validade_promocao",
    "balanca", "iniciopromocao", "permitir_multiplo", "IAT", "ippt",
    "unitarioatacado", "precorevenda", "NCM",
    "PERMITE_fracionar_venda", "indicador_escala", "possui_vasilhame",
    "id_vasilhame", "part_campanha_benef", "tratamento_vasilhame",
    "qtd_vasilhames", "descricao_anp", "PGLP", "pgnn", "pgni", "vpart",
    "un_tributavel", "fator_un_trib", "rastreabilidade", "vpmc",
    "possui_tonalidade", "dado_add_obr", "conferencia_peso",
    "familia", "categoria",
]

# Valores fixos para colunas de produto sem equivalente no Firebird
_PRODUTO_FIXED_VALUES = {
    "familia":   "1",
    "categoria": "1",
}

_PRODUTO_FB_COLS = [
    "id_produto", "codbarra", "grupo", "abrevia", "unitario", "unidade", "aliquotasaida",
    "promocao", "cesta", "custo", "descricao", "validade_promocao",
    "pesavel", "iniciopromocao", "permitir_multiplo", "IAT", "ippt",
    "unitarioatacado", "precorevenda", "NCM",
    "PERMITE_fracionar_venda", "indicador_escala", "possui_vasilhame",
    "id_vasilhame", "part_campanha_benef", "tratamento_vasilhame",
    "qtd_vasilhames", "descricao_anp", "PGLP", "pgnn", "pgni", "vpart",
    "un_tributavel", "fator_un_trib", "rastreabilidade", "vpmc",
    "possui_tonalidade", "dado_add_obr", "conferencia_peso",
]

_PRODUTO_INSERT_BATCH = 500


# ── Utilitários internos ──────────────────────────────────────────────────────

def _cleanup_sessions() -> None:
    cutoff = datetime.utcnow() - _SESSION_TTL
    expired = [k for k, v in _sessions.items() if v["created_at"] < cutoff]
    for k in expired:
        # Apaga o arquivo temporario do banco Firebird se ainda existir
        tmp = _sessions[k].get("tmp_path")
        if tmp:
            try:
                os.unlink(tmp)
            except OSError:
                pass
        del _sessions[k]


def _contar_registros(cursor, tabela: str) -> int | None:
    for sql in (f'SELECT COUNT(*) FROM "{tabela}"', f"SELECT COUNT(*) FROM {tabela}"):
        try:
            cursor.execute(sql)
            return cursor.fetchone()[0]
        except Exception:
            continue
    return None


def _contar_distintos_produto(cursor, con=None) -> int | None:
    for col in _PRODUTO_PK_CANDIDATES:
        for sql in (
            f'SELECT COUNT(DISTINCT "{col}") FROM "PRODUTO"',
            f"SELECT COUNT(DISTINCT {col}) FROM PRODUTO",
        ):
            try:
                cursor.execute(sql)
                return cursor.fetchone()[0]
            except Exception:
                # Rollback apos falha — queries com coluna inexistente deixam
                # a transacao Firebird em estado que bloqueia proximas queries
                if con is not None:
                    try:
                        con.rollback()
                    except Exception:
                        pass
                continue
    return None


def _read_blob(val):
    """Lê BlobReader do fdb imediatamente enquanto a conexão está aberta."""
    if hasattr(val, "read"):
        try:
            return val.read()
        except Exception:
            return None
    return val


def _build_cols_no_blob(description, wanted_upper: list[str]) -> tuple[str, list[str]]:
    """Monta a lista de colunas para SELECT evitando leitura lazy de BLOBs.
    - BLOB texto (internal_size==0 e tipo STRING): CAST AS VARCHAR(500)
    - BLOB binario (internal_size==0 e tipo BINARY): NULL — CAST falharia no Firebird
    - Coluna normal: seleciona diretamente
    Retorna (cols_sql, col_names_upper)."""
    try:
        import firebirdsql as _fb_mod
        _binary_type = _fb_mod.BINARY
    except Exception:
        _binary_type = None

    avail: dict[str, tuple] = {d[0].upper(): d for d in description}
    parts: list[str] = []
    names: list[str] = []
    for c in wanted_upper:
        if c not in avail:
            continue
        d = avail[c]
        internal_size = d[3]
        is_blob = (internal_size is None or internal_size == 0)
        if is_blob:
            if _binary_type is not None and d[1] is _binary_type:
                parts.append("NULL")          # BLOB binario — sem cast possivel
            else:
                parts.append(f'CAST("{c}" AS VARCHAR(500))')  # BLOB texto
        else:
            parts.append(f'"{c}"')
        names.append(c)
    return ", ".join(parts), names


def _fetch_row(cursor, tabela: str) -> dict:
    """Primeira linha de uma tabela como dict com chaves em MAIÚSCULAS."""
    for sql in (f'SELECT * FROM "{tabela}"', f"SELECT * FROM {tabela}"):
        try:
            cursor.execute(sql)
            desc = cursor.description
            row = cursor.fetchone()
            if not row:
                return {}
            return {desc[i][0].upper(): _read_blob(row[i]) for i in range(len(desc))}
        except Exception:
            continue
    return {}


def _fetch_all_generic(cursor, tabela: str) -> tuple[list[str], list[dict]]:
    """Lê todas as linhas de uma tabela via SELECT *.
    Retorna (lista_de_colunas_upper, lista_de_dicts).
    Usado para tabelas com mapeamento direto (mesmo nome Firebird ↔ MySQL)."""
    for sql in (f'SELECT * FROM "{tabela}"', f"SELECT * FROM {tabela}"):
        try:
            cursor.execute(sql)
            desc = cursor.description
            col_names = [d[0].upper() for d in desc]
            rows: list[dict] = []
            for raw_row in cursor.fetchall():
                rows.append({
                    col_names[i]: _read_blob(raw_row[i])
                    for i in range(len(col_names))
                })
            return col_names, rows
        except Exception:
            continue
    return [], []


def _fetch_produto(cursor) -> list[dict]:
    """Lê produto_conv (fallback: produto) do PAF Firebird.
    Seleciona SOMENTE as colunas necessarias para evitar transferir BLOBs grandes
    (IMAGEM, FOTO, etc.) que nao sao usados na geracao SQL.
    Deduplica por id_produto em Python — multiplos codigos de barras por produto.
    nome_grupo e capturado aqui e usado depois para popular a tabela grupo."""
    _needed_upper = {c.upper() for c in _PRODUTO_FB_COLS} | {"NOME_GRUPO"}

    for tabela in ("produto_conv", "PRODUTO_CONV", "produto", "PRODUTO"):
        for tbl in (f'"{tabela}"', tabela):
            try:
                # Descobre colunas disponiveis sem transferir dados (FIRST 0)
                cursor.execute(f"SELECT FIRST 0 * FROM {tbl}")
                avail = {d[0].upper() for d in cursor.description}
                # Usa UPPERCASE no SELECT — Firebird trata identificadores entre aspas
                # como case-sensitive; as colunas reais estao em maiúsculas.
                sel = [c.upper() for c in (_PRODUTO_FB_COLS + ["NOME_GRUPO"]) if c.upper() in avail]
                if not sel:
                    sel = sorted(avail)

                cols_sql = ", ".join(f'"{c}"' for c in sel)
                cursor.execute(f"SELECT {cols_sql} FROM {tbl}")
                desc = cursor.description
                col_names = [d[0].upper() for d in desc]
                seen_ids: set = set()
                rows: list[dict] = []
                for raw_row in cursor.fetchall():
                    row = {col_names[i]: _read_blob(raw_row[i]) for i in range(len(col_names))}
                    pid = row.get("ID_PRODUTO")
                    if pid not in seen_ids:
                        seen_ids.add(pid)
                        rows.append(row)
                return rows
            except Exception:
                continue
    return []


def _fetch_clientes(cursor) -> list[dict]:
    """Todas as linhas de CLIENTES com as colunas de _CLIENTES_COLS.
    Requer conexão aberta com charset=NONE (bytes brutos) para tolerar bancos PAF
    com bytes inválidos em WIN1252 (ex.: 0x81 que o cp1252 não aceita).
    Converte bytes→str via _decode_str (UTF-8 → CP1252 → latin-1 fallback)."""
    wanted_upper = {c.upper() for c in _CLIENTES_COLS}

    for tbl in ('"CLIENTES"', "CLIENTES"):
        try:
            cursor.execute(f"SELECT * FROM {tbl}")
            desc = cursor.description
            idx_map = [
                (i, d[0].upper())
                for i, d in enumerate(desc)
                if d[0].upper() in wanted_upper
            ]
            if not idx_map:
                print(f"[BD-RESTORE] _fetch_clientes {tbl}: nenhuma coluna mapeada")
                continue
            print(f"[BD-RESTORE] _fetch_clientes {tbl}: {len(desc)} colunas totais, {len(idx_map)} mapeadas")
            rows: list[dict] = []
            cursor.arraysize = 200
            while True:
                batch = cursor.fetchmany(200)
                if not batch:
                    break
                for raw_row in batch:
                    row: dict = {}
                    for i, col in idx_map:
                        v = _read_blob(raw_row[i])
                        # charset=NONE retorna bytes para VARCHAR/CHAR/BLOB texto.
                        # _decode_str converte com fallback latin-1 (aceita 0x00-0xFF).
                        if isinstance(v, (bytes, bytearray)):
                            v = _decode_str(v)
                        row[col] = v
                    rows.append(row)
            print(f"[BD-RESTORE] _fetch_clientes: {len(rows)} clientes carregados")
            return rows
        except Exception as e:
            import traceback as _tb
            print(f"[BD-RESTORE] _fetch_clientes erro em {tbl}: {e}")
            print(_tb.format_exc())
            continue
    return []


# ── Helpers SQL (padrão MySQL — mesmo modelo do sql_generator_service) ────────

def _decode_str(val) -> str:
    """Converte valor do Firebird para str Python preservando acentos.
    fdb pode retornar CHAR/VARCHAR como bytes (ex.: WIN1252 ou UTF-8 raw).
    Tenta UTF-8 → CP1252 → latin-1 antes de fazer str() forçado."""
    if isinstance(val, (bytes, bytearray)):
        raw = bytes(val)
        for enc in ("utf-8", "cp1252", "latin-1"):
            try:
                return raw.decode(enc)
            except (UnicodeDecodeError, ValueError):
                continue
        return raw.decode("latin-1", errors="replace")
    return str(val)


def _esc(val, max_len: int | None = None) -> str:
    """Valor como string MySQL single-quoted. Retorna NULL se vazio."""
    if val is None:
        return "NULL"
    s = _decode_str(val).strip()
    if not s:
        return "NULL"
    if max_len:
        s = s[:max_len]
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def _blob_hex(val) -> str | None:
    """Bytes → literal hexadecimal MySQL (0xABCD...)."""
    if isinstance(val, (bytes, bytearray)) and val:
        return "0x" + bytes(val).hex().upper()
    return None


def _extract_serial_from_pfx(pfx_bytes: bytes, password: str | None) -> str | None:
    """Extrai o número de série do certificado PFX usando a lib cryptography.
    Retorna o serial em hex maiúsculo — mesmo formato do sql_generator_service."""
    try:
        from cryptography.hazmat.primitives.serialization import pkcs12
        pwd_bytes = password.encode() if password else None
        _, cert, _ = pkcs12.load_key_and_certificates(pfx_bytes, pwd_bytes)
        if cert:
            return format(cert.serial_number, "X")
        return None
    except Exception:
        return None


def _val_insert(val) -> str:
    """Formata um valor Python para uso em VALUES de um INSERT MySQL."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "1" if val else "0"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, datetime):
        return f"'{val.strftime('%Y-%m-%d %H:%M:%S')}'"
    if isinstance(val, date):
        return f"'{val.strftime('%Y-%m-%d')}'"
    if isinstance(val, (bytes, bytearray)):
        hex_val = _blob_hex(val)
        return hex_val if hex_val else "NULL"
    # String genérica — escapa aspas simples e barras
    s = str(val)
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def _sql_block(title: str, pairs: list[tuple[str, str]], table: str, where: str) -> str:
    """Bloco UPDATE formatado."""
    if not pairs:
        return f"\n-- {title}: nenhum campo com valor encontrado.\n"
    max_col = max(len(c) for c, _ in pairs)
    lines = [f"  {c.ljust(max_col)} = {v}" for c, v in pairs]
    return (
        f"\n\n"
        f"-- ============================================================\n"
        f"-- {title}\n"
        f"-- ============================================================\n\n"
        f"UPDATE `{table}` SET\n"
        + ",\n".join(lines) + "\n"
        f"WHERE {where};\n"
    )


def _gerar_clientes_sql(rows: list[dict], valid_perfil_ids: set | None = None) -> str:
    """DELETE + INSERT em lotes para a tabela clientes.
    valid_perfil_ids: conjunto de ID_PERFIL presentes em perfilclientes.
    Clientes com ID_PERFIL órfão (não encontrado em perfilclientes) têm o campo
    definido como NULL para evitar violação da FK FK_Clientes_1."""
    if not rows:
        return (
            "\n\n"
            "-- ============================================================\n"
            "-- CLIENTES — nenhum registro encontrado na tabela CLIENTES do PAF\n"
            "-- ============================================================\n"
        )

    col_list = ", ".join(f"`{c.lower()}`" for c in _CLIENTES_COLS)

    # Conta e lista IDs órfãos para o comentário diagnóstico no SQL
    orphaned: set = set()
    if valid_perfil_ids is not None:
        for row in rows:
            pid = row.get("ID_PERFIL")
            if pid is not None and pid not in valid_perfil_ids:
                orphaned.add(pid)

    orphan_comment = ""
    if orphaned:
        ids_str = ", ".join(str(x) for x in sorted(orphaned))
        orphan_comment = (
            f"-- AVISO: {len(orphaned)} ID_PERFIL sem correspondente em perfilclientes "
            f"foram definidos como NULL: [{ids_str}]\n"
        )

    parts = [
        "\n\n",
        "-- ============================================================\n",
        f"-- CLIENTES — {len(rows)} registros migrados da tabela CLIENTES do PAF\n",
        "-- ============================================================\n\n",
        orphan_comment,
        "-- Remove clientes padrão da base zerada antes de inserir os do PAF\n",
        "DELETE FROM `clientes`;\n\n",
    ]

    for start in range(0, len(rows), _CLIENTES_INSERT_BATCH):
        batch = rows[start : start + _CLIENTES_INSERT_BATCH]
        val_tuples = []
        for row in batch:
            row_vals = []
            for col in _CLIENTES_COLS:
                if col == "ID_PERFIL" and valid_perfil_ids is not None:
                    pid = row.get("ID_PERFIL")
                    row_vals.append("NULL" if (pid is not None and pid not in valid_perfil_ids) else _val_insert(pid))
                else:
                    row_vals.append(_val_insert(row.get(col)))
            val_tuples.append("  (" + ", ".join(row_vals) + ")")
        parts.append(
            f"INSERT INTO `clientes` ({col_list}) VALUES\n"
            + ",\n".join(val_tuples)
            + ";\n\n"
        )

    parts.append("UPDATE `clientes` SET `id_pais` = 1058;\n")
    parts.append(
        "UPDATE `clientes` SET `pessoa` = 'F' "
        "WHERE LENGTH(REPLACE(REPLACE(REPLACE(`cpfcgc`, '.', ''), '-', ''), '/', '')) = 11;\n"
    )
    parts.append(
        "UPDATE `clientes` SET `pessoa` = 'J' "
        "WHERE LENGTH(REPLACE(REPLACE(REPLACE(`cpfcgc`, '.', ''), '-', ''), '/', '')) = 14;\n"
    )

    return "".join(parts)


def _fetch_grupos_para_sql(cursor) -> str:
    """Busca pares (GRUPO, NOME_GRUPO) distintos com SELECT DISTINCT — 2 colunas, rapido.
    Retorna o bloco SQL DELETE+INSERT pronto para ser enviado ao cliente."""
    for tabela in ("produto_conv", "PRODUTO_CONV", "produto", "PRODUTO"):
        for tbl in (f'"{tabela}"', tabela):
            for cols in ('"GRUPO", "NOME_GRUPO"', "GRUPO, NOME_GRUPO"):
                try:
                    cursor.execute(f"SELECT DISTINCT {cols} FROM {tbl}")
                except Exception:
                    continue
                try:
                    grupos_map: dict = {}
                    for row in cursor.fetchall():
                        g, ng = row[0], _read_blob(row[1])
                        if g is None:
                            continue
                        if g not in grupos_map or grupos_map[g] is None:
                            grupos_map[g] = ng
                    if not grupos_map:
                        return (
                            "\n\n-- ============================================================\n"
                            "-- GRUPO — nenhum registro encontrado no PAF\n"
                            "-- ============================================================\n"
                        )
                    grupos = sorted(grupos_map.items(), key=lambda x: (x[0] is None, x[0]))
                    val_lines = [f"  ({_val_insert(g)}, {_esc(ng)})" for g, ng in grupos]
                    return (
                        "\n\n-- ============================================================\n"
                        f"-- GRUPO — {len(grupos)} grupos migrados do PAF\n"
                        "-- ============================================================\n\n"
                        "DELETE FROM `grupo`;\n\n"
                        "INSERT INTO `grupo` (`codgrupo`, `nomegrupo`) VALUES\n"
                        + ",\n".join(val_lines) + ";\n"
                    )
                except Exception:
                    continue
    return (
        "\n\n-- ============================================================\n"
        "-- GRUPO — tabela nao encontrada no PAF\n"
        "-- ============================================================\n"
    )


def _stream_produto_cursor(cursor):
    """Sync generator: le produtos em batches via fetchmany e gera INSERT SQL.
    Cada batch e enviado ao cliente assim que pronto — sem acumular tudo em memoria."""
    col_list_mysql = ", ".join(f"`{c.lower()}`" for c in _PRODUTO_MYSQL_COLS)
    _fb_cols_upper = [c.upper() for c in _PRODUTO_FB_COLS]

    for tabela in ("produto_conv", "PRODUTO_CONV", "produto", "PRODUTO"):
        for tbl in (f'"{tabela}"', tabela):
            try:
                cursor.execute(f"SELECT FIRST 0 * FROM {tbl}")
                avail_upper = {d[0].upper() for d in cursor.description}
                wanted = [c for c in _fb_cols_upper if c in avail_upper]
                if not wanted:
                    continue
                # CAST em BLOBs: evita round-trip TCP por linha para leitura lazy
                cols_sql, col_names = _build_cols_no_blob(cursor.description, wanted)
                cursor.execute(f"SELECT {cols_sql} FROM {tbl}")
                # arraysize maior = menos round-trips de prefetch com firebirdsql
                cursor.arraysize = 5000

                yield (
                    "\n\n-- ============================================================\n"
                    "-- PRODUTO\n"
                    "-- ============================================================\n\n"
                    "DELETE FROM `produto`;\n\n"
                ).encode("utf-8")

                seen_ids: set = set()
                total = 0

                while True:
                    raw_rows = cursor.fetchmany(5000)
                    if not raw_rows:
                        break
                    batch: list[dict] = []
                    for raw_row in raw_rows:
                        row = {col_names[i]: _read_blob(raw_row[i]) for i in range(len(col_names))}
                        pid = row.get("ID_PRODUTO")
                        if pid in seen_ids:
                            continue
                        seen_ids.add(pid)
                        batch.append(row)
                    if batch:
                        val_tuples = []
                        for row in batch:
                            vals = [_val_insert(row.get(c)) for c in _fb_cols_upper]
                            for mysql_col in _PRODUTO_MYSQL_COLS[len(_PRODUTO_FB_COLS):]:
                                vals.append(_PRODUTO_FIXED_VALUES[mysql_col])
                            val_tuples.append("  (" + ", ".join(vals) + ")")
                        total += len(batch)
                        yield (
                            f"INSERT INTO `produto` ({col_list_mysql}) VALUES\n"
                            + ",\n".join(val_tuples) + ";\n\n"
                        ).encode("utf-8")

                yield (
                    f"-- {total} produtos unicos inseridos\n"
                    "UPDATE `produto` SET `empresas_participantes` = ';1;';\n"
                ).encode("utf-8")
                return

            except Exception:
                continue

    yield b"\n-- PRODUTO: nenhum registro encontrado no PAF\n"


def _gerar_grupos_sql(produto_rows: list[dict]) -> str:
    """DELETE + INSERT na tabela grupos a partir dos pares únicos (grupo, nome_grupo)
    extraídos das linhas de produto já buscadas do Firebird."""
    # Agrupa por codgrupo — quando o mesmo id aparece com e sem nome, mantém o que tem nome
    grupos_map: dict = {}
    for row in produto_rows:
        g  = row.get("GRUPO")
        ng = row.get("NOME_GRUPO")
        if g is None:
            continue
        if g not in grupos_map or grupos_map[g] is None:
            grupos_map[g] = ng  # sobrescreve null por nome real quando aparecer

    grupos = sorted(grupos_map.items(), key=lambda x: (x[0] is None, x[0]))

    if not grupos:
        return (
            "\n\n"
            "-- ============================================================\n"
            "-- GRUPO — nenhum registro encontrado no PAF\n"
            "-- ============================================================\n"
        )

    val_lines = [f"  ({_val_insert(g)}, {_esc(ng)})" for g, ng in grupos]

    return (
        "\n\n"
        "-- ============================================================\n"
        f"-- GRUPO — {len(grupos)} grupos migrados do PAF\n"
        "-- ============================================================\n\n"
        "DELETE FROM `grupo`;\n\n"
        "INSERT INTO `grupo` (`codgrupo`, `nomegrupo`) VALUES\n"
        + ",\n".join(val_lines)
        + ";\n"
    )


def _gerar_produto_sql(rows: list[dict]) -> str:
    """DELETE + INSERT em lotes para a tabela produto.
    Cada linha já está deduplicada por id_produto (_fetch_produto cuida disso).
    Colunas renomeadas: id_produto → coditem, pesavel → balanca."""
    if not rows:
        return (
            "\n\n"
            "-- ============================================================\n"
            "-- PRODUTO — nenhum registro encontrado no PAF\n"
            "-- ============================================================\n"
        )

    col_list = ", ".join(f"`{c.lower()}`" for c in _PRODUTO_MYSQL_COLS)

    parts = [
        "\n\n",
        "-- ============================================================\n",
        f"-- PRODUTO — {len(rows)} produtos únicos migrados do PAF\n",
        "-- ============================================================\n\n",
        "DELETE FROM `produto`;\n\n",
    ]

    for start in range(0, len(rows), _PRODUTO_INSERT_BATCH):
        batch = rows[start : start + _PRODUTO_INSERT_BATCH]
        val_tuples = []
        for row in batch:
            vals = [_val_insert(row.get(fb_col.upper())) for fb_col in _PRODUTO_FB_COLS]
            # Colunas com valor fixo (sem equivalente no Firebird)
            for mysql_col in _PRODUTO_MYSQL_COLS[len(_PRODUTO_FB_COLS):]:
                vals.append(_PRODUTO_FIXED_VALUES[mysql_col])
            val_tuples.append("  (" + ", ".join(vals) + ")")
        parts.append(
            f"INSERT INTO `produto` ({col_list}) VALUES\n"
            + ",\n".join(val_tuples)
            + ";\n\n"
        )

    parts.append("UPDATE `produto` SET `empresas_participantes` = ';1;';\n")

    return "".join(parts)


def _gerar_insert_generico(
    col_names: list[str],
    rows: list[dict],
    mysql_table: str,
    batch_size: int = 500,
    overrides: dict | None = None,
) -> str:
    """DELETE + INSERT em lotes para tabelas com mapeamento direto (mesmo nome de campo).
    overrides: dict de {COLUNA_UPPER: valor_sql_literal} — substitui o valor da linha para
    colunas específicas (ex.: forçar ID_EMPRESA = codigo_n do PAF em PERFILCLIENTES).
    Usado por PERFILCLIENTES e outras tabelas de mapeamento 1:1."""
    label = mysql_table.upper()
    if not rows:
        return (
            f"\n\n"
            f"-- ============================================================\n"
            f"-- {label} — nenhum registro encontrado no PAF\n"
            f"-- ============================================================\n"
        )

    col_list = ", ".join(f"`{c.lower()}`" for c in col_names)
    tbl = mysql_table.lower()
    _overrides = {k.upper(): v for k, v in (overrides or {}).items()}

    parts = [
        f"\n\n",
        f"-- ============================================================\n",
        f"-- {label} — {len(rows)} registros migrados do PAF\n",
        f"-- ============================================================\n\n",
        f"-- Remove registros padrão da base zerada antes de inserir os do PAF\n",
        f"DELETE FROM `{tbl}`;\n\n",
    ]

    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        val_tuples = [
            "  (" + ", ".join(
                _overrides[c.upper()] if c.upper() in _overrides else _val_insert(row.get(c))
                for c in col_names
            ) + ")"
            for row in batch
        ]
        parts.append(
            f"INSERT INTO `{tbl}` ({col_list}) VALUES\n"
            + ",\n".join(val_tuples)
            + ";\n\n"
        )

    return "".join(parts)


# ── Schema ────────────────────────────────────────────────────────────────────

class GerarRequest(BaseModel):
    session_id: str
    ambiente: int = 1


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analisar")
async def analisar(
    arquivo: UploadFile = File(...),
    _: Usuario = Depends(require_permission("configuracoes.edit")),
):
    ext = (arquivo.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("fdb", "gdb", "ib"):
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Envie um arquivo .fdb, .gdb ou .ib",
        )

    conteudo = await arquivo.read()
    _cleanup_sessions()

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(conteudo)
            tmp_path = tmp.name

        try:
            import firebirdsql as _fb  # type: ignore
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="Biblioteca firebirdsql não instalada no servidor.",
            )

        # Verifica servidor antes de tentar
        import socket as _sock
        _s = _sock.socket(_sock.AF_INET, _sock.SOCK_STREAM)
        _s.settimeout(3)
        _up = _s.connect_ex(('127.0.0.1', 3050)) == 0
        _s.close()
        if not _up:
            raise HTTPException(
                status_code=503,
                detail="Servidor Firebird não acessível (porta 3050). Tente novamente em instantes.",
            )

        import asyncio as _asyncio

        def _analisar_no_firebird(path: str):
            os.chmod(path, 0o666)
            con = _fb.connect(
                host="localhost",
                database=path,
                user="SYSDBA",
                password="masterkey",
                charset="WIN1252",
                timeout=60,
            )
            try:
                cursor = con.cursor()

                resultado: dict = {}
                for key, tabela in TABELAS.items():
                    resultado[key] = _contar_registros(cursor, tabela)

                total_produto = resultado.get("produto")
                if total_produto is not None:
                    resultado["produto"] = {
                        "total": total_produto,
                        # passa con para rollback apos falhas de coluna inexistente
                        "distintos": _contar_distintos_produto(cursor, con),
                    }

                # Produto NAO e buscado aqui — tabela grande (10k-100k linhas).
                # O arquivo temp sobrevive na sessao; /gerar busca os dados la.
                empresas_data            = _fetch_row(cursor, "EMPRESAS")
                cert_data                = _fetch_row(cursor, "CERTIFICADO_DIGITAL")

                # Conexão separada com charset=LATIN1 (iso-8859-1) para tolerar bytes
                # inválidos em cp1252 (ex.: 0x81 indefinido no WIN1252).
                # iso-8859-1 aceita todos os 256 bytes sem exceção.
                con_cli = _fb.connect(
                    host="localhost",
                    database=path,
                    user="SYSDBA",
                    password="masterkey",
                    charset="LATIN1",
                    timeout=60,
                )
                try:
                    cursor_cli = con_cli.cursor()
                    clientes_rows = _fetch_clientes(cursor_cli)
                    try:
                        cursor_cli.close()
                    except Exception:
                        pass
                finally:
                    try:
                        con_cli.close()
                    except Exception:
                        pass

                perfil_cols, perfil_rows = _fetch_all_generic(cursor, "PERFILCLIENTES")

                cursor.close()
            finally:
                try:
                    con.close()
                except Exception:
                    pass  # _op_response inesperado ao fechar — dados ja foram buscados

            return resultado, empresas_data, cert_data, clientes_rows, perfil_cols, perfil_rows

        try:
            (
                resultado, empresas_data, cert_data,
                clientes_rows, perfil_cols, perfil_rows,
            ) = await _asyncio.to_thread(_analisar_no_firebird, tmp_path)
        except Exception as e:
            import traceback
            print(f"[BD-RESTORE] Erro ao conectar Firebird: {e}")
            print(traceback.format_exc())
            raise HTTPException(
                status_code=422,
                detail=f"Não foi possível abrir o banco Firebird. Detalhe: {e}",
            )

        # Diagnóstico: ID_PERFIL em CLIENTES sem correspondente em PERFILCLIENTES
        valid_perfil_set = {
            row.get("ID_PERFIL") for row in perfil_rows
            if row.get("ID_PERFIL") is not None
        }
        orphaned_perfil_ids = sorted({
            row.get("ID_PERFIL") for row in clientes_rows
            if row.get("ID_PERFIL") is not None
            and row.get("ID_PERFIL") not in valid_perfil_set
        })

        session_id = str(uuid.uuid4())
        _sessions[session_id] = {
            "created_at":       datetime.utcnow(),
            "filename":         arquivo.filename or "arquivo.fdb",
            "tmp_path":         tmp_path,   # arquivo sobrevive ate /gerar
            "empresas":         empresas_data,
            "certificado":      cert_data,
            "clientes":         clientes_rows,
            "perfil_cols":      perfil_cols,
            "perfil_rows":      perfil_rows,
            "valid_perfil_set": valid_perfil_set,
        }
        # tmp_path nao e apagado aqui — sera apagado pelo /gerar ou pelo cleanup de sessao
        tmp_path = None

        return {
            **resultado,
            "session_id": session_id,
            "clientes_orphaned_perfil": orphaned_perfil_ids,
            "clientes_lidos": len(clientes_rows),
        }

    finally:
        # Apaga o temp apenas se a sessao NAO foi criada (erro antes do session_id)
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@router.post("/gerar")
async def gerar(
    req: GerarRequest,
    _: Usuario = Depends(require_permission("configuracoes.edit")),
):
    print(f"[BD-RESTORE/gerar] session_id={req.session_id} ambiente={req.ambiente} sessions_ativas={list(_sessions.keys())[:5]}")
    if req.session_id not in _sessions:
        print(f"[BD-RESTORE/gerar] SESSAO NAO ENCONTRADA — sessoes ativas: {len(_sessions)}")
        raise HTTPException(
            status_code=400,
            detail="Sessão inválida ou expirada. Repita a análise no Passo 2.",
        )

    session          = _sessions[req.session_id]
    emp: dict        = session["empresas"]
    cert: dict       = session["certificado"]
    clientes: list         = session["clientes"]
    perfil_cols: list      = session.get("perfil_cols", [])
    perfil_rows: list      = session.get("perfil_rows", [])
    valid_perfil_set: set  = session.get("valid_perfil_set", set())
    filename: str    = session["filename"]
    tmp_path: str | None   = session.get("tmp_path")
    ambiente         = req.ambiente
    now              = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    amb_label        = "PRODUCAO" if ambiente == 1 else "HOMOLOGACAO"

    from app.services import storage_service as storage
    import firebirdsql as _fb  # type: ignore
    from fastapi.responses import StreamingResponse

    base_bytes = storage.download_sync(_BASE_SQL_STORAGE)
    if base_bytes is None:
        raise HTTPException(400, "base_zerada.sql não encontrado — faça upload em Configurações")

    # CODIGO_N fixo em 1 — base_zerada sempre inicia com 1, não altera a PK
    codigo_n = 1

    # ── UPDATE empresas ────────────────────────────────────────────────────────
    emp_pairs: list[tuple[str, str]] = []
    for field in _EMPRESAS_DIRECT_FIELDS:
        val = emp.get(field)
        if val is not None and _decode_str(val).strip():
            emp_pairs.append((f"`{field}`", _esc(val)))

    # ID_CIDADE: subquery resolve o ID correto na tabela cidades da base zerada
    # usando CIDADE+ESTADO do Firebird. O ID do PAF-Firebird é PK interna e não
    # corresponde ao MySQL — mapear direto causaria FK inválida ou cidade errada.
    _cidade_nome = _decode_str(emp.get("CIDADE") or "").strip()
    _estado_uf   = _decode_str(emp.get("ESTADO") or "").strip()
    if _cidade_nome and _estado_uf:
        emp_pairs.append((
            "`ID_CIDADE`",
            f"(SELECT `id_cidade` FROM `cidades`"
            f" WHERE UPPER(TRIM(`cidade`)) = UPPER(TRIM({_esc(_cidade_nome)}))"
            f" AND `uf` = {_esc(_estado_uf.upper())} LIMIT 1)",
        ))

    # ── Campos de CERTIFICADO_DIGITAL com renomeação (exceto NUMERO_SERIE) ──────
    for fb_col, mysql_col in _CERT_FIELD_MAP.items():
        if fb_col == "NUMERO_SERIE":
            continue  # serial extraído do PFX abaixo — formato garantido
        val = cert.get(fb_col)
        if val is not None and str(val).strip():
            emp_pairs.append((f"`{mysql_col}`", _esc(val)))

    # ── DADOSPFX (BLOB binário) e SERIALCERTIFICADO extraído do PFX ──────────
    arquivo_blob = cert.get("ARQUIVO")
    if arquivo_blob:
        hex_val = _blob_hex(arquivo_blob)
        if hex_val:
            emp_pairs.append(("`DADOSPFX`", hex_val))
        # Extrai serial diretamente do PFX (hex maiúsculo) — mesmo formato do sql_generator_service
        senha_cert = _decode_str(cert.get("SENHA") or "").strip() or None
        serial = _extract_serial_from_pfx(bytes(arquivo_blob), senha_cert)
        if serial:
            emp_pairs.append(("`SERIALCERTIFICADO`", _esc(serial)))

    # ── Configurações técnicas (espelha sql_generator_service) ───────────────
    emp_pairs.extend([
        ("`SSLLIB`",             "1"),
        ("`CRYPTLIB`",           "1"),
        ("`HTTPLIB`",            "2"),
        ("`XMLSIGNLIB`",         "4"),
        ("`SSLTYPE`",            "5"),
        ("`VERSAO_NFCE`",        "2"),
        ("`FORMA_EMISSAO_NFCE`", "2"),
        ("`MODELO_DANFE_NFCE`",  "6"),
    ])

    emp_pairs.append(("`AMBIENTE`",      str(ambiente)))
    emp_pairs.append(("`AMBIENTE_NFCE`", str(ambiente)))

    header_comment = (
        f"\n-- ============================================================\n"
        f"-- MIGRAÇÃO BD RESTORE — Base Firebird: {filename}\n"
        f"-- Ambiente: {amb_label} | Gerado pelo CRM CriareTI em: {now}\n"
        f"-- ============================================================\n"
    )

    update_empresa = _sql_block(
        f"DADOS DA EMPRESA — origem: {filename}",
        emp_pairs,
        "empresas",
        "`CODIGO_N` = 1",
    )

    insert_perfil   = _gerar_insert_generico(
        perfil_cols, perfil_rows, "perfilclientes",
        overrides={"ID_EMPRESA": str(codigo_n)},
    )
    insert_clientes = _gerar_clientes_sql(clientes, valid_perfil_set or None)

    sufixo = "prod" if ambiente == 1 else "homolog"
    nome_base = filename.rsplit(".", 1)[0]
    output_filename = f"restore_{nome_base}_{sufixo}.sql"

    # Partes estaticas (ja em memoria — enviadas imediatamente ao cliente)
    static_sql = (
        b"create database bdsia;\nuse bdsia;\n\n"
        + base_bytes
        + header_comment.encode("utf-8")
        + update_empresa.encode("utf-8")
        + insert_perfil.encode("utf-8")
        + insert_clientes.encode("utf-8")
    )

    # ── Streaming com keep-alive ──────────────────────────────────────────────
    # Firebird demora para exportar tabelas grandes (31k+ produtos com BLOBs).
    # Solucao: thread de background envia chunks via queue; async generator
    # emite keep-alive SQL comments a cada 8s para Render nao cortar por inatividade.
    import threading
    import queue as _queue

    _tmp = tmp_path
    _session = session

    def _firebird_worker(q: "_queue.Queue[bytes | None]") -> None:
        try:
            if not _tmp or not os.path.exists(_tmp):
                q.put(b"\n-- AVISO: arquivo Firebird nao disponivel\n")
                return
            os.chmod(_tmp, 0o666)
            con = _fb.connect(
                host="localhost",
                database=_tmp,
                user="SYSDBA",
                password="masterkey",
                charset="WIN1252",
                timeout=300,
            )
            try:
                cursor = con.cursor()
                q.put(_fetch_grupos_para_sql(cursor).encode("utf-8"))
                for chunk in _stream_produto_cursor(cursor):
                    q.put(chunk)
                cursor.close()
            finally:
                try:
                    con.close()
                except Exception:
                    pass  # _op_response inesperado ao fechar — chunks ja enviados
        except Exception as e:
            print(f"[BD-RESTORE/gerar] Erro Firebird worker: {e}")
            q.put(f"\n-- ERRO ao processar Firebird: {e}\n".encode("utf-8"))
        finally:
            q.put(None)  # sentinela — indica fim do stream
            try:
                os.unlink(_tmp)
            except OSError:
                pass
            _session.pop("tmp_path", None)

    async def sql_stream():
        yield static_sql

        data_q: "_queue.Queue[bytes | None]" = _queue.Queue(maxsize=20)
        t = threading.Thread(target=_firebird_worker, args=(data_q,), daemon=True)
        t.start()
        print(f"[BD-RESTORE/gerar] thread Firebird iniciada — tmp={_tmp}")

        ticks = 0
        while True:
            try:
                chunk = data_q.get_nowait()
            except _queue.Empty:
                # Sem dados ainda — emite keep-alive para nao fechar conexao
                await asyncio.sleep(8)
                ticks += 1
                yield f"-- aguardando Firebird ({ticks * 8}s)...\n".encode("utf-8")
                continue

            if chunk is None:
                print(f"[BD-RESTORE/gerar] stream Firebird concluido ({ticks} keep-alives)")
                break
            yield chunk

        t.join(timeout=2)

    import asyncio
    return StreamingResponse(
        sql_stream(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{output_filename}"'},
    )
