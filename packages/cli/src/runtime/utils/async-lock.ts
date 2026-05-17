export class AsyncLock {
  private locks = new Map<string, Promise<void>>();

  async acquire<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.locks.get(key);
    const promise = (async () => {
      if (existing) await existing;
      return fn();
    })();
    this.locks.set(key, promise.then(() => {}, () => {}));
    return promise;
  }
}
