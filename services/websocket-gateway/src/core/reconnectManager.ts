import type { AccountConfig } from '../config/accountConfig.js';

export type ReconnectSnapshot = {
  reconnect_count: number;
  reconnect_reason: string | null;
  last_error: string | null;
  last_successful_auth: number | null;
  last_reconnect_time: number | null;
};

export class ReconnectManager {
  private reconnectCount = 0;
  private reconnectReason: string | null = null;
  private lastError: string | null = null;
  private lastSuccessfulAuth: number | null = null;
  private lastReconnectTime: number | null = null;

  constructor(private readonly config: AccountConfig['reconnect_policy']) {}

  nextDelayMs() {
    const baseSeconds = Math.min(
      this.config.initial_delay_seconds * (this.config.backoff_factor ** this.reconnectCount),
      this.config.max_delay_seconds
    );
    const [minJitter, maxJitter] = this.config.jitter_range;
    const jitter = minJitter + (Math.random() * (maxJitter - minJitter));
    return Math.round((baseSeconds * (1 + jitter)) * 1000);
  }

  recordReconnect(reason: string, error?: unknown) {
    this.reconnectCount += 1;
    this.reconnectReason = reason;
    this.lastError = error instanceof Error ? error.message : error ? String(error) : null;
    this.lastReconnectTime = Date.now();
  }

  recordSuccessfulAuth() {
    this.lastSuccessfulAuth = Date.now();
    this.lastError = null;
  }

  reset() {
    this.reconnectCount = 0;
    this.reconnectReason = null;
    this.lastError = null;
  }

  snapshot(): ReconnectSnapshot {
    return {
      reconnect_count: this.reconnectCount,
      reconnect_reason: this.reconnectReason,
      last_error: this.lastError,
      last_successful_auth: this.lastSuccessfulAuth,
      last_reconnect_time: this.lastReconnectTime
    };
  }
}
