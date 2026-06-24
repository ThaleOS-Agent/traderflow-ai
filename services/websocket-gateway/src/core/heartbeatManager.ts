import type { ConnectionState } from '../config/accountConfig.js';

export type HeartbeatSnapshot = {
  state: ConnectionState;
  lastPingAt: number | null;
  lastPongAt: number | null;
  missedPongs: number;
};

export class HeartbeatManager {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private lastPingAt: number | null = null;
  private lastPongAt: number | null = null;
  private missedPongs = 0;
  private state: ConnectionState = 'DISCONNECTED';

  constructor(
    private readonly pingIntervalMs: number,
    private readonly pongTimeoutMs: number,
    private readonly sendPing: () => void,
    private readonly onMissedPong: () => void
  ) {}

  start() {
    this.stop();
    this.state = 'HEALTHY';

    this.heartbeatTimer = setInterval(() => {
      this.lastPingAt = Date.now();
      this.sendPing();
      this.pongTimer = setTimeout(() => {
        if (!this.lastPongAt || this.lastPongAt < (this.lastPingAt ?? 0)) {
          this.missedPongs += 1;
          this.state = 'STALE';
          this.onMissedPong();
        }
      }, this.pongTimeoutMs);
    }, this.pingIntervalMs);
  }

  recordPong() {
    this.lastPongAt = Date.now();
    this.state = 'HEALTHY';
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  markDegraded() {
    if (this.state === 'HEALTHY') {
      this.state = 'DEGRADED';
    }
  }

  markDisconnected() {
    this.state = 'DISCONNECTED';
  }

  markReconnecting() {
    this.state = 'RECONNECTING';
  }

  markFailed() {
    this.state = 'FAILED';
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  snapshot(): HeartbeatSnapshot {
    return {
      state: this.state,
      lastPingAt: this.lastPingAt,
      lastPongAt: this.lastPongAt,
      missedPongs: this.missedPongs
    };
  }
}
