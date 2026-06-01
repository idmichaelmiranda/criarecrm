#!/bin/bash
mkdir -p uploads/avatars

echo "[startup] Iniciando servidor Firebird 2.5..."
start-stop-daemon --start --quiet \
    --chuid firebird:firebird \
    --background \
    --exec /usr/sbin/fbguard -- -daemon 2>/dev/null || true

# Aguarda porta 3050 ficar disponivel (ate 30s)
python3 - <<'PYEOF'
import socket, time, sys
for i in range(30):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    ok = s.connect_ex(('127.0.0.1', 3050)) == 0
    s.close()
    if ok:
        print(f'[startup] Firebird 2.5 pronto ({i+1}s)')
        sys.exit(0)
    time.sleep(1)
print('[startup] AVISO: Firebird nao respondeu em 30s')
PYEOF

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
