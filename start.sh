#!/bin/bash

echo "=== Firebird config ==="
cat /etc/firebird/3.0/firebird.conf
echo ""
echo "FIREBIRD=$FIREBIRD"

echo "=== Embedded mode test ==="
python3 - <<'EOF'
import ctypes.util, fdb
lib = ctypes.util.find_library('fbclient')
print(f"fbclient lib: {lib}")
try:
    fdb.connect(database='/tmp/nonexistent_test.fdb', user='SYSDBA', password='masterkey', sql_dialect=3)
except fdb.fbcore.DatabaseError as e:
    msg = str(e)
    if 'localhost' in msg or 'network request' in msg.lower():
        print("RESULT: AINDA USANDO TCP — libfbclient ignora o config")
    elif 'no such file' in msg.lower() or 'i/o error' in msg.lower() or 'file error' in msg.lower() or '-902' not in msg:
        print("RESULT: EMBEDDED FUNCIONA — erro de arquivo esperado")
    else:
        print(f"RESULT: ERRO DIFERENTE — {msg[:200]}")
except Exception as e:
    print(f"RESULT: {type(e).__name__}: {str(e)[:200]}")
EOF

mkdir -p uploads/avatars
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
