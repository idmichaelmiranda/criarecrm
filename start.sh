#!/bin/bash

# Garante diretórios de runtime do Firebird
mkdir -p /var/run/firebird/3.0
chown -R firebird:firebird /var/run/firebird 2>/dev/null || true

# Inicia Firebird 3.0 via start-stop-daemon (correto no Debian sem systemd)
# --chuid usa setuid/setgid direto, sem depender de PAM
start-stop-daemon --start --quiet \
    --chuid firebird:firebird \
    --exec /usr/sbin/fbguard -- -daemon -forever

sleep 3

if pgrep -x fbguard > /dev/null 2>&1; then
    echo "Firebird iniciado com sucesso"
else
    echo "AVISO: Firebird pode nao ter iniciado — BD Restore pode falhar"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
