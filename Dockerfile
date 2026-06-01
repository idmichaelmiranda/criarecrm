# Ubuntu 20.04 tem firebird2.5-superclassic no universe.
# Debian bullseye/bookworm nao tem mais o pacote 2.5.
# Firebird 3.0 rejeita ODS 11.2 (banco Firebird 2.5): "found 11.2, support 12.2".
FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        software-properties-common ca-certificates curl \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && echo "firebird2.5-superclassic firebird2.5-superclassic/sysdba-password password masterkey" | debconf-set-selections \
    && echo "firebird2.5-superclassic firebird2.5-superclassic/sysdba-password-again password masterkey" | debconf-set-selections \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        python3.12 \
        python3.12-distutils \
        firebird2.5-superclassic \
    && curl -fsSL https://bootstrap.pypa.io/get-pip.py | python3.12 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN python3.12 -m pip install --no-cache-dir -r requirements.txt

COPY . .

# Teste: isql-fb Firebird 2.5 em embedded (libfbembed — sem issues de Engine12/RTLD)
RUN python3.12 docker_test_fb.py

RUN mkdir -p uploads/avatars

EXPOSE 8000

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
