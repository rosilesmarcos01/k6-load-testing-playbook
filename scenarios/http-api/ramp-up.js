/**
 * HTTP Ramp-up Scenario
 *
 * Purpose: Gradually increase virtual users to find system capacity ceiling.
 * Use this for: Baseline capacity planning before releases or traffic events.
 *
 * Stages:
 *   0–2 min:  Warm up to 50 VUs  (allows JIT, connection pools to stabilize)
 *   2–7 min:  Ramp to 200 VUs    (target production-equivalent load)
 *   7–12 min: Hold at 200 VUs    (sustained load — watch for drift in p95)
 *   12–14 min: Ramp down to 0    (clean shutdown)
 *
 * Pass criteria: p95 < 200ms, error rate < 1%, throughput > 100 req/s
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { httpThresholds } from '../../lib/thresholds.js';
import { getBaseUrl, randomBetween, logUnexpected } from '../../lib/helpers.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  thresholds: httpThresholds,
};

const BASE_URL = getBaseUrl();

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { scenario: 'ramp-up' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has response body': (r) => r.body && r.body.length > 0,
  });

  logUnexpected('ramp-up', res);

  // Jitter prevents all VUs from hitting the server at the exact same millisecond
  sleep(randomBetween(1, 3));
}
