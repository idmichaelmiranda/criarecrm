FROM python:3.12-slim

# Dependencias de runtime para Firebird 2.5 no Debian
RUN apt-get update && apt-get install -y --no-install-recommends \
        libstdc++6 curl adduser \
    && rm -rf /var/lib/apt/lists/*

# Cria usuario/grupo firebird para o servidor
RUN groupadd --system --gid 84 firebird 2>/dev/null || true && \
    useradd --system --uid 84 --gid 84 \
        --home /var/lib/firebird --no-create-home \
        --shell /bin/false firebird 2>/dev/null || true && \
    mkdir -p /var/lib/firebird && chown firebird:firebird /var/lib/firebird

# Instala Firebird 2.5.9 SuperClassic a partir do release oficial.
# Firebird 3.0 rejeita ODS 11.2 (bancos Firebird 2.5) com "found 11.2, support 12.2".
# O tar.gz oficial funciona em qualquer Linux (nao depende de repo Debian/Ubuntu).
RUN curl -fsSL \
    "https://github.com/FirebirdSQL/firebird/releases/download/R2_5_9/FirebirdCS-2.5.9.27139-0.amd64.tar.gz" \
    | tar -xz -C /tmp && \
    tar -xzf /tmp/FirebirdCS-2.5.9.27139-0.amd64/buildroot.tar.gz -C / && \
    rm -rf /tmp/FirebirdCS-2.5.9.27139-0.amd64

# Registra libs do Firebird para o linker e adiciona binarios ao PATH
RUN echo "/opt/firebird/lib" > /etc/ld.so.conf.d/firebird.conf && ldconfig
ENV PATH="/opt/firebird/bin:$PATH"

# Diagnostico: mostra o que o buildroot.tar.gz instalou
RUN echo "=== /opt/firebird/bin ===" && ls /opt/firebird/bin/ 2>/dev/null || echo "AUSENTE" ; \
    echo "=== isql* ===" && find /opt/firebird /usr/bin /usr/local/bin -name "isql*" 2>/dev/null || true

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Teste: isql do Firebird 2.5 em embedded (libfbembed monolitico, sem RTLD issues)
RUN python3 docker_test_fb.py

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
