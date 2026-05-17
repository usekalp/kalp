import chokidar from "chokidar";
import type { RuntimeFileEvent } from "../types";

const DEBOUNCE_MS = 450;

export interface RuntimeWatcherOptions {
  paths: string[];
  ignored: (string | RegExp)[];
  onEvent: (events: RuntimeFileEvent[]) => void;
}

export class RuntimeWatcher {
  private watcher: ReturnType<typeof chokidar.watch> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private pending = new Set<string>();
  private options: RuntimeWatcherOptions;

  constructor(options: RuntimeWatcherOptions) {
    this.options = options;
  }

  start(): void {
    this.watcher = chokidar.watch(this.options.paths, {
      ignoreInitial: true,
      persistent: true,
      usePolling: false,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 20 },
      ignored: this.options.ignored,
    });

    const flush = () => {
      if (this.pending.size === 0) return;
      const events: RuntimeFileEvent[] = Array.from(this.pending).map((path) => ({
        path,
        type: "change",
        timestamp: Date.now(),
      }));
      this.pending.clear();
      this.options.onEvent(events);
    };

    this.watcher.on("all", (_event, changedPath) => {
      this.pending.add(changedPath);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(flush, DEBOUNCE_MS);
    });
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.watcher?.close();
  }
}
