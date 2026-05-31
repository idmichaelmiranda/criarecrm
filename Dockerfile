FROM python:3.12-slim

# firebird3.0 (meta-pacote completo) em vez de apenas server-core
# server-core sozinho não instala todos os arquivos necessários para o servidor subir
RUN echo "firebird3.0-server firebird3.0-server/sysdba-password password masterkey" | debconf-set-selections && \
    echo "firebird3.0-server firebird3.0-server/sysdba-password-again password masterkey" | debconf-set-selections && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        firebird3.0-server \
        libfbclient2 \
        gosu \
    && rm -rf /var/lib/apt/lists/*

# Diagnóstico: mostra o que foi instalado (visível nos logs de build do Render)
RUN echo "=== engine12.so ===" && \
    find / -name "engine12.so" 2>/dev/null || echo "NOT FOUND" && \
    echo "=== fb_smp_server ===" && \
    find /usr -name "fb_smp_server" 2>/dev/null || echo "NOT FOUND" && \
    echo "=== security3.fdb ===" && \
    ls -la /var/lib/firebird/3.0/system/security3.fdb 2>/dev/null || echo "NOT FOUND" && \
    echo "=== fbguard ===" && \
    ls -la /usr/sbin/fbguard 2>/dev/null || echo "NOT FOUND"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
