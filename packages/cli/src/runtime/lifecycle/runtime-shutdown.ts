export class RuntimeShutdown {
  private disposables: Array<() => void | Promise<void>> = [];
  private boundSigint: () => void;
  private boundSigterm: () => void;
  private installed = false;

  constructor(onShutdown: () => void) {
    this.boundSigint = () => void onShutdown();
    this.boundSigterm = () => void onShutdown();
  }

  installSignalHandlers(): void {
    if (this.installed) return;
    this.installed = true;
    process.on("SIGINT", this.boundSigint);
    process.on("SIGTERM", this.boundSigterm);
  }

  register(dispose: () => void | Promise<void>): void {
    this.disposables.push(dispose);
  }

  async dispose(): Promise<void> {
    process.off("SIGINT", this.boundSigint);
    process.off("SIGTERM", this.boundSigterm);
    this.installed = false;

    for (const dispose of this.disposables) {
      try {
        await dispose();
      } catch {
        // best effort cleanup
      }
    }
    this.disposables = [];
  }
}
