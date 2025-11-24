import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Ultimate Goalie 2D/);
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
});
