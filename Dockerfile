FROM python:3.12-slim

# gosu: setuid/setgid sem PAM — necessário para iniciar o servidor Firebird
# como user 'firebird' em Docker slim onde su falha por falta de módulos PAM
RUN echo "firebird3.0-server-core firebird3.0-server-core/sysdba-password password masterkey" | debconf-set-selections && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        firebird3.0-server-core \
        libfbclient2 \
        gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
