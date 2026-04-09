/**
 * HTTP Soak Scenario
 *
 * Purpose: Detect slow degradation under sustained load over time.
 * Catches: Memory leaks, connection pool exhaustion, GC pressure,
 *          database connection leaks, and gradual response time drift.
 *
 * Why ramp-up tests miss this: A 10-minute ramp-up won't fill a memory pool
 * that leaks 1MB per minute. After 30 minutes at steady state, the leak shows.
 *
 * Stages:
 *   0–5 min:  Ramp to 100 VUs
 *   5–25 min: Hold at 100 VUs (watch p95 — it should stay flat, not drift up)
 *   25–30 min: Ramp down to 0
 *
 * What to watch:
 *   - p95 response time: Should remain flat. Upward drift = degradation.
 *   - Error rate: Any increase after minute 10 = resource exhaustion.
 *   - http_reqs rate: Should remain stable. Drop = throughput degradation.
 *
 * Pass criteria: Same strict SLOs as ramp-up, held for 20+ minutes.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { httpThresholds } from '../../lib/thresholds.js';
import { getBaseUrl, randomBetween, logUnexpected } from '../../lib/helpers.js';

export const options = {
  stages: [
    { duration: '5m', target: 100 },
    { duration: '20m', target: 100 },
    { duration: '5m', target: 0 },
  ],
  thresholds: httpThresholds,
};

const BASE_URL = getBaseUrl();

export default function () {
  // Batch multiple endpoints to simulate realistic mixed traffic
  // rather than hammering a single route
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/health`, null, { tags: { scenario: 'soak', endpoint: 'health' } }],
    ['GET', `${BASE_URL}/api/status`, null, { tags: { scenario: 'soak', endpoint: 'status' } }],
  ]);

  responses.forEach((res, i) => {
    check(res, {
      [`[batch ${i}] status 200`]: (r) => r.status === 200,
      [`[batch ${i}] < 200ms`]: (r) => r.timings.duration < 200,
    });
    logUnexpected(`soak-batch-${i}`, res);
  });

  sleep(randomBetween(1, 2));
}
