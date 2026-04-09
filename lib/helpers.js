/**
 * Shared utility functions for k6 scenarios.
 * Import these in any scenario to avoid repetition.
 */

/**
 * Returns the base URL from environment variable or falls back to localhost.
 * Usage: k6 run -e BASE_URL=https://staging.api.com scenario.js
 */
export function getBaseUrl() {
  return __ENV.BASE_URL || 'http://localhost:3000';
}

/**
 * Returns the WebSocket URL from environment variable or falls back to localhost.
 * Usage: k6 run -e WS_URL=wss://staging.api.com/ws scenario.js
 */
export function getWsUrl() {
  return __ENV.WS_URL || 'ws://localhost:3000/ws';
}

/**
 * Returns a random integer between min and max (inclusive).
 * Used to add jitter to sleep intervals — avoids thundering herd
 * patterns in the test itself masking real system behavior.
 */
export function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Logs unexpected responses without crashing the test.
 * k6 runs are long — silent failures hide real issues.
 */
export function logUnexpected(tag, res) {
  if (res.status !== 200) {
    console.error(`[${tag}] Unexpected status ${res.status} | body: ${res.body?.slice(0, 200)}`);
  }
}
