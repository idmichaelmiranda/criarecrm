#!/bin/bash
mkdir -p uploads/avatars

# Inicia o servidor Firebird em background.
# O firebird.driver usa TCP (host=localhost) para conectar a arquivos .fdb enviados;
# modo embedded falha nesse ambiente Debian com a versão 2.0.x do driver Python.
/usr/sbin/fbguard -daemon 2>/dev/null || true
sleep 2   # aguarda o servidor estar pronto para aceitar conexões

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
