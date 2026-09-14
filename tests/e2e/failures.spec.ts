import { expect, test, type Page } from '@playwright/test';

test('shows an unsupported message when the native API is absent', async ({ page }) => {
  await openCase(page, 'missing');
  await send(page, 'Hello');
  await expect(page.getByText('This browser does not support WebMCP.')).toBeVisible();
});

test('reports an unavailable tool when discovery returns none', async ({ page }) => {
  await openCase(page, 'empty');
  await send(page, 'List projects.');
  await openTranscript(page);
  await expect(
    page.locator('.tool-summary').filter({ hasText: 'This tool is not available.' }),
  ).toBeVisible();
});

test('shows a tool error when the handler rejects', async ({ page }) => {
  await openCase(page, 'reject');
  await send(page, 'List projects.');
  await openTranscript(page);
  await expect(page.locator('.tool-status', { hasText: 'Error' })).toBeVisible();
  await expect(page.locator('.tool-summary').filter({ hasText: 'The tool failed.' })).toBeVisible();
});

test('rejects malformed model arguments', async ({ page }) => {
  await openCase(page, 'invalid');
  await send(page, 'Rename it.');
  await openTranscript(page);
  await expect(
    page
      .locator('.tool-summary')
      .filter({ hasText: 'The tool arguments do not match the input schema.' }),
  ).toBeVisible();
});

test('shows a timeout when the model does not return', async ({ page }) => {
  await openCase(page, 'timeout');
  await send(page, 'Hello');
  await expect(statusLine(page)).toContainText('The assistant timed out.');
});

test('cancels an in-flight turn on abort', async ({ page }) => {
  await openCase(page, 'abort');
  await send(page, 'Hello');
  await expect(page.getByText('The assistant is thinking…')).toBeVisible();
  await page.evaluate(() => {
    const assistant = Reflect.get(globalThis, '__assistant');
    if (typeof assistant !== 'object' || assistant === null) throw new Error('missing assistant');
    const cancel = Reflect.get(assistant, 'cancel');
    if (typeof cancel !== 'function') throw new Error('missing cancel');
    cancel.call(assistant);
  });
  await expect(statusLine(page)).toContainText('The assistant was cancelled.');
});

test('does not run a stale confirmation after the tool list changes', async ({ page }) => {
  await openCase(page, 'stale');
  await send(page, 'Delete Phoenix.');
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  await page.evaluate(() => {
    const bump = Reflect.get(globalThis, '__bump');
    if (typeof bump !== 'function') throw new Error('missing bump');
    bump();
  });
  await page.getByRole('button', { name: 'Delete' }).click();
  await openTranscript(page);
  await expect(
    page
      .locator('.tool-summary')
      .filter({ hasText: 'The tool list changed. Discover tools again.' }),
  ).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => Reflect.get(globalThis, '__executed')))
    .toEqual([]);
});

test('drops page tools after navigation', async ({ page }) => {
  await openCase(page, 'navigate');
  await send(page, 'List projects.');
  await openTranscript(page);
  await expect(page.locator('.tool-name', { hasText: 'list' })).toBeVisible();
  await expect(page.locator('.tool-status', { hasText: 'Success' })).toBeVisible();
  await page.evaluate(() => {
    const navigate = Reflect.get(globalThis, '__navigate');
    if (typeof navigate !== 'function') throw new Error('missing navigate');
    navigate();
  });
  await page.evaluate(async () => {
    const assistant = Reflect.get(globalThis, '__assistant');
    if (typeof assistant !== 'object' || assistant === null) throw new Error('missing assistant');
    const sendText = Reflect.get(assistant, 'send');
    if (typeof sendText !== 'function') throw new Error('missing send');
    await sendText.call(assistant, 'Delete Phoenix.');
  });
  await expect(
    page.locator('.tool-summary').filter({ hasText: 'This tool is not available.' }),
  ).toBeVisible();
});

test('removes the widget and aborts work on teardown', async ({ page }) => {
  await openCase(page, 'teardown');
  await send(page, 'Hello');
  await expect(page.getByText('The assistant is thinking…')).toBeVisible();
  await page.evaluate(() => {
    const assistant = Reflect.get(globalThis, '__assistant');
    if (typeof assistant !== 'object' || assistant === null) throw new Error('missing assistant');
    const dispose = Reflect.get(assistant, 'dispose');
    if (typeof dispose !== 'function') throw new Error('missing dispose');
    dispose.call(assistant);
  });
  await expect(page.locator('action-wire')).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate(() => Reflect.get(globalThis, '__aborted')))
    .toBe(true);
});

async function openCase(page: Page, name: string): Promise<void> {
  await page.goto(`/?case=${name}`);
  await page.getByRole('button', { name: 'Open assistant' }).click();
}

async function openTranscript(page: Page): Promise<void> {
  await page.locator('action-wire').getByRole('button', { name: 'Transcript' }).click();
}

function statusLine(page: Page) {
  return page.locator('action-wire').locator('[role="status"]');
}

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
