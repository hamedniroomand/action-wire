import type { ContextItem } from '~/core';

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
        const chip = el('span', 'context-chip');
        const label = document.createElement('span');
        label.className = 'context-label';
        label.textContent = item.label;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'context-remove';
        remove.setAttribute('aria-label', `Remove ${item.label}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          handlers.remove(item.id);
          handlers.focusComposer();
        });
        chip.append(label, remove);
        row.append(chip);
      }
    },
  };
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
