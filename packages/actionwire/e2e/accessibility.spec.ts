import { expect, test } from '@playwright/test';

test('keeps the bar inside a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();
  const metrics = await page.locator('action-wire').evaluate((node) => {
    const bar = node.shadowRoot?.querySelector('[role="dialog"]');
    const field = node.shadowRoot?.querySelector('input[aria-label="Message"]');
    if (!(bar instanceof HTMLElement) || !(field instanceof HTMLElement)) {
      throw new Error('missing bar');
    }
    const barBox = bar.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    return {
      overflowX: bar.scrollWidth - bar.clientWidth,
      barLeft: barBox.left,
      barRight: barBox.right,
      barBottom: barBox.bottom,
      fieldTop: fieldBox.top,
      fieldBottom: fieldBox.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(metrics.overflowX).toBeLessThanOrEqual(1);
  expect(metrics.barLeft).toBeGreaterThanOrEqual(-1);
  expect(metrics.barRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.fieldTop).toBeGreaterThanOrEqual(0);
  expect(metrics.fieldBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.barBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
});

test('runs the native delete only after the Delete click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open assistant' }).click();
  await page.locator('action-wire').evaluate((node) => {
    const field = node.shadowRoot?.querySelector('input[aria-label="Message"]');
    if (!(field instanceof HTMLInputElement)) throw new Error('missing input');
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
