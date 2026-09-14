import { freeze } from '~/core/json';
import type { ContextItem, ContextSource } from '~/core/types';

export type ContextController = {
  live(): readonly ContextItem[];
  captureForSend(): readonly ContextItem[];
  remove(id: string): void;
  reset(): void;
  dispose(): void;
};

function identity(item: ContextItem): string {
  return `${item.id}\0${item.resource}\0${item.version}`;
}

function copyItem(item: ContextItem): ContextItem {
  const copy: ContextItem = {
    id: item.id,
    label: item.label,
    resource: item.resource,
    version: item.version,
  };
  if (item.kind !== undefined) copy.kind = item.kind;
  return copy;
}

function noop(): void {}

export function createContextController(source: ContextSource | undefined): ContextController {
  const dismissed = new Set<string>();
  let items: ContextItem[] = [];
  let stop: () => void = noop;

  function refresh(): void {
    if (source === undefined) {
      items = [];
      return;
    }
    items = source.read().items.map((item) => freeze(copyItem(item)));
  }

  function visible(from: readonly ContextItem[]): ContextItem[] {
    return from.filter((item) => !dismissed.has(identity(item)));
  }

  refresh();
  if (source !== undefined) {
    stop = source.subscribe(refresh);
  }

  return {
    live: () => visible(items),
    captureForSend: () => visible(items),
    remove(id: string) {
      for (const item of visible(items)) {
        if (item.id === id) {
          dismissed.add(identity(item));
          return;
        }
      }
    },
    reset() {
      dismissed.clear();
    },
    dispose() {
      stop();
    },
  };
}

export function snapshotItems(items: readonly ContextItem[]): readonly ContextItem[] {
  return freeze(items.map((item) => freeze(copyItem(item))));
}
