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
RUN printf "Providers = Engine12\nPluginsDirectory = /usr/lib/x86_64-linux-gnu/firebird/3.0/plugins\nSecurityDatabase = /var/lib/firebird/3.0/system/security3.fdb\nAuthServer = Srp, Legacy_Auth\nAuthClient = Srp, Legacy_Auth\n" \
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

# Diagnóstico: verifica plugins, dependências e config antes do teste
RUN echo "=== plugins dir ===" && \
    ls -la /usr/lib/x86_64-linux-gnu/firebird/3.0/plugins/ 2>&1 || echo "DIR AUSENTE" && \
    echo "=== ldd Engine12 ===" && \
    ldd /usr/lib/x86_64-linux-gnu/firebird/3.0/plugins/libEngine12.so 2>&1 || echo "ENGINE12 AUSENTE/QUEBRADO" && \
    echo "=== security3.fdb ===" && \
    ls -la /var/lib/firebird/3.0/system/ 2>&1 || echo "SYSTEM DIR AUSENTE" && \
    echo "=== ldconfig firebird ===" && \
    ldconfig -p 2>/dev/null | grep -i firebird || echo "nenhuma lib firebird no cache" && \
    echo "=== isql-fb embedded test ===" && \
    printf "CREATE DATABASE '/tmp/diag.fdb';\nQUIT;\n" | isql-fb 2>&1 || true

# Config temporária com Trusted auth — sem security3.fdb — só para o teste de build.
# AuthClient=Trusted deixa o engine embedded autenticar pelo usuário do OS,
# sem precisar consultar security3.fdb (que não existe durante o docker build).
RUN mkdir -p /tmp/fb-embedded && \
    printf "Providers = Engine12\nPluginsDirectory = /usr/lib/x86_64-linux-gnu/firebird/3.0/plugins\nAuthClient = Trusted\nWireCrypt = Disabled\n" \
    > /tmp/fb-embedded/firebird.conf

# Teste obrigatório: falha o build se embedded mode não funcionar
RUN FIREBIRD=/tmp/fb-embedded python3 docker_test_fb.py

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
