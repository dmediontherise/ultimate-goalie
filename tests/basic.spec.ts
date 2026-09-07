import { test, expect } from '@playwright/test';

test('loads the menu without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('./');
  await expect(page).toHaveTitle(/Ultimate Goalie/);
  await expect(page.getByRole('button', { name: /START GAME/i })).toBeVisible();

  expect(errors).toEqual([]);
});

test('canvas is sized to devicePixelRatio', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /START GAME/i }).click();

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // The backing store is the logical 800x600 space multiplied by DPR, while the
  // element keeps its CSS size. This is the crisp-rendering fix from task 006 -
  // a unit test cannot see it, because it only exists once there is a real
  // devicePixelRatio and a real element box.
  const dims = await canvas.evaluate((el: HTMLCanvasElement) => ({
    w: el.width,
    h: el.height,
    dpr: window.devicePixelRatio,
  }));

  expect(dims.w).toBe(Math.round(800 * dims.dpr));
  expect(dims.h).toBe(Math.round(600 * dims.dpr));
});

test('plays a round to a result and keeps rendering', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('./');
  await page.getByRole('button', { name: /START GAME/i }).click();
  await expect(page.locator('canvas')).toBeVisible();

  // Exercise movement, every stick position, and the new moves, so a throw in
  // any input path surfaces as a pageerror rather than passing silently.
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyZ', 'KeyX', 'KeyC']) {
    await page.keyboard.press(key);
  }

  // Every round ends in a save or a goal; the AI shoots on its own.
  const result = page.getByText(/SAVE!|GOAL!/);
  await expect(result).toBeVisible({ timeout: 30_000 });

  // The round-result overlay offers the next step, which is the state the loop
  // must reach - a frozen loop would leave this button absent.
  await expect(page.getByRole('button', { name: /Next Round|Finish Game/i })).toBeVisible();

  expect(errors).toEqual([]);
});
