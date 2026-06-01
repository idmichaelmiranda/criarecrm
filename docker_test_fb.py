import os, tempfile, sys, traceback

print(f'FIREBIRD env: {os.environ.get("FIREBIRD", "nao definido")}')

from firebird.driver import connect, create_database

p = tempfile.mktemp(suffix='.fdb')
try:
    c = create_database(database=p)
    c.close()
    c2 = connect(database=p)
    c2.close()
    print('=== EMBEDDED MODE OK ===')
except Exception as e:
    print(f'=== EMBEDDED FAILED ===')
    print(f'Tipo: {type(e).__name__}')
    print(f'Mensagem: {e}')
    traceback.print_exc()
    sys.exit(1)
finally:
    try:
        os.unlink(p)
    except Exception:
        pass
