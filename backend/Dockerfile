FROM python:3.12-slim

ARG PIP_INDEX_URL=https://repo.huaweicloud.com/repository/pypi/simple
ARG PIP_TRUSTED_HOST=repo.huaweicloud.com
ARG PIP_EXTRA_ARGS=--prefer-binary
ARG INSTALL_BUILD_DEPS=1
ARG DEBIAN_MIRROR=repo.huaweicloud.com

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PIP_RETRIES=10

WORKDIR /app

RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i "s|deb.debian.org|${DEBIAN_MIRROR}|g; s|security.debian.org|${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -f /etc/apt/sources.list ]; then \
        sed -i "s|deb.debian.org|${DEBIAN_MIRROR}|g; s|security.debian.org|${DEBIAN_MIRROR}|g" /etc/apt/sources.list; \
    fi; \
    if [ "${INSTALL_BUILD_DEPS}" = "1" ]; then \
        apt-get update; \
        apt-get install -y --no-install-recommends gcc g++; \
        rm -rf /var/lib/apt/lists/*; \
    fi

COPY requirements.txt ./

RUN set -eux; \
    if [ -n "${PIP_TRUSTED_HOST}" ]; then \
        TRUSTED_HOST_ARGS="--trusted-host ${PIP_TRUSTED_HOST}"; \
    else \
        TRUSTED_HOST_ARGS=""; \
    fi; \
    pip install --no-cache-dir \
        --index-url "${PIP_INDEX_URL}" \
        ${TRUSTED_HOST_ARGS} \
        ${PIP_EXTRA_ARGS} \
        -r requirements.txt

COPY README.md ./
COPY app ./app
COPY .env.example ./

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
