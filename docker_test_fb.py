import os, tempfile, sys
from firebird.driver import connect, create_database

p = tempfile.mktemp(suffix='.fdb')
try:
    # Trusted auth: sem user/password — o engine usa o usuário do OS.
    # Requer AuthClient=Trusted no firebird.conf apontado por FIREBIRD env var.
    c = create_database(database=p)
    c.close()
    c2 = connect(database=p)
    c2.close()
    print('=== EMBEDDED MODE OK ===')
except Exception as e:
    print(f'=== EMBEDDED FAILED: {e} ===')
    sys.exit(1)
finally:
    try:
        os.unlink(p)
    except Exception:
        pass
