#!/bin/bash

echo "=== Firebird Startup Diagnostics ==="
echo "security3.fdb : $(ls -la /var/lib/firebird/3.0/system/security3.fdb 2>/dev/null || echo MISSING)"
echo "fbguard       : $(ls /usr/sbin/fbguard 2>/dev/null || echo MISSING)"
echo "init script   : $(ls /etc/init.d/firebird3.0 2>/dev/null || echo MISSING)"
echo "firebird user : $(id firebird 2>/dev/null || echo MISSING)"
echo "engine12.so   : $(find / -name 'engine12.so' 2>/dev/null | head -1 || echo NOT_FOUND)"

# Garante diretórios e permissões
mkdir -p /var/run/firebird/3.0
chown -R firebird:firebird /var/run/firebird 2>/dev/null || true
chown -R firebird:firebird /var/lib/firebird  2>/dev/null || true

echo "=== Tentativa 1: init script ==="
if [ -x /etc/init.d/firebird3.0 ]; then
    /etc/init.d/firebird3.0 start 2>&1 || true
    sleep 3
else
    echo "Init script nao encontrado"
fi

check_port() {
    python3 -c "
import socket, sys
s = socket.socket()
s.settimeout(2)
r = s.connect_ex(('127.0.0.1', 3050))
print('Port 3050:', 'OPEN - Firebird OK' if r == 0 else f'CLOSED (errno={r})')
sys.exit(0 if r == 0 else 1)
s.close()
" 2>/dev/null
}

if ! check_port; then
    echo "=== Tentativa 2: gosu + fbguard ==="
    gosu firebird /usr/sbin/fbguard -daemon -forever 2>&1 &
    sleep 5
    check_port || echo "Firebird nao subiu — BD Restore indisponivel"
fi

echo "=== Iniciando uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
