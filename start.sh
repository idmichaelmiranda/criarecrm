#!/bin/bash
mkdir -p uploads/avatars

echo "[startup] === Diagnostico Firebird ==="
echo "[startup] fbguard: $(ls -la /opt/firebird/bin/fbguard 2>/dev/null || echo 'NAO ENCONTRADO')"
echo "[startup] fbserver: $(ls -la /opt/firebird/bin/fbserver 2>/dev/null || echo 'NAO ENCONTRADO')"
echo "[startup] security2.fdb: $(ls -la /opt/firebird/security2.fdb 2>/dev/null || echo 'NAO ENCONTRADO')"
echo "[startup] /opt/firebird owner: $(stat -c '%U:%G %a' /opt/firebird 2>/dev/null || echo '?')"

echo "[startup] Iniciando servidor Firebird 2.5 SuperClassic..."
# Roda fbguard como usuario firebird; -daemon faz ele proprio ir para background
su -s /bin/bash firebird -c "/opt/firebird/bin/fbguard -daemon" 2>&1 || {
    echo "[startup] su falhou (rc=$?), tentando direto como root..."
    /opt/firebird/bin/fbguard -daemon 2>&1 || echo "[startup] fbguard rc=$?"
}

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
print('[startup] AVISO: Firebird nao respondeu em 30s — continuando mesmo assim')
PYEOF

exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
