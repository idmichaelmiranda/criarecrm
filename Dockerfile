FROM python:3.12-slim

RUN echo "firebird3.0-server firebird3.0-server/sysdba-password password masterkey" | debconf-set-selections && \
    echo "firebird3.0-server firebird3.0-server/sysdba-password-again password masterkey" | debconf-set-selections && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        firebird3.0-server \
        libfbclient2 \
    && rm -rf /var/lib/apt/lists/*

# SUBSTITUI o firebird.conf inteiro — append não estava funcionando.
# FIREBIRD env var faz libfbclient ler config de $FIREBIRD/firebird.conf.
# PluginsDirectory absoluto aponta para onde o Debian instalou libEngine12.so.
RUN printf "Providers = Engine12\nPluginsDirectory = /usr/lib/x86_64-linux-gnu/firebird/3.0/plugins\nSecurityDatabase = /var/lib/firebird/3.0/system/security3.fdb\nAuthServer = Legacy_Auth\nAuthClient = Legacy_Auth\nWireCrypt = Disabled\n" \
    > /etc/firebird/3.0/firebird.conf

ENV FIREBIRD=/etc/firebird/3.0

# Garante senha SYSDBA=masterkey no security3.fdb.
# O postinst do apt falhou em mudar a senha porque o embedded não estava configurado ainda.
# Agora com Engine12 + PluginsDirectory corretos, gsec consegue usar modo embedded.
RUN FIREBIRD=/etc/firebird/3.0 gsec -user SYSDBA -password "" -modify SYSDBA -pw masterkey 2>&1 || \
    FIREBIRD=/etc/firebird/3.0 gsec -user SYSDBA -password "masterkey" -modify SYSDBA -pw masterkey 2>&1 || \
    echo "gsec: senha ja masterkey ou erro nao-critico"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Teste obrigatório: falha o build se embedded mode não funcionar
# Garante que o deploy não vai com configuração quebrada
RUN python3 -c "
import os, tempfile
from firebird.driver import connect

path = tempfile.mktemp(suffix='.fdb')
try:
    from firebird.driver import create_database
    con = create_database(f\"create database '{path}' page_size 8192\")
    con.close()
    con2 = connect(database=path, user='SYSDBA', password='masterkey')
    con2.close()
    print('=== EMBEDDED MODE OK ===')
except Exception as e:
    print(f'=== EMBEDDED MODE FAILED: {e} ===')
    raise SystemExit(1)
finally:
    try: os.unlink(path)
    except: pass
"

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
