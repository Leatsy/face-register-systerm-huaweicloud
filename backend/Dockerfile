FROM python:3.12-slim

ARG PIP_INDEX_URL=https://repo.huaweicloud.com/repository/pypi/simple
ARG PIP_TRUSTED_HOST=repo.huaweicloud.com
ARG PIP_EXTRA_ARGS=--prefer-binary

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PIP_RETRIES=10

WORKDIR /app

COPY requirements.txt README.md ./
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

COPY app ./app
COPY .env.example ./

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
