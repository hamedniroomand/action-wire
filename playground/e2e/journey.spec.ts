import { expect, test, type Page } from '@playwright/test';

/**
 * Manual real-model run (do not assert model wording):
 * 1. Copy playground/.env.example to playground/.env and set WEBMCP_AGENT_*.
 * 2. Start `pnpm playground:dev` and `node playground/server/index.ts`.
 * 3. Open http://127.0.0.1:4175 in Chromium with --enable-experimental-web-platform-features.
 * 4. Ask the assistant to open the latest project, rename it, then delete it.
 */

test('opens Phoenix, renames to Aurora, denies then deletes once, and refreshes tools', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/assistant', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    calls += 1;
    const payload: unknown = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(scriptedTurn(payload, calls)),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();

  await send(page, 'Open my latest project.');
  await expect(page.getByRole('heading', { name: 'Phoenix', exact: true })).toBeVisible();
  await expect(
    page.locator('webmcp-assistant').locator('.tool-name', { hasText: 'openProject' }),
  ).toBeVisible();

  await send(page, 'Rename it to Aurora.');
  await page.locator('webmcp-assistant').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('heading', { name: 'Aurora', exact: true })).toBeVisible();
  await expect(
    page.locator('webmcp-assistant').locator('.tool-name', { hasText: 'renameProject' }),
  ).toBeVisible();

  await send(page, 'Delete it.');
  await page.locator('webmcp-assistant').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Aurora', exact: true })).toBeVisible();

  await send(page, 'Delete it.');
  await page.locator('webmcp-assistant').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aurora' })).toHaveCount(0);
  await expect(
    page.locator('webmcp-assistant').locator('.tool-name', { hasText: 'deleteProject' }),
  ).toHaveCount(2);

  await send(page, 'Open billing.');
  await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
  const names = await page.evaluate(async () => {
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
  expect(names).toContain('openBilling');
  expect(names).not.toContain('deleteProject');
});

async function send(page: Page, text: string): Promise<void> {
  await page.locator('webmcp-assistant').evaluate((node, value) => {
    const field = node.shadowRoot?.querySelector('textarea');
    if (!(field instanceof HTMLTextAreaElement)) throw new Error('The composer is missing.');
    field.value = value;
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
  }, text);
}

function scriptedTurn(payload: unknown, call: number): object {
  const messages =
    isRecord(payload) && Array.isArray(payload['messages']) ? payload['messages'] : [];
  const last = messages.at(-1);
  const content = isRecord(last) ? asText(last['content']) : '';
  if (isRecord(last) && last['role'] === 'tool') {
    if (content.includes('Orion') && content.includes('Phoenix')) {
      return toolCall(call, 'openProject', { id: 'phoenix' });
    }
    if (content.startsWith('Opened Phoenix'))
      return assistantText('I found Phoenix. Opening it now.');
    if (content.startsWith('Renamed')) return assistantText('The project is now Aurora.');
    if (content.includes('denied')) return assistantText('The delete was cancelled.');
    if (content.startsWith('Deleted')) return assistantText('The project was deleted.');
    if (content.startsWith('Opened billing')) return assistantText('Billing is open.');
    return assistantText('Done.');
  }
  const user = lastUser(messages);
  if (/billing/i.test(user)) return toolCall(call, 'openBilling', {});
  if (/delete/i.test(user)) return toolCall(call, 'deleteProject', { id: 'phoenix' });
  if (/rename|aurora/i.test(user)) {
    return toolCall(call, 'renameProject', { id: 'phoenix', name: 'Aurora' });
  }
  return toolCall(call, 'listProjects', {});
}

function lastUser(messages: unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (isRecord(message) && message['role'] === 'user') return asText(message['content']);
  }
  return '';
}

function toolCall(call: number, name: string, args: Record<string, string>): object {
  return {
    choices: [
      {
        message: {
          content: '',
          tool_calls: [
            {
              id: `c${call}`,
              type: 'function',
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  };
}

function assistantText(content: string): object {
  return { choices: [{ message: { content } }] };
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
