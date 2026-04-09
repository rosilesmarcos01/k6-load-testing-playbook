/**
 * Centralized SLO thresholds for all k6 scenarios.
 *
 * Centralizing thresholds prevents drift between scenarios and ensures
 * a single source of truth for what "passing" means. Adjust these values
 * to match your system's SLA commitments.
 *
 * k6 will exit with a non-zero code if any threshold is breached,
 * automatically failing the CI build.
 */

import { Rate } from 'k6/metrics';

/**
 * WebSocket error sampling for threshold `errors` (handshake failures, socket errors, parse errors).
 * k6 has no built-in WebSocket error Rate; scenarios call errors.add(isError).
 */
export const errors = new Rate('errors');

export const httpThresholds = {
  // p95 under 200ms is the standard for interactive APIs
  // p99 under 500ms catches outlier spikes without over-tightening
  http_req_duration: ['p(95)<200', 'p(99)<500'],

  // Less than 1% of requests should fail under any load scenario
  http_req_failed: ['rate<0.01'],

  // Minimum throughput validates the system isn't bottlenecked
  http_reqs: ['rate>100'],
};

export const spikeThresholds = {
  // Relax p99 slightly for spike scenarios — sudden surges cause brief queuing
  // p95 remains strict to catch sustained degradation
  http_req_duration: ['p(95)<300', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
};

/**
 * Thresholds for CI smoke runs against the public Grafana test API (internet + shared infra).
 * Not a substitute for SLOs on your own stack — proves scripts execute and k6 gates work.
 */
export const ciSmokeThresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<4000', 'p(99)<10000'],
  http_reqs: ['rate>0.5'],
};

export const websocketThresholds = {
  // WebSocket sessions should stay open for the test duration
  ws_session_duration: ['p(95)<5000'],

  // Any WebSocket error is a concern — keep below 1%
  errors: ['rate<0.01'],
};
