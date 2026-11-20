import { expect, test } from '@playwright/test';

test('the gallery has one walkthrough and one photo browser even when the New Wing is empty', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open the envelope' }).click();
  await page.getByRole('button', { name: 'Take the brass key' }).click();
  await page.getByRole('button', { name: 'Go to pyramid door' }).click();
  await page.getByRole('button', { name: 'Use brass key' }).click();
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visit the New Wing' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Browse photos' }).click();
  await expect(page.getByRole('button', { name: 'After the Rain' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to museum' }).click();
  await expect(page.locator('canvas')).toBeVisible();
});
