import WebSocket from 'ws';
import type { AccountConfig, NormalizedAccountEvent } from '../config/accountConfig.js';
import { MessageQueue } from './messageQueue.js';
import { HeartbeatManager } from './heartbeatManager.js';
import { ReconnectManager } from './reconnectManager.js';
import { RateLimitManager } from './rateLimitManager.js';
import { SessionRotator } from './sessionRotator.js';

export type AccountConnectorAdapter = {
  name: string;
  buildUrl(config: AccountConfig): Promise<string> | string;
  authenticate?(socket: WebSocket, config: AccountConfig): Promise<void> | void;
  createPingMessage?(): unknown;
  isPongMessage?(raw: unknown): boolean;
  refreshSession?(): Promise<void>;
  normalizeMessage(raw: unknown, receivedAt: number): NormalizedAccountEvent | null;
};

export class WebsocketClient {
  private socket: WebSocket | null = null;
  private readonly heartbeatManager: HeartbeatManager;
  private readonly reconnectManager: ReconnectManager;
  private readonly rateLimitManager: RateLimitManager;
  private readonly sessionRotator: SessionRotator;

  constructor(
    private readonly config: AccountConfig,
    private readonly adapter: AccountConnectorAdapter,
    private readonly queue: MessageQueue<NormalizedAccountEvent>
  ) {
    this.heartbeatManager = new HeartbeatManager(
      config.heartbeat.ping_interval_seconds * 1000,
      config.heartbeat.pong_timeout_seconds * 1000,
      () => this.sendPing(),
      () => this.forceReconnect('missed_pong')
    );
    this.reconnectManager = new ReconnectManager(config.reconnect_policy);
    this.rateLimitManager = new RateLimitManager(
      config.rate_limits.max_connections_per_5min,
      config.rate_limits.max_inbound_msg_per_second
    );
    this.sessionRotator = new SessionRotator(
      config.session_rotation.rotate_before_hours,
      async () => {
        await this.adapter.refreshSession?.();
        this.forceReconnect('session_rotation');
      }
    );
  }

  async connect() {
    this.rateLimitManager.markConnectionAttempt();
    const url = await this.adapter.buildUrl(this.config);
    this.socket = new WebSocket(url);

    this.socket.on('open', async () => {
      await this.adapter.authenticate?.(this.socket as WebSocket, this.config);
      this.reconnectManager.recordSuccessfulAuth();
      this.heartbeatManager.start();
      this.sessionRotator.schedule();
    });

    this.socket.on('message', raw => {
      const receivedAt = Date.now();
      this.rateLimitManager.markInboundMessage(receivedAt);
      const parsed = this.safeParse(raw);

      if (this.adapter.isPongMessage?.(parsed)) {
        this.heartbeatManager.recordPong();
        return;
      }

      const event = this.adapter.normalizeMessage(parsed, receivedAt);
      if (event) {
        this.queue.enqueue(event, receivedAt);
      }
    });

    this.socket.on('pong', () => {
      this.heartbeatManager.recordPong();
    });

    this.socket.on('error', error => {
      this.heartbeatManager.markDegraded();
      this.reconnectManager.recordReconnect('socket_error', error);
    });

    this.socket.on('close', () => {
      this.heartbeatManager.markDisconnected();
      this.scheduleReconnect('socket_close');
    });
  }

  disconnect() {
    this.heartbeatManager.stop();
    this.sessionRotator.stop();
    this.socket?.close();
    this.socket = null;
  }

  private sendPing() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const pingMessage = this.adapter.createPingMessage?.();
    if (pingMessage) {
      this.socket.send(JSON.stringify(pingMessage));
      return;
    }
    this.socket.ping();
  }

  private forceReconnect(reason: string) {
    this.disconnect();
    this.scheduleReconnect(reason);
  }

  private scheduleReconnect(reason: string) {
    this.heartbeatManager.markReconnecting();
    this.reconnectManager.recordReconnect(reason);
    const delay = this.reconnectManager.nextDelayMs();
    setTimeout(() => {
      void this.connect().catch(error => {
        this.heartbeatManager.markFailed();
        this.reconnectManager.recordReconnect('connect_failure', error);
      });
    }, delay);
  }

  private safeParse(raw: WebSocket.RawData) {
    if (Buffer.isBuffer(raw)) {
      return JSON.parse(raw.toString('utf8'));
    }
    return JSON.parse(String(raw));
  }
}
