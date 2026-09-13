import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const HOSTS = [
  { name: 'Vanilla', url: 'http://127.0.0.1:4176/' },
  { name: 'React', url: 'http://127.0.0.1:4177/' },
  { name: 'Vue', url: 'http://127.0.0.1:4178/' },
  { name: 'Svelte', url: 'http://127.0.0.1:4179/' },
] as const;

test('keeps the desktop panel inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();
  const box = await panelBox(page);
  expect(box.width).toBeGreaterThanOrEqual(360);
  expect(box.width).toBeLessThanOrEqual(400);
  expect(box.height).toBeLessThanOrEqual(640);
  expect(box.right).toBeLessThanOrEqual(1280 + 1);
  expect(box.bottom).toBeLessThanOrEqual(800 + 1);
});

test('keeps the composer visible at 640px', async ({ page }) => {
  await assertMobileComposer(page, 640);
});

test('keeps the composer visible at 320px', async ({ page }) => {
  await assertMobileComposer(page, 320);
});

test('disables motion when the user prefers reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const duration = await page.locator('action-wire').evaluate((node) => {
    const launcher = node.shadowRoot?.querySelector('.launcher');
    if (!(launcher instanceof HTMLElement)) throw new Error('missing launcher');
    return getComputedStyle(launcher).transitionDuration;
  });
  expect(duration === '0s' || duration === '0ms').toBe(true);
});

test('opens, sends, and closes with the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).press('Enter');
  await expect(page.getByRole('dialog', { name: 'Assistant' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Message' }).fill('Hello');
  await page.getByRole('textbox', { name: 'Message' }).press('Enter');
  await expect(page.getByText('You said: Hello')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Assistant' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open assistant' })).toBeFocused();
});

for (const host of HOSTS) {
  test(`shows one widget on the ${host.name} host`, async ({ page }) => {
    await page.goto(host.url);
    await expect(page.getByRole('button', { name: 'Open assistant' })).toBeVisible();
    expect(await page.locator('action-wire').count()).toBe(1);
  });
}

test('does not add voice, React, Vue, or Svelte to browser packages', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const files = [
    {
      name: 'action-wire',
      raw: await readFile(join(root, 'packages/action-wire/package.json'), 'utf8'),
    },
  ];
  for (const { name, raw } of files) {
    const pkg: unknown = JSON.parse(raw);
    const record = typeof pkg === 'object' && pkg !== null ? pkg : {};
    const dependencies = {
      ...readDeps(record, 'dependencies'),
      ...readDeps(record, 'devDependencies'),
      ...readDeps(record, 'peerDependencies'),
    };
    for (const banned of [
      'react',
      'vue',
      'svelte',
      'livekit-client',
      'openai-realtime',
      'webrtc',
    ]) {
      expect(dependencies[banned], `${name} must not depend on ${banned}`).toBeUndefined();
    }
  }
});

test('does not redefine playground tools inside the assistant mount', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const assistant = await readFile(join(root, 'playground/src/assistant.ts'), 'utf8');
  expect(assistant).not.toContain('listProjects');
  expect(assistant).not.toContain('registerTool');
});

async function assertMobileComposer(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();
  const metrics = await page.locator('action-wire').evaluate((node) => {
    const panel = node.shadowRoot?.querySelector('[role="dialog"]');
    const composer = node.shadowRoot?.querySelector('.composer');
    if (!(panel instanceof HTMLElement) || !(composer instanceof HTMLElement)) {
      throw new Error('missing panel');
    }
    const frame = panel.getBoundingClientRect();
    const composerBox = composer.getBoundingClientRect();
    return {
      left: frame.left,
      right: frame.right,
      overflowX: panel.scrollWidth - panel.clientWidth,
      composerTop: composerBox.top,
      composerBottom: composerBox.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(metrics.left).toBeLessThanOrEqual(1);
  expect(metrics.right).toBeGreaterThanOrEqual(metrics.viewportWidth - 1);
  expect(metrics.overflowX).toBeLessThanOrEqual(1);
  expect(metrics.composerTop).toBeGreaterThanOrEqual(0);
  expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
}

async function panelBox(page: Page): Promise<{
  width: number;
  height: number;
  right: number;
  bottom: number;
}> {
  return page.locator('action-wire').evaluate((node) => {
    const panel = node.shadowRoot?.querySelector('[role="dialog"]');
    if (!(panel instanceof HTMLElement)) throw new Error('missing panel');
    const box = panel.getBoundingClientRect();
    return { width: box.width, height: box.height, right: box.right, bottom: box.bottom };
  });
}

function readDeps(record: object, key: string): Record<string, unknown> {
  const value = Reflect.get(record, key);
  if (typeof value !== 'object' || value === null) return {};
  return { ...value };
}
