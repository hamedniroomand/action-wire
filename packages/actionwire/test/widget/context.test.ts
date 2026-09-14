// @vitest-environment happy-dom

import { expect, it, vi } from 'vitest';

import type { ContextItem } from '~/core';
import { createContextRow } from '~/widget/context';

it('renders removable chips with accessible remove labels', () => {
  const remove = vi.fn();
  const root = document.createElement('div');
  const row = createContextRow(root, { remove, focusComposer: () => {} });
  const items: ContextItem[] = [
    { id: 'a', label: 'Weekly revenue', resource: 'chart:1', version: '3' },
  ];
  row.sync(items);
  const rowEl = root.querySelector('.context-row');
  expect(rowEl instanceof HTMLElement && rowEl.hidden).toBe(false);
  expect(root.textContent).toContain('Weekly revenue');
  const button = root.querySelector('button[aria-label="Remove Weekly revenue"]');
  expect(button).toBeTruthy();
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(remove).toHaveBeenCalledWith('a');
});

it('hides the row when context is empty', () => {
  const root = document.createElement('div');
  const row = createContextRow(root, { remove: () => {}, focusComposer: () => {} });
  row.sync([]);
  const rowEl = root.querySelector('.context-row');
  expect(rowEl instanceof HTMLElement && rowEl.hidden).toBe(true);
});
