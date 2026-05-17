export class GracefulDrain {
  private activeExecutions = 0;
  private restarting = false;
  private timeoutMs: number;

  constructor(options: { timeoutMs: number }) {
    this.timeoutMs = options.timeoutMs;
  }

  startExecution(): boolean {
    if (this.restarting) return false;
    this.activeExecutions++;
    return true;
  }

  endExecution(): void {
    this.activeExecutions--;
  }

  async drain(stopFn: () => Promise<void>): Promise<void> {
    if (this.restarting) return;
    this.restarting = true;

    const deadline = Date.now() + this.timeoutMs;
    while (this.activeExecutions > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100));
    }

    await stopFn();
    this.restarting = false;
  }

  reset(): void {
    this.restarting = false;
    this.activeExecutions = 0;
  }

  get isDraining(): boolean {
    return this.restarting;
  }
}
