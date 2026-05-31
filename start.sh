#!/bin/bash

mkdir -p /var/run/firebird/3.0
chown -R firebird:firebird /var/run/firebird 2>/dev/null || true

# gosu faz setuid sem PAM — inicia o servidor Firebird como user 'firebird'
gosu firebird /usr/sbin/fbguard -daemon -forever &
echo "Firebird server iniciando..."
sleep 5

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
