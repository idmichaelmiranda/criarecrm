import os, tempfile, sys
from firebird.driver import connect, create_database

p = tempfile.mktemp(suffix='.fdb')
try:
    c = create_database(database=p, user='SYSDBA', password='masterkey')
    c.close()
    c2 = connect(database=p, user='SYSDBA', password='masterkey')
    c2.close()
    print('=== EMBEDDED MODE OK ===')
except Exception as e:
    print(f'=== EMBEDDED FAILED: {e} ===')
    sys.exit(1)
finally:
    try: os.unlink(p)
    except: pass
