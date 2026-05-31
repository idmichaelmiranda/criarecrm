FROM python:3.12-slim

RUN echo "firebird3.0-server firebird3.0-server/sysdba-password password masterkey" | debconf-set-selections && \
    echo "firebird3.0-server firebird3.0-server/sysdba-password-again password masterkey" | debconf-set-selections && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        firebird3.0-server \
        libfbclient2 \
    && rm -rf /var/lib/apt/lists/*

# Embedded mode: libEngine12.so está em /usr/lib/x86_64-linux-gnu/firebird/3.0/plugins/
# mas libfbclient procura em $FB_ROOT/plugins/ onde FB_ROOT = dir do .so = /usr/lib/x86_64-linux-gnu/
# PluginsDirectory e IntlPath absolutos resolvem a discrepância de path do Debian
# Providers = Engine12 sobrescreve o padrão Remote,Engine12,Loopback (última linha vence)
RUN printf "\nProviders = Engine12\nPluginsDirectory = /usr/lib/x86_64-linux-gnu/firebird/3.0/plugins\nIntlPath = /usr/lib/x86_64-linux-gnu/firebird/3.0/intl\n" \
    >> /etc/firebird/3.0/firebird.conf

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
