#!/bin/bash
set -e

# Garante diretório de runtime do Firebird
mkdir -p /var/run/firebird/3.0
chown firebird:firebird /var/run/firebird/3.0 2>/dev/null || true

# Inicia Firebird 3.0 server em background
/usr/sbin/firebird -d 2>&1 &
echo "Firebird iniciado (PID $!)"
sleep 3

# Inicia o servidor FastAPI
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
