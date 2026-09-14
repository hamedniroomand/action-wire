import type { ContextItem } from '~/core';
import { button, el, text } from '~/widget/dom';

export type ContextHandlers = {
  remove: (id: string) => void;
  focusComposer: () => void;
};

export type ContextRow = {
  sync(items: readonly ContextItem[]): void;
};

export function createContextRow(root: ParentNode, handlers: ContextHandlers): ContextRow {
  const row = el('div', 'context-row');
  row.hidden = true;
  row.setAttribute('aria-label', 'Attached context');
  root.append(row);

  return {
    sync(items) {
      row.replaceChildren();
      if (items.length === 0) {
        row.hidden = true;
        return;
      }
      row.hidden = false;
      for (const item of items) {
        row.append(chip(item, handlers));
      }
    },
  };
}

function chip(item: ContextItem, handlers: ContextHandlers): HTMLElement {
  const node = el('span', 'context-chip');
  const remove = button('context-remove', `Remove ${item.label}`);
  remove.textContent = '×';
  remove.addEventListener('click', () => {
    handlers.remove(item.id);
    handlers.focusComposer();
  });
  node.append(text('span', 'context-label', item.label), remove);
  return node;
}
