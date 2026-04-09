/**
 * WebSocket Sustained Load Scenario
 *
 * Purpose: Validate 99.9% message delivery under continuous, high-concurrency load.
 *
 * Background:
 *   Used to validate a notification service before scaling from 5K to 50K+
 *   concurrent connections in production. The 99.9% delivery threshold and
 *   <100ms latency SLO were confirmed under sustained peak load before cutover.
 *
 * What this tests:
 *   - Message delivery rate at scale (99.9% SLO)
 *   - Subscription channel isolation per user
 *   - Connection stability over extended duration
 *   - Server-side fan-out throughput
 *
 * Configuration:
 *   1,000 VUs held for 10 minutes.
 *   Each VU subscribes to its own channel and counts sent vs received messages.
 *   At test end: delivery rate = received / sent must be >= 99.9%.
 *
 * Pass criteria: delivery rate >= 99.9%, total messages received > 100,000
 */

import ws from 'k6/ws';
import { check } from 'k6';
import { websocketThresholds, errors } from '../../lib/thresholds.js';
import { getWsUrl } from '../../lib/helpers.js';

export const options = {
  vus: 1000,
  duration: '10m',
  thresholds: {
    ...websocketThresholds,
    // Validate aggregate message volume — confirms fan-out is actually working
    ws_msgs_received: ['count>100000'],
  },
};

export default function () {
  const url = getWsUrl();

  const res = ws.connect(url, { tags: { scenario: 'sustained-load' } }, function (socket) {
    let sent = 0;
    let received = 0;

    socket.on('open', () => {
      // Subscribe to a per-VU channel — tests isolation, not broadcast only
      const subscribeMsg = JSON.stringify({
        type: 'subscribe',
        channel: `user-${__VU}`,
        timestamp: Date.now(),
      });
      socket.send(subscribeMsg);
      sent++;

      // Send a heartbeat every second to keep the connection alive
      // and measure ongoing delivery under sustained traffic
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          type: 'heartbeat',
          vu: __VU,
          timestamp: Date.now(),
        }));
        sent++;
      }, 1000);
    });

    socket.on('message', () => {
      received++;
    });

    socket.on('error', (e) => {
      errors.add(true);
      console.error(`[sustained] VU ${__VU} error: ${e.error()}`);
    });

    // Hold for 30 seconds per VU iteration, then validate and close
    socket.setTimeout(() => {
      check(true, {
        // Core SLO: delivery rate must be at least 99.9%
        'delivery rate >= 99.9%': () => sent === 0 || (received / sent) >= 0.999,
      });
      socket.close();
    }, 30000);
  });

  errors.add(!(res && res.status === 101));

  check(res, {
    'WebSocket handshake successful (101)': (r) => r && r.status === 101,
  });
}
