import { writeFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

test('discovers native page tools and runs listProjects without a WebMCP test double', async ({
  page,
  browser,
}, testInfo) => {
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
  const report = await page.evaluate(async () => {
    const context = Reflect.get(document, 'modelContext');
    if (typeof context !== 'object' || context === null) {
      return { status: 'unsupported', names: [] as string[] };
    }
    const getTools = Reflect.get(context, 'getTools');
    if (typeof getTools !== 'function') {
      return { status: 'unsupported', names: [] as string[] };
    }
    const tools: unknown = await getTools.call(context);
    const names = Array.isArray(tools)
      ? tools.flatMap((tool) => {
          if (typeof tool !== 'object' || tool === null) return [];
          const name = Reflect.get(tool, 'name');
          return typeof name === 'string' ? [name] : [];
        })
      : [];
    return { status: 'supported', names };
  });
  const evidence = testInfo.outputPath('native-webmcp-widget.json');
  await writeFile(
    evidence,
    JSON.stringify(
      {
        browser: browser.version(),
        flags: testInfo.project.use.launchOptions?.args ?? [],
        ...report,
      },
      null,
      2,
    ),
  );
  await testInfo.attach('native-webmcp-widget', {
    path: evidence,
    contentType: 'application/json',
  });
  expect(report.status, 'Native WebMCP is required. This suite must not skip.').toBe('supported');
  expect(report.names).toContain('listProjects');
  expect(report.names).not.toContain('deleteProject');

  await page.getByRole('button', { name: 'Open assistant' }).click();
  await send(page, 'List my projects.');
  await openTranscript(page);
  await expect(
    page.locator('action-wire').locator('.tool-name', { hasText: 'listProjects' }),
  ).toBeVisible();
  await expect(
    page.locator('action-wire').locator('.tool-status', { hasText: 'Success' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phoenix' })).toBeVisible();
});

async function openTranscript(page: Page): Promise<void> {
  await page.locator('action-wire').getByRole('button', { name: 'Transcript' }).click();
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

function scriptedTurn(payload: unknown): object {
  const messages =
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray(Reflect.get(payload, 'messages'))
      ? Reflect.get(payload, 'messages')
      : [];
  const last = Array.isArray(messages) ? messages.at(-1) : undefined;
  const role = typeof last === 'object' && last !== null ? Reflect.get(last, 'role') : undefined;
  if (role === 'tool') {
    return { choices: [{ message: { content: 'Phoenix, Orion, Nova, Atlas' } }] };
  }
  return {
    choices: [
      {
        message: {
          content: '',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: { name: 'listProjects', arguments: '{}' },
            },
          ],
        },
      },
    ],
  };
}

test('discovers and runs native tools under a CSP that forbids eval', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.url().includes('/api/assistant') && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(scriptedTurn(request.postDataJSON())),
      });
      return;
    }
    const response = await route.fetch();
    const headers: Record<string, string> = {
      ...response.headers(),
      // No 'unsafe-eval'. A validator that compiles schemas with `new Function`
      // fails here, which is what strict hosts serve in production.
      'content-security-policy': "script-src 'self' 'unsafe-inline'; object-src 'none'",
    };
    if (!(headers['content-type'] ?? '').includes('text/html')) {
      await route.fulfill({ response, headers });
      return;
    }
    // The probe must be parsed by the browser as part of the document, so the
    // CSP applies to it. Script injected through the automation channel does not.
    const body = (await response.text()).replace(
      '</head>',
      `<script>try{new Function('return 1')();window.__evalRan=true}catch{window.__evalRan=false}</script></head>`,
    );
    await route.fulfill({ response, headers, body });
  });

  const response = await page.goto('/');
  expect(
    response?.headers()['content-security-policy'],
    'The CSP header must reach the page for this test to mean anything.',
  ).toContain("script-src 'self'");

  expect(await page.evaluate(() => Reflect.get(window, '__evalRan')), 'CSP must block eval.').toBe(
    false,
  );

  await page.getByRole('button', { name: 'Open assistant' }).click();
  await send(page, 'List my projects.');
  await openTranscript(page);
  await expect(
    page.locator('action-wire').locator('.tool-status', { hasText: 'Success' }),
  ).toBeVisible();
});
