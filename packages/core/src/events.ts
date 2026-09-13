export function createEmitter<T>() {
  const listeners = new Set<{ receive: (value: T) => void }>();
  return {
    subscribe(receive: (value: T) => void): () => void {
      const entry = { receive };
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
    emit(value: T): void {
      // Snapshot the set so new listeners wait for the next event.
      // oxlint-disable-next-line unicorn/no-useless-spread
      for (const entry of [...listeners]) {
        if (!listeners.has(entry)) continue;
        try {
          entry.receive(value);
        } catch {
          // A listener must not stop delivery to other listeners.
        }
      }
    },
    clear(): void {
      listeners.clear();
    },
  };
}
