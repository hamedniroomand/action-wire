import { expect, test, type Page } from '@playwright/test';

test('creates one report after preview, edit, and confirm on the Reports route', async ({
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
      body: JSON.stringify(scriptedReportTurn(payload, calls)),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Weekly revenue' }).click();
  await page.getByRole('button', { name: 'Open assistant' }).click();

  await send(page, 'Create a weekly report titled Q1 Summary for executives.');
  await expect
    .poll(async () =>
      page.locator('action-wire').evaluate((node) => {
        const preview = node.shadowRoot?.querySelector('.proposal-preview');
        return preview?.textContent ?? '';
      }),
    )
    .toContain('Q1 Summary');
  const beforeCount = await page.evaluate(() => Reflect.get(globalThis, '__reportCount'));
  expect(beforeCount).toBe(0);

  await page.locator('action-wire').getByRole('button', { name: 'Apply edits' }).click();
  await page.locator('action-wire').evaluate((node) => {
    const field = node.shadowRoot?.querySelector('input[data-key="audience"]');
    if (!(field instanceof HTMLInputElement)) throw new Error('missing audience field');
    field.value = 'Board';
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('action-wire').getByRole('button', { name: 'Apply edits' }).click();
  await expect
    .poll(async () =>
      page.locator('action-wire').evaluate((node) => {
        const preview = node.shadowRoot?.querySelector('.proposal-preview');
        return preview?.textContent ?? '';
      }),
    )
    .toContain('Board');

  await page.locator('action-wire').getByRole('button', { name: 'Confirm' }).click();
  await expect
    .poll(async () => page.evaluate(() => Reflect.get(globalThis, '__reportCount')))
    .toBe(1);
  // The tool result carries the edited audience, so the edit reached execution.
  await page.locator('action-wire').getByRole('button', { name: 'Transcript' }).click();
  await expect(
    page.locator('action-wire').locator('.tool-summary').filter({ hasText: 'for Board' }),
  ).toBeVisible();
});

test('direct native preview and create enforce the same validation without the widget', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  const result = await page.evaluate(async () => {
    const context = Reflect.get(document, 'modelContext');
    if (typeof context !== 'object' || context === null) return { ok: false, reason: 'no-api' };
    const getTools = Reflect.get(context, 'getTools');
    const executeTool = Reflect.get(context, 'executeTool');
    if (typeof getTools !== 'function' || typeof executeTool !== 'function') {
      return { ok: false, reason: 'no-tools' };
    }
    // The native API mirrors the inputSchema encoding: a string schema wants string input.
    // It rejects when the page handler throws, so validation shows up as a rejection.
    const run = async (tool: object, args: Record<string, unknown>) => {
      const schema = Reflect.get(tool, 'inputSchema');
      const input = typeof schema === 'string' ? JSON.stringify(args) : args;
      try {
        const raw: unknown = await executeTool.call(context, tool, input);
        return { ok: true, result: typeof raw === 'string' ? JSON.parse(raw) : raw };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    };
    const tools: unknown = await getTools.call(context);
    if (!Array.isArray(tools)) return { ok: false, reason: 'no-list' };
    const preview = tools.find(
      (tool) =>
        typeof tool === 'object' && tool !== null && Reflect.get(tool, 'name') === 'previewReport',
    );
    const create = tools.find(
      (tool) =>
        typeof tool === 'object' && tool !== null && Reflect.get(tool, 'name') === 'createReport',
    );
    if (typeof preview !== 'object' || preview === null) {
      return { ok: false, reason: 'missing-tool' };
    }
    if (typeof create !== 'object' || create === null) {
      return { ok: false, reason: 'missing-tool' };
    }
    const previewResult: unknown = await run(preview, {
      chartId: 'weekly-revenue',
      chartVersion: 'v1',
      title: 'Direct',
      audience: 'Ops',
      week: 12,
    });
    const stale: unknown = await run(create, {
      chartId: 'weekly-revenue',
      chartVersion: 'stale',
      title: 'Bad',
      audience: 'Ops',
      week: 12,
    });
    const created: unknown = await run(create, {
      chartId: 'weekly-revenue',
      chartVersion: 'v1',
      title: 'Direct',
      audience: 'Ops',
      week: 12,
    });
    return { previewResult, stale, created };
  });
  expect(result).toMatchObject({ previewResult: { ok: true }, stale: { ok: false } });
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

function scriptedReportTurn(payload: unknown, call: number): object {
  const messages =
    isRecord(payload) && Array.isArray(payload['messages']) ? payload['messages'] : [];
  const tools = isRecord(payload) && Array.isArray(payload['tools']) ? payload['tools'] : [];
  const names = tools.flatMap((tool) => {
    if (!isRecord(tool)) return [];
    const name = tool['name'];
    return typeof name === 'string' ? [name] : [];
  });
  const last = messages.at(-1);
  if (isRecord(last) && last['role'] === 'tool') {
    return assistantText('The report is ready.');
  }
  if (isRecord(last) && last['role'] === 'user') {
    const createName = names.includes('createReport') ? 'createReport' : 'createReport';
    return toolCall(call, createName, {
      chartId: 'weekly-revenue',
      chartVersion: 'v1',
      title: 'Q1 Summary',
      audience: 'Executives',
      week: 12,
    });
  }
  return assistantText('Done.');
}

function toolCall(call: number, name: string, args: Record<string, string | number>): object {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
