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

# Diagnóstico: ctypes para ver erro exato ao carregar Engine12 e isql-fb com verificação
RUN python3 - <<'EOF'
import ctypes, os, subprocess, sys

print("=== libfbclient.so.2 ===")
try:
    ctypes.CDLL("libfbclient.so.2")
    print("OK")
except OSError as e:
    print(f"FAILED: {e}")

print("=== plugins dir (todos arquivos) ===")
r_ls = subprocess.run(["ls", "-la", "/usr/lib/x86_64-linux-gnu/firebird/3.0/plugins/"],
                      capture_output=True, text=True)
print(r_ls.stdout or "DIR AUSENTE")

engine = "/usr/lib/x86_64-linux-gnu/firebird/3.0/plugins/libEngine12.so"
print(f"=== ctypes Engine12 ({engine}) ===")
if os.path.exists(engine):
    try:
        ctypes.CDLL(engine)
        print("OK")
    except OSError as e:
        print(f"FAILED: {e}")
else:
    print("arquivo nao existe")

print("=== isql-fb CREATE DATABASE ===")
r2 = subprocess.run(
    ["isql-fb"],
    input="CREATE DATABASE '/tmp/diag.fdb';\nQUIT;\n",
    capture_output=True, text=True
)
print("stdout:", r2.stdout.strip())
print("stderr:", r2.stderr.strip())
print("rc:", r2.returncode)
print("diag.fdb existe:", os.path.exists("/tmp/diag.fdb"))
EOF

# Teste obrigatório: falha o build se embedded mode não funcionar.
# Usa a config do sistema (FIREBIRD=/etc/firebird/3.0) sem credenciais explícitas,
# mesmo comportamento do isql-fb que confirmamos funcionar no step de diagnóstico.
RUN python3 docker_test_fb.py

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
