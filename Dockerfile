# Firebird 2.5 está em Debian bullseye (não em bookworm).
# O banco importado pelos usuários é ODS 11.2 (Firebird 2.5) — o servidor 3.0
# rejeita ODS 11.2 com "found 11.2, support 12.2".
FROM python:3.12-slim-bullseye

RUN echo "firebird2.5-superclassic firebird2.5-superclassic/sysdba-password password masterkey" | debconf-set-selections && \
    echo "firebird2.5-superclassic firebird2.5-superclassic/sysdba-password-again password masterkey" | debconf-set-selections && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        firebird2.5-superclassic \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Teste de build: verifica Firebird 2.5 embedded (isql-fb usa libfbembed, nao Engine12)
RUN python3 docker_test_fb.py

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
