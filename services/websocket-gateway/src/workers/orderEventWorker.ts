import type { NormalizedAccountEvent } from '../config/accountConfig.js';
import type { MessageQueue } from '../core/messageQueue.js';

export class OrderEventWorker {
  constructor(private readonly queue: MessageQueue<NormalizedAccountEvent>) {}

  async run(handler: (event: NormalizedAccountEvent) => Promise<void> | void) {
    while (true) {
      const { payload } = await this.queue.dequeue();
      if (payload.eventType === 'ORDER_NEW' || payload.eventType === 'ORDER_UPDATE' || payload.eventType === 'ORDER_CANCELLED' || payload.eventType === 'ORDER_REJECTED') {
        await handler(payload);
      }
    }
  }
}
