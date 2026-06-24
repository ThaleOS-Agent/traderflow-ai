import type { NormalizedAccountEvent } from '../config/accountConfig.js';
import type { MessageQueue } from '../core/messageQueue.js';

export class AccountEventWorker {
  constructor(private readonly queue: MessageQueue<NormalizedAccountEvent>) {}

  async run(handler: (event: NormalizedAccountEvent) => Promise<void> | void) {
    while (true) {
      const { payload } = await this.queue.dequeue();
      if (payload.eventType === 'ACCOUNT_UPDATE' || payload.eventType === 'BALANCE_UPDATE' || payload.eventType === 'POSITION_UPDATE' || payload.eventType === 'MARGIN_UPDATE') {
        await handler(payload);
      }
    }
  }
}
