import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

test('runs the built package, invokes the host handler, and destroys the widget', async ({
  page,
}) => {
  await page.route('**/api/assistant', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const payload: unknown = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(scriptedTurn(payload)),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();
  await send(page, 'Ping.');
  await expect
    .poll(async () => page.evaluate(() => Reflect.get(globalThis, '__pinged')))
    .toBe(true);
  await page.getByRole('button', { name: 'Destroy assistant' }).click();
  await expect(page.locator('action-wire')).toHaveCount(0);
});

test('does not depend on React, Vue, or Svelte', async () => {
  const raw = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
    'utf8',
  );
  const pkg: unknown = JSON.parse(raw);
  const record = typeof pkg === 'object' && pkg !== null ? pkg : {};
  const dependencies = {
    ...readDeps(record, 'dependencies'),
    ...readDeps(record, 'devDependencies'),
  };
  expect(dependencies['react']).toBeUndefined();
  expect(dependencies['vue']).toBeUndefined();
  expect(dependencies['svelte']).toBeUndefined();
});

async function send(page: Page, text: string): Promise<void> {
  await page.locator('action-wire').evaluate((node, value) => {
    const field = node.shadowRoot?.querySelector('input[aria-label="Message"]');
    if (!(field instanceof HTMLInputElement)) throw new Error('The input is missing.');
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
  if (role === 'tool') return { choices: [{ message: { content: 'pong' } }] };
  return {
    choices: [
      {
        message: {
          content: '',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: { name: 'ping', arguments: '{}' },
            },
          ],
        },
      },
    ],
  };
}

function readDeps(record: object, key: string): Record<string, unknown> {
  const value = Reflect.get(record, key);
  if (typeof value !== 'object' || value === null) return {};
  return { ...value };
}
