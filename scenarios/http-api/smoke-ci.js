/**
 * HTTP CI Smoke — short run against a real public HTTPS API.
 *
 * Purpose: Prove in GitHub Actions that k6 installs, imports resolve, thresholds
 * evaluate, and JSON output is written — without requiring your app on localhost.
 *
 * Default target: https://test-api.k6.io (Grafana-maintained demo API for k6).
 * Override: BASE_URL=https://your-staging.example k6 run scenarios/http-api/smoke-ci.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { ciSmokeThresholds } from '../../lib/thresholds.js';
import { randomBetween } from '../../lib/helpers.js';

export const options = {
  vus: 10,
  duration: '45s',
  thresholds: ciSmokeThresholds,
};

const BASE_URL = __ENV.BASE_URL || 'https://test-api.k6.io';

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/public/crocodiles/1/`, null, { tags: { scenario: 'smoke-ci', endpoint: 'crocodile-by-id' } }],
    ['GET', `${BASE_URL}/public/crocodiles/`, null, { tags: { scenario: 'smoke-ci', endpoint: 'crocodiles-list' } }],
  ]);

  responses.forEach((res, i) => {
    check(res, {
      [`[smoke ${i}] status 200`]: (r) => r.status === 200,
      [`[smoke ${i}] has body`]: (r) => r.body && r.body.length > 0,
    });
    if (res.status !== 200) {
      console.error(`[smoke-ci] unexpected status ${res.status} batch=${i}`);
    }
  });

  sleep(randomBetween(0.3, 1.2));
}
