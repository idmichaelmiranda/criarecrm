#!/bin/bash

# Garante diretório de runtime do Firebird
mkdir -p /var/run/firebird/3.0
chown -R firebird:firebird /var/run/firebird 2>/dev/null || true

# Inicia Firebird 3.0 server em background
# fbguard é o binário correto no Debian (o antigo /usr/sbin/firebird não existe)
su -s /bin/sh -c "/usr/sbin/fbguard -daemon -forever" firebird &
echo "Firebird iniciado (PID $!)"
sleep 3

# Inicia o servidor FastAPI
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
