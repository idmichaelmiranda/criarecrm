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

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
