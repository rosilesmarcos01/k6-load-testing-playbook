# k6 Load Testing Playbook

[![Load Tests](https://github.com/rosilesmarcos01/k6-load-testing-playbook/actions/workflows/load-tests.yml/badge.svg?branch=main)](https://github.com/rosilesmarcos01/k6-load-testing-playbook/actions/workflows/load-tests.yml)

Production-ready load testing scenarios for HTTP APIs and WebSocket services.
Built from real-world experience validating systems serving 50K+ concurrent connections.

## Background

These scenarios were developed while validating a WebSocket notification service
scaling from 5,000 to 50,000+ concurrent connections. A connection storm scenario
was specifically designed after tracing a 30-minute production outage (8,000+ users
affected) to a race condition in connection pooling — fixed with throttling and
exponential backoff, then validated with k6 before the fix shipped.

## Scenario Types

| Scenario | File | Purpose |
|----------|------|---------|
| CI smoke | `scenarios/http-api/smoke-ci.js` | Short HTTPS run on Grafana’s public test API — proves CI + k6 wiring |
| Ramp-up | `scenarios/http-api/ramp-up.js` | Gradual load increase — baseline capacity planning |
| Spike | `scenarios/http-api/spike.js` | Sudden traffic surge — elasticity testing |
| Soak | `scenarios/http-api/soak.js` | Sustained load — memory leak / degradation detection |
| Connection Storm | `scenarios/websocket/connection-storm.js` | Mass reconnect simulation — race condition validation |
| Sustained WS Load | `scenarios/websocket/sustained-load.js` | 99.9% delivery rate validation under continuous load |

## Quick Start

```bash
# Install k6 (macOS)
brew install k6

# Install k6 (Linux)
sudo apt-get install k6

# Run CI smoke locally (same target as GitHub Actions by default)
k6 run scenarios/http-api/smoke-ci.js

# Run HTTP ramp-up against local server
k6 run scenarios/http-api/ramp-up.js

# Run WebSocket connection storm
k6 run scenarios/websocket/connection-storm.js

# Run against a custom URL
k6 run -e BASE_URL=https://staging.your-api.com scenarios/http-api/ramp-up.js

# Run WebSocket against a custom server
k6 run -e WS_URL=wss://staging.your-api.com/ws scenarios/websocket/connection-storm.js
```

## SLO Thresholds

All thresholds are defined centrally in `lib/thresholds.js` and enforced on every run.
k6 exits with a non-zero code if any threshold is breached — which fails the CI build.

| Metric | Threshold |
|--------|-----------|
| HTTP p95 response time | < 200ms |
| HTTP p99 response time | < 500ms |
| HTTP error rate | < 1% |
| HTTP throughput | > 100 req/s |
| WebSocket error rate | < 1% |
| WebSocket delivery rate | ≥ 99.9% |

CI smoke (`smoke-ci.js`) uses **`ciSmokeThresholds`**: same error-rate bar, relaxed latency (internet + shared demo API), minimum throughput `> 0.5` req/s — see `lib/thresholds.js`.

## Reading k6 Output

Key metrics to watch:

- `http_req_duration` — Response time distribution. Focus on `p(95)` and `p(99)`.
- `http_req_failed` — Ratio of failed requests. Should stay under 1%.
- `http_reqs` — Total request throughput per second.
- `ws_session_duration` — How long WebSocket sessions stay open.
- `ws_msgs_received` — Total messages received (delivery validation).
- `vus` — Active virtual users at any point in time.

## CI/CD Integration

See `.github/workflows/load-tests.yml`. On every push and pull request to `main`:

1. Installs k6 on `ubuntu-latest`
2. Runs **`scenarios/http-api/smoke-ci.js`** against **`https://test-api.k6.io`** (Grafana’s public demo API used in official k6 examples) — real TLS, real HTTP, real thresholds
3. Writes `results/smoke-ci.json` and uploads it as a workflow artifact
4. Fails the job if **CI smoke thresholds** in `lib/thresholds.js` (`ciSmokeThresholds`) are breached

The badge at the top of this README reflects that run. This is intentionally **not** the 14‑minute ramp-up: that scenario targets *your* `/api/health` contract and belongs against staging or production-like environments you control.

**Manual runs:** use **Actions → Load Tests → Run workflow** to override `base_url` (same path pattern: `/public/crocodiles/...` must exist on that host, or point smoke at another API and adjust the scenario paths).

For a deploy gate on your own stack, reuse the same workflow pattern with secrets (e.g. `BASE_URL` / `WS_URL`) and a runner that can reach your network, or call `k6 run` from your existing pipeline with `scenarios/http-api/ramp-up.js` and your SLOs.

## Project Structure Decisions

**Why centralized thresholds?**
Scattered thresholds per file create drift — one scenario has strict SLOs, another is lax.
`lib/thresholds.js` is the single source of truth. If SLOs change, one file changes.

**Why separate HTTP and WebSocket scenarios?**
They have fundamentally different failure modes. HTTP tests surface latency and error rates.
WebSocket tests surface connection handling, message delivery, and race conditions.
Mixing them obscures which layer is failing.

**Why a soak test?**
Ramp-up and spike tests don't catch gradual degradation — memory leaks,
connection pool exhaustion, and GC pressure only appear over time.
The soak test holds load for 20+ minutes to surface these patterns.
