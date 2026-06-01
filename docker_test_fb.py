import os, tempfile, sys, traceback

print(f'FIREBIRD env: {os.environ.get("FIREBIRD", "nao definido")}')

from firebird.driver import driver_config, connect, create_database

print(f'driver default host: {driver_config.server_defaults.host.value!r}')

p = tempfile.mktemp(suffix='.fdb')
try:
    # Sem credenciais explícitas — mesmo comportamento do isql-fb que funciona.
    # O engine embedded com AuthClient=Srp,Legacy_Auth aceita conexões locais
    # sem user/password (usa autenticação pelo OS ou SYSDBA como padrão embedded).
    c = create_database(database=p)
    c.close()
    c2 = connect(database=p)
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
