#!/bin/bash

echo "=== Firebird .so files installed ==="
find / -name "*.so" -path "*firebird*" 2>/dev/null | sort
find / -name "*.so" -path "*plugins*" -path "*fire*" 2>/dev/null | sort
echo "=== Plugins directories ==="
find / -type d -name "plugins" -path "*fire*" 2>/dev/null
find / -type d -name "plugins" 2>/dev/null | grep -v proc | head -10
echo "=== fb_smp_server direct output (3s) ==="
mkdir -p /var/run/firebird/3.0
chown -R firebird:firebird /var/run/firebird 2>/dev/null || true
chown -R firebird:firebird /var/lib/firebird  2>/dev/null || true
gosu firebird timeout 3 /usr/sbin/fb_smp_server 2>&1 | head -30 || true
echo "=== Firebird logs ==="
find /var/log -name "*firebird*" 2>/dev/null | xargs cat 2>/dev/null | tail -20
echo "=== firebird.conf Providers ==="
grep -i "Provider\|Plugin" /etc/firebird/3.0/firebird.conf 2>/dev/null || echo "nenhum"

echo "=== Iniciando uvicorn (Firebird indisponivel) ==="
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
