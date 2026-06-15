"""Observability: OpenTelemetry tracing, Sentry, and rate limiting (Phase 9).

Every integration here is env-gated — with no OTLP endpoint / Sentry DSN
configured, setup is a no-op so local dev and the test suite stay clean and
nothing is exported to a third party without the operator's credentials.
"""

from .setup import get_tracer, setup_otel

__all__ = ["get_tracer", "setup_otel"]
