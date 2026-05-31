FROM python:3.12-slim

# Instala Firebird 3.0 para leitura embedded de arquivos .fdb
RUN echo "firebird3.0-server-core firebird3.0-server-core/sysdba-password password masterkey" | debconf-set-selections && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        firebird3.0-server-core \
        libfbclient2 \
    && rm -rf /var/lib/apt/lists/*

# Configura Firebird para modo embedded no /etc/firebird/3.0/firebird.conf
# (path lido pelo libfbclient compilado no Debian — FIREBIRD env var é ignorada)
# PluginsDirectory é obrigatório: o Debian instala engine12.so num path diferente
# do que libfbclient espera, então sem isso o plugin não é encontrado e
# o Firebird cai em cascata para o provider Remote (TCP) → erro "localhost"
RUN PLUG_SRC=$(find /usr/lib -name "engine12.so" 2>/dev/null | head -1 | xargs -r dirname) && \
    echo "=== Firebird plugins found at: $PLUG_SRC ===" && \
    if [ -z "$PLUG_SRC" ]; then echo "ERROR: engine12.so not found" && exit 1; fi && \
    printf "\nProviders = Engine12\nPluginsDirectory = %s\nAllowFullAccess = true\nAuthClient = Legacy_Auth, Srp\nWireCrypt = Disabled\n" \
        "$PLUG_SRC" >> /etc/firebird/3.0/firebird.conf

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
