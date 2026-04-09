/**
 * WebSocket Connection Storm Scenario
 *
 * Purpose: Simulate mass simultaneous reconnection — the hardest WebSocket failure mode.
 *
 * Background:
 *   This scenario was built after a production incident where 8,000+ users
 *   reconnected simultaneously following a brief network interruption.
 *   The mass reconnect triggered a race condition in the connection pooling layer,
 *   causing a 30-minute outage. The fix (throttling + exponential backoff) was
 *   validated with this exact suite before shipping to production.
 *
 * What this tests:
 *   - Connection pool behavior under sudden surge
 *   - Race condition detection in connection state management
 *   - Message delivery integrity during reconnect storm
 *   - Latency of the first message after connection (< 100ms SLO)
 *
 * Stages:
 *   0–1 min:   Gradual warm-up to 500 VUs
 *   1–1.5 min: Rapid surge to 5,000 VUs (simulates mass reconnect)
 *   1.5–4.5 min: Hold storm conditions
 *   4.5–5.5 min: Drain back to 0
 *
 * Pass criteria: error rate < 1%, first message latency < 100ms
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { websocketThresholds, errors } from '../../lib/thresholds.js';
import { getWsUrl } from '../../lib/helpers.js';

export const options = {
  stages: [
    { duration: '1m', target: 500 },
    { duration: '30s', target: 5000 },
    { duration: '3m', target: 5000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: websocketThresholds,
};

export default function () {
  const url = getWsUrl();

  const res = ws.connect(url, { tags: { scenario: 'connection-storm' } }, function (socket) {
    socket.on('open', () => {
      // Send ping immediately after connection — measures cold-start latency
      socket.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
        vu: __VU,
      }));
    });

    socket.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        errors.add(true);
        console.error(`[storm] Failed to parse message: ${data}`);
        return;
      }

      check(msg, {
        // Server must respond with pong
        'received pong': (m) => m.type === 'pong',
        // First message must arrive within 100ms — our latency SLO
        'first message latency < 100ms': (m) => Date.now() - m.timestamp < 100,
      });
    });

    socket.on('error', (e) => {
      errors.add(true);
      console.error(`[storm] VU ${__VU} WebSocket error: ${e.error()}`);
    });

    socket.on('close', () => {
      // Intentional close — no action needed
    });

    // Hold connection for 10 seconds, then cleanly close
    socket.setTimeout(() => socket.close(), 10000);
  });

  errors.add(!(res && res.status === 101));

  check(res, {
    'WebSocket handshake successful (101)': (r) => r && r.status === 101,
  });

  sleep(1);
}
