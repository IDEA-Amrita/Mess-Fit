"""Tracing setup must be a no-op without an OTLP endpoint (Phase 9, task 9.1).

This guards the core promise: with no exporter configured, dev and the test
suite stay clean and nothing is shipped to a third party.
"""

from __future__ import annotations

from messfit_api.observability import setup as otel_setup


class _FakeApp:
    version = "9.9.9"


def test_setup_otel_noop_without_endpoint(monkeypatch):
    monkeypatch.setattr(otel_setup.settings, "otel_exporter_otlp_endpoint", "")
    monkeypatch.setattr(otel_setup, "_instrumented", False)
    assert otel_setup.setup_otel(_FakeApp()) is False


def test_get_tracer_always_callable():
    # No provider installed -> OTel hands back a no-op tracer; spans must not raise.
    tracer = otel_setup.get_tracer()
    with tracer.start_as_current_span("test.span") as span:
        span.set_attribute("k", "v")


def test_parse_headers_w3c_format():
    parsed = otel_setup._parse_headers("Authorization=Basic abc,X-Scope=tenant1")
    assert parsed == {"Authorization": "Basic abc", "X-Scope": "tenant1"}
    assert otel_setup._parse_headers("") == {}
