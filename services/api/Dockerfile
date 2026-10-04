# syntax=docker/dockerfile:1.7
#
# One image for every backend process: the API, the Celery worker, Celery
# beat and the migration job. The role is the container's first argument
# (see deploy/entrypoint.sh). Build from the repository root, because the uv
# workspace and its lockfile live there:
#
#   docker build -f services/api/Dockerfile -t messfit-api .
#   docker run --env-file services/api/.env -p 8000:8000 messfit-api api

ARG PYTHON_VERSION=3.12
ARG UV_VERSION=0.11.7

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

# ── build: resolve the locked runtime dependencies into a venv ─────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /src
# Dependencies first, so source edits don't invalidate this layer.
COPY pyproject.toml uv.lock ./
COPY services/api/pyproject.toml services/api/pyproject.toml
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package messfit-api --no-install-workspace

# ── runtime: slim, non-root, no build tools ────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime
LABEL org.opencontainers.image.title="messfit-api" \
      org.opencontainers.image.source="https://github.com/IDEA-Amrita/Mess-Fit" \
      org.opencontainers.image.licenses="Apache-2.0"

# Pick up Debian security fixes released since the base image was published.
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

ENV PATH=/opt/venv/bin:$PATH \
    PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

COPY --from=build /opt/venv /opt/venv
WORKDIR /app
COPY --chown=app:app services/api/alembic.ini ./
COPY --chown=app:app services/api/infra/migrations ./infra/migrations
COPY --chown=app:app services/api/scripts ./scripts
COPY --chown=app:app services/api/messfit_api ./messfit_api
COPY --chown=app:app --chmod=755 services/api/deploy/entrypoint.sh /usr/local/bin/entrypoint

USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/health', timeout=3)" || exit 1

ENTRYPOINT ["entrypoint"]
CMD ["api"]
