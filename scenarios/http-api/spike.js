/**
 * HTTP Spike Scenario
 *
 * Purpose: Simulate a sudden, unexpected traffic surge.
 * Use this for: Testing system elasticity, auto-scaling response time,
 *               and circuit breaker behavior under sudden load.
 *
 * Real-world trigger: Marketing campaign goes viral, product launch,
 *                     or traffic redirected from a failed upstream service.
 *
 * Stages:
 *   0–1 min:  Normal baseline (10 VUs)
 *   1–1.5 min: Spike to 500 VUs in 30 seconds (the surge)
 *   1.5–3.5 min: Hold spike (watch: does system recover or degrade?)
 *   3.5–4 min: Drop back to 10 VUs
 *   4–5 min:  Cool down to 0
 *
 * Pass criteria: p95 < 300ms (relaxed vs ramp-up), error rate < 1%
 * Note: p99 is relaxed to 1000ms — brief queuing during spike onset is acceptable.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { spikeThresholds } from '../../lib/thresholds.js';
import { getBaseUrl, logUnexpected } from '../../lib/helpers.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '30s', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '30s', target: 10 },
    { duration: '1m', target: 0 },
  ],
  thresholds: spikeThresholds,
};

const BASE_URL = getBaseUrl();

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { scenario: 'spike' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'not a 5xx error': (r) => r.status < 500,
  });

  logUnexpected('spike', res);
  sleep(0.5);
}
