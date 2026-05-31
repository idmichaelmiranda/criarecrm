FROM python:3.12-slim

# Instala Firebird 3.0 para leitura embedded de arquivos .fdb
RUN echo "firebird3.0-server-core firebird3.0-server-core/sysdba-password password masterkey" | debconf-set-selections && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        firebird3.0-server-core \
        libfbclient2 \
    && rm -rf /var/lib/apt/lists/*

# Cria diretório unificado /opt/firebird com config + plugins
# libfbclient lê firebird.conf em $FIREBIRD/ e busca plugins em $FIREBIRD/plugins/
RUN PLUG_SRC=$(find /usr/lib -name "engine12.so" 2>/dev/null | head -1 | xargs -r dirname) && \
    INTL_SRC=$(find /usr/lib -name "fbintl.so"   2>/dev/null | head -1 | xargs -r dirname) && \
    mkdir -p /opt/firebird/plugins /opt/firebird/intl && \
    cp /etc/firebird/3.0/firebird.conf /opt/firebird/firebird.conf && \
    if [ -n "$PLUG_SRC" ]; then cp -a "$PLUG_SRC"/. /opt/firebird/plugins/; fi && \
    if [ -n "$INTL_SRC" ]; then cp -a "$INTL_SRC"/. /opt/firebird/intl/; fi && \
    printf "\nProviders = Engine12\nAllowFullAccess = true\nAuthClient = Legacy_Auth, Srp\nWireCrypt = Disabled\n" \
        >> /opt/firebird/firebird.conf

# libfbclient encontra firebird.conf + plugins através desta variável
ENV FIREBIRD=/opt/firebird

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
