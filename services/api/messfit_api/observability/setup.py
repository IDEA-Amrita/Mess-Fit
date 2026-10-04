"""OpenTelemetry tracing setup (Phase 9, task 9.1).

`setup_otel(app)` instruments the FastAPI app, the SQLAlchemy engine, the
outbound HTTPX client (Gemini / Groq / JWKS), and Redis. Spans are exported to
an OTLP/HTTP endpoint (e.g. Grafana Cloud Tempo) **only when
`settings.otel_exporter_otlp_endpoint` is set** — otherwise the function returns
early and no provider/exporter is installed, so dev and tests never export.

Header auth (Grafana Cloud uses `Authorization: Basic <token>`) is passed via
`settings.otel_exporter_otlp_headers`, in the standard W3C key=value,key=value
format, e.g. `Authorization=Basic%20<base64>`.

Custom spans on hot paths use `get_tracer()`, which is always safe to call: with
no provider installed it returns OTel's no-op tracer.
"""

from __future__ import annotations

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from ..config import settings

_TRACER_NAME = "messfit_api"

# Set once setup_otel installs a real provider; guards against double-instrumenting
# (FastAPIInstrumentor / SQLAlchemyInstrumentor raise if instrumented twice).
_instrumented = False


def get_tracer() -> trace.Tracer:
    """Return the MessFit tracer. No-op tracer until `setup_otel` runs."""
    return trace.get_tracer(_TRACER_NAME)


def _parse_headers(raw: str) -> dict[str, str]:
    """Parse OTLP headers in W3C `key=value,key=value` format."""
    headers: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if not pair or "=" not in pair:
            continue
        key, value = pair.split("=", 1)
        headers[key.strip()] = value.strip()
    return headers


def setup_otel(app: object) -> bool:
    """Instrument the app for tracing. Returns True if a real provider was set up.

    No-op (returns False) when no OTLP endpoint is configured — keeps dev/tests
    free of exporters and avoids shipping spans without operator credentials.
    """
    global _instrumented
    endpoint = settings.otel_exporter_otlp_endpoint.strip()
    if not endpoint or _instrumented:
        return False

    resource = Resource.create(
        {
            "service.name": "messfit-api",
            "service.version": getattr(app, "version", "0.0.0"),
            "deployment.environment": settings.environment,
        }
    )
    provider = TracerProvider(resource=resource)
    headers = _parse_headers(settings.otel_exporter_otlp_headers)
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, headers=headers or None))
    )
    trace.set_tracer_provider(provider)

    # Local imports avoid a hard dependency at module import; engine is created
    # lazily and we only touch it when actually wiring up an exporter.
    from ..db import engine

    FastAPIInstrumentor.instrument_app(app)  # type: ignore[arg-type]
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
    HTTPXClientInstrumentor().instrument()
    RedisInstrumentor().instrument()

    _instrumented = True
    return True
