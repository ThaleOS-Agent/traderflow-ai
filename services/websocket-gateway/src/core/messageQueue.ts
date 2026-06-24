export type QueueMessage<T> = {
  payload: T;
  receivedAt: number;
};

export class MessageQueue<T> {
  private readonly items: QueueMessage<T>[] = [];
  private readonly waiters: Array<(item: QueueMessage<T>) => void> = [];
  private dropped = 0;

  constructor(
    readonly name: string,
    private readonly maxSize = 10000
  ) {}

  enqueue(payload: T, receivedAt = Date.now()) {
    const item = { payload, receivedAt };

    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.(item);
      return;
    }

    if (this.items.length >= this.maxSize) {
      this.items.shift();
      this.dropped += 1;
    }

    this.items.push(item);
  }

  dequeue(): Promise<QueueMessage<T>> {
    if (this.items.length > 0) {
      return Promise.resolve(this.items.shift() as QueueMessage<T>);
    }

    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }

  stats() {
    return {
      name: this.name,
      depth: this.items.length,
      dropped: this.dropped
    };
  }
}
