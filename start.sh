#!/bin/bash

echo "=== Firebird startup diagnostics ==="
echo "fbguard: $(ls /usr/sbin/fbguard 2>/dev/null || echo MISSING)"
echo "fb_smp_server: $(find /usr -name fb_smp_server 2>/dev/null | head -1 || echo MISSING)"
echo "security3.fdb: $(ls /var/lib/firebird/3.0/system/security3.fdb 2>/dev/null || echo MISSING)"
echo "firebird user: $(id firebird 2>/dev/null || echo MISSING)"

# Fix permissions
mkdir -p /var/run/firebird/3.0
chown -R firebird:firebird /var/run/firebird 2>/dev/null || true
chown -R firebird:firebird /var/lib/firebird 2>/dev/null || true

echo "=== Starting Firebird ==="
gosu firebird /usr/sbin/fbguard -daemon -forever 2>&1 &
sleep 5

echo "=== Port 3050 check ==="
python3 -c "
import socket
s = socket.socket()
s.settimeout(2)
r = s.connect_ex(('127.0.0.1', 3050))
print('Port 3050:', 'OPEN - Firebird OK' if r == 0 else f'CLOSED (errno {r}) - Firebird NOT running')
s.close()
"

echo "=== Starting uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
