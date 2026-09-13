import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

test('updates reactive state from the existing handler', async ({ page }) => {
  await page.route('**/api/assistant', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(scriptedTurn(route.request().postDataJSON())),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();
  await send(page, 'Ready.');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Status: ready')).toBeVisible();
});

test('does not duplicate registrations or widgets on unmount and remount', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open assistant' })).toBeVisible();
  expect(await page.locator('action-wire').count()).toBe(1);
  expect(await toolNames(page)).toEqual(['setStatus']);
  await page.getByRole('button', { name: 'Unmount' }).click();
  await expect(page.locator('action-wire')).toHaveCount(0);
  expect(await toolNames(page)).toEqual([]);
  await page.getByRole('button', { name: 'Mount' }).click();
  await expect(page.getByRole('button', { name: 'Open assistant' })).toBeVisible();
  expect(await page.locator('action-wire').count()).toBe(1);
  expect(await toolNames(page)).toEqual(['setStatus']);
});

test('uses the same built library output as Vanilla, React, and Vue', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  const configs = await Promise.all(
    ['vanilla', 'react', 'vue', 'svelte'].map((name) =>
      readFile(join(root, 'examples', name, 'vite.config.ts'), 'utf8'),
    ),
  );
  for (const text of configs) {
    expect(text).toContain('widget/dist/index.js');
    expect(text).toContain('agent/dist/index.js');
    expect(text).not.toContain('widget/src/index.ts');
  }
});

async function toolNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const context = Reflect.get(document, 'modelContext');
    if (typeof context !== 'object' || context === null) return [];
    const getTools = Reflect.get(context, 'getTools');
    if (typeof getTools !== 'function') return [];
    const tools: unknown = await getTools.call(context);
    if (!Array.isArray(tools)) return [];
    return tools.flatMap((tool) => {
      if (typeof tool !== 'object' || tool === null) return [];
      const name = Reflect.get(tool, 'name');
      return typeof name === 'string' ? [name] : [];
    });
  });
}

async function send(page: Page, text: string): Promise<void> {
  await page.locator('action-wire').evaluate((node, value) => {
    const field = node.shadowRoot?.querySelector('textarea');
    if (!(field instanceof HTMLTextAreaElement)) throw new Error('The composer is missing.');
    field.value = value;
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
  }, text);
}

function scriptedTurn(payload: unknown): object {
  const messages =
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray(Reflect.get(payload, 'messages'))
      ? Reflect.get(payload, 'messages')
      : [];
  const last = Array.isArray(messages) ? messages.at(-1) : undefined;
  const role = typeof last === 'object' && last !== null ? Reflect.get(last, 'role') : undefined;
  if (role === 'tool') return { choices: [{ message: { content: 'ready' } }] };
  return {
    choices: [
      {
        message: {
          content: '',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: { name: 'setStatus', arguments: JSON.stringify({ name: 'ready' }) },
            },
          ],
        },
      },
    ],
  };
}
