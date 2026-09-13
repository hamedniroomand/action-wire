/// <reference types="node" />
import { writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('records native discovery and execution or reports the missing API', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run probe' }).click();
  const output = page.locator('#report');
  await expect(output).toContainText(/"status": "(supported|unsupported|failed)"/);
  const report = JSON.parse(await output.innerText());
  const evidence = testInfo.outputPath('native-webmcp-report.json');
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
  await testInfo.attach('native-webmcp-report', {
    path: evidence,
    contentType: 'application/json',
  });
  expect(report.secureContext).toBe(true);
  expect(report.status, JSON.stringify(report)).not.toBe('failed');
  if (report.status === 'supported') {
    expect(report.result).toEqual({ text: 'WebMCP probe' });
    expect(report.handlerCalls).toBe(1);
    expect(report.registeredBeforeDiscovery).toBe(true);
    expect(report.removedAfterAbort).toBe(true);
    expect(report.registrationEvent).toBe(true);
    expect(report.removalEvent).toBe(true);
    expect(report.tool.annotations.readOnlyHint).toBe(true);
  } else {
    expect(report.message).toContain('WebMCP');
    expect(report.handlerCalls).toBe(0);
  }
  if (testInfo.project.name === 'chromium-webmcp') expect(report.status).toBe('supported');
});

test('shows an unsupported report when document.modelContext is absent', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'modelContext', { value: undefined });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Run probe' }).click();
  await expect(page.locator('#report')).toContainText('"status": "unsupported"');
  await expect(page.locator('#report')).toContainText('WebMCP');
});
