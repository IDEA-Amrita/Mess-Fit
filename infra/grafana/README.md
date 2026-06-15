# Grafana dashboards (Phase 9, task 9.2)

Three dashboards covering the metrics the PRD asks for. They are committed as
importable JSON so the observability setup is reproducible and code-reviewed.

| File | Dashboard | Datasource(s) |
|---|---|---|
| `dashboards/api-health-red.json` | API Health (RED): request rate, error rate, p50/p95/p99 by route | Prometheus |
| `dashboards/business.json` | Business KPIs: DAU/WAU, signups/day, logs/active user, optimizations/day, adherence | Postgres + Prometheus |
| `dashboards/ai-optimizer.json` | AI/Optimizer: solve-time percentiles, infeasibility rate, chatbot generation latency, LLM tokens/cost | Prometheus |

## Where the metrics come from

The API exports **traces** via OpenTelemetry (`messfit_api/observability/setup.py`,
task 9.1) to an OTLP/HTTP endpoint. The RED and AI/Optimizer panels are built on
**Tempo span-metrics** — Grafana Cloud's metrics-generator turns spans into
Prometheus series:

- `traces_spanmetrics_calls_total{service_name, span_name, span_kind, status_code}`
- `traces_spanmetrics_latency_bucket{service_name, span_name, le}`

So `optimizer.solve` and `chat.generate`/`chat.retrieve` (our custom spans) show
up as `span_name` values automatically — no extra metric code needed for latency
and call counts.

Two panels are **documented placeholders** because the underlying metric is not
emitted yet:

- **LLM tokens/cost** — add a `llm_tokens_total{kind="input|output"}` counter in
  `chatbot/llm.py` plus a recording rule multiplying by the per-token rate.
- **7-day adherence** — back with a daily rollup of
  `tracking/metrics.compute_adherence`.

The optimizer **infeasibility** panel needs the metrics-generator configured to
promote the `optimizer.solver_status` span attribute to a metric label.

## Importing

1. Grafana → **Dashboards → New → Import**.
2. Upload the JSON file (or paste its contents).
3. When prompted, bind `DS_PROMETHEUS` to your Prometheus/Mimir datasource and
   `DS_POSTGRES` (business dashboard) to a **read-only** Postgres datasource
   pointed at the MessFit DB.

## Live verification (operator gate)

These JSON files are the committable artifact. The Phase 9 quality gate —
"open Grafana → see live request rate, p95 latency, error rate, LLM cost/day" —
is verified by the operator once an OTLP endpoint + datasources are wired
(set `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_HEADERS`).
