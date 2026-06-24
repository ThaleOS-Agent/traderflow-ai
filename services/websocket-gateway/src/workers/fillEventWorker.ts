import type { NormalizedAccountEvent } from '../config/accountConfig.js';
import type { MessageQueue } from '../core/messageQueue.js';

export class FillEventWorker {
  constructor(private readonly queue: MessageQueue<NormalizedAccountEvent>) {}

  async run(handler: (event: NormalizedAccountEvent) => Promise<void> | void) {
    while (true) {
      const { payload } = await this.queue.dequeue();
      if (payload.eventType === 'ORDER_FILLED' || payload.eventType === 'ORDER_PARTIAL_FILL') {
        await handler(payload);
      }
    }
  }
}
