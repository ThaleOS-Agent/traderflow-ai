import type { NormalizedAccountEvent } from '../config/accountConfig.js';
import type { MessageQueue } from '../core/messageQueue.js';

export class RiskEventWorker {
  constructor(private readonly queue: MessageQueue<NormalizedAccountEvent>) {}

  async run(handler: (event: NormalizedAccountEvent) => Promise<void> | void) {
    while (true) {
      const { payload } = await this.queue.dequeue();
      if (payload.eventType === 'RISK_EVENT' || payload.eventType === 'AUTH_FAILURE' || payload.eventType === 'RECONNECT' || payload.eventType === 'HEARTBEAT') {
        await handler(payload);
      }
    }
  }
}
