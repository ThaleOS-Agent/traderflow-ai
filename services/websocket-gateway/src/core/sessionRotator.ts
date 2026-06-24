export class SessionRotator {
  private rotationTimer: NodeJS.Timeout | null = null;
  private readonly rotateBeforeMs: number;

  constructor(
    rotateBeforeHours: number,
    private readonly onRotate: () => Promise<void> | void
  ) {
    this.rotateBeforeMs = rotateBeforeHours * 60 * 60 * 1000;
  }

  schedule() {
    this.stop();
    this.rotationTimer = setTimeout(() => {
      void this.onRotate();
    }, this.rotateBeforeMs);
  }

  nextRotationAt(from = Date.now()) {
    return from + this.rotateBeforeMs;
  }

  stop() {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
  }
}
