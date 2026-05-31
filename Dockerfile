FROM python:3.12-slim

# Instala Firebird 3.0 server (necessário para fdb abrir arquivos .fdb locais)
RUN echo "firebird3.0-server-core firebird3.0-server-core/sysdba-password password masterkey" | debconf-set-selections && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        firebird3.0-server-core \
        libfbclient2 \
    && rm -rf /var/lib/apt/lists/*

# Configura Firebird para modo embedded (Engine12 direto, sem tentar TCP)
# Providers padrão é Remote,Engine12,Local — Remote tenta TCP e falha no Docker
RUN printf "\n# fdb embedded mode\nAuthServer = Legacy_Auth, Srp\nAuthClient = Legacy_Auth, Srp\nWireCrypt = Disabled\nProviders = Engine12\n" \
    >> /etc/firebird/3.0/firebird.conf

# Aponta fdb para o config do Firebird (necessário para embedded engine no Debian)
ENV FIREBIRD_CONF=/etc/firebird/3.0/firebird.conf

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
