#!/bin/sh
# Container entrypoint: the first argument picks the process.
#
#   api      HTTP API (uvicorn). PORT and WEB_CONCURRENCY are honoured.
#   worker   Celery worker: menu OCR and other background jobs.
#   beat     Celery beat: the daily and weekly schedule. Run exactly one.
#   migrate  alembic upgrade head as the schema owner (postgres), taken from
#            MIGRATION_DATABASE_URL when set, else DATABASE_URL. Never the
#            least-privilege messfit_app role.
#
# Anything else is executed as given, e.g. `python scripts/ingest_articles.py`.
set -eu

role="${1:-api}"
[ "$#" -gt 0 ] && shift

case "$role" in
  api)
    # Behind the platform's load balancer: trust its X-Forwarded-* headers so
    # rate limits and logs see the client's address, not the proxy's.
    exec uvicorn messfit_api.main:app \
      --host 0.0.0.0 --port "${PORT:-8000}" \
      --workers "${WEB_CONCURRENCY:-2}" \
      --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}" \
      --no-server-header "$@"
    ;;
  worker)
    exec celery -A messfit_api.celery_app worker \
      --loglevel "${LOG_LEVEL:-info}" --concurrency "${CELERY_CONCURRENCY:-2}" "$@"
    ;;
  beat)
    # The schedule file lives in /tmp: the app user can't write to /app.
    exec celery -A messfit_api.celery_app beat \
      --loglevel "${LOG_LEVEL:-info}" --schedule /tmp/celerybeat-schedule "$@"
    ;;
  migrate)
    # Hosts usually give the release step the service's own environment, so a
    # separate owner URL can be supplied without exposing it to the app.
    if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
      DATABASE_URL="$MIGRATION_DATABASE_URL"
      export DATABASE_URL
    fi
    exec alembic upgrade head "$@"
    ;;
  *)
    exec "$role" "$@"
    ;;
esac
