import os, tempfile, sys, traceback

print(f'FIREBIRD env: {os.environ.get("FIREBIRD", "nao definido")}')

from firebird.driver import driver_config, connect, create_database

print(f'driver default host: {driver_config.server_defaults.host.value!r}')
print(f'driver default user: {driver_config.server_defaults.user.value!r}')

p = tempfile.mktemp(suffix='.fdb')
try:
    c = create_database(database=p, user='SYSDBA', password='masterkey')
    c.close()
    c2 = connect(database=p, user='SYSDBA', password='masterkey')
    c2.close()
    print('=== EMBEDDED MODE OK ===')
except Exception as e:
    print(f'=== EMBEDDED FAILED ===')
    print(f'Tipo: {type(e).__name__}')
    print(f'Args: {e.args!r}')
    traceback.print_exc()
    sys.exit(1)
finally:
    try:
        os.unlink(p)
    except Exception:
        pass
