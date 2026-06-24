export class RateLimitManager {
  private readonly connectionAttempts: number[] = [];
  private readonly inboundMessageSecond = new Map<number, number>();

  constructor(
    private readonly maxConnectionsPer5Min: number,
    private readonly maxInboundMessagesPerSecond: number
  ) {}

  markConnectionAttempt(now = Date.now()) {
    this.connectionAttempts.push(now);
    this.compact(now);
    if (this.connectionAttempts.length > this.maxConnectionsPer5Min) {
      throw new Error('Connection rate limit exceeded');
    }
  }

  markInboundMessage(now = Date.now()) {
    const second = Math.floor(now / 1000);
    const nextCount = (this.inboundMessageSecond.get(second) ?? 0) + 1;
    this.inboundMessageSecond.set(second, nextCount);
    this.compact(now);

    if (nextCount > this.maxInboundMessagesPerSecond) {
      throw new Error('Inbound message rate limit exceeded');
    }
  }

  private compact(now: number) {
    const threshold = now - (5 * 60 * 1000);
    while (this.connectionAttempts[0] && this.connectionAttempts[0] < threshold) {
      this.connectionAttempts.shift();
    }

    const oldestSecond = Math.floor(now / 1000) - 5;
    for (const second of this.inboundMessageSecond.keys()) {
      if (second < oldestSecond) {
        this.inboundMessageSecond.delete(second);
      }
    }
  }
}
