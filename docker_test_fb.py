import ctypes

# libfbclient deve ser carregado com RTLD_GLOBAL antes do firebird.driver importar.
# ctypes usa RTLD_LOCAL por padrão: os símbolos de libfbclient ficam invisíveis
# quando o Firebird tenta carregar libEngine12.so como plugin via dlopen interno.
# RTLD_GLOBAL torna os símbolos visíveis globalmente → Engine12 carrega com sucesso.
# isql-fb (executável compilado) não tem esse problema porque executáveis linkam
# as libs com RTLD_GLOBAL automaticamente.
ctypes.CDLL('libfbclient.so.2', mode=ctypes.RTLD_GLOBAL)

import os, tempfile, sys, traceback
from firebird.driver import connect, create_database

p = tempfile.mktemp(suffix='.fdb')
try:
    c = create_database(database=p)
    c.close()
    c2 = connect(database=p)
    c2.close()
    print('=== EMBEDDED MODE OK ===')
except Exception as e:
    print(f'=== EMBEDDED FAILED: {type(e).__name__}: {e} ===')
    traceback.print_exc()
    sys.exit(1)
finally:
    try:
        os.unlink(p)
    except Exception:
        pass
