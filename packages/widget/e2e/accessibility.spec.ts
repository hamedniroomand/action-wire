import { expect, test } from '@playwright/test';

test('keeps the panel inside 320px and the composer visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();
  const metrics = await page.locator('action-wire').evaluate((node) => {
    const panel = node.shadowRoot?.querySelector('[role="dialog"]');
    const composer = node.shadowRoot?.querySelector('.composer');
    if (!(panel instanceof HTMLElement) || !(composer instanceof HTMLElement)) {
      throw new Error('missing panel');
    }
    const panelBox = panel.getBoundingClientRect();
    const composerBox = composer.getBoundingClientRect();
    return {
      overflowX: panel.scrollWidth - panel.clientWidth,
      panelRight: panelBox.right,
      composerTop: composerBox.top,
      composerBottom: composerBox.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(metrics.overflowX).toBeLessThanOrEqual(1);
  expect(metrics.panelRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.composerTop).toBeGreaterThanOrEqual(0);
  expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
});

test('runs the native delete only after the Delete click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();
  await page.locator('action-wire').evaluate((node) => {
    const field = node.shadowRoot?.querySelector('textarea');
    if (!(field instanceof HTMLTextAreaElement)) throw new Error('missing composer');
    field.value = 'Delete Phoenix.';
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
  });
  await expect
    .poll(async () =>
      page.locator('action-wire').evaluate((node) => {
        const buttons = [...(node.shadowRoot?.querySelectorAll('button') ?? [])];
        return buttons.some((button) => button.textContent === 'Delete');
      }),
    )
    .toBe(true);
  const before = await page.evaluate(() => Reflect.get(globalThis, '__executed'));
  expect(before).toEqual([]);
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect
    .poll(async () => page.evaluate(() => Reflect.get(globalThis, '__executed')))
    .toEqual(['c1']);
});
