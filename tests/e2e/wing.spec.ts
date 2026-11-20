import { expect, test } from '@playwright/test';

test('an empty New Wing explains what belongs there and returns to the gallery', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open the envelope' }).click();
  await page.getByRole('button', { name: 'Take the brass key' }).click();
  await page.getByRole('button', { name: 'Go to pyramid door' }).click();
  await page.getByRole('button', { name: 'Use brass key' }).click();
  const entrance = page.getByRole('button', { name: 'Visit the New Wing' });
  await entrance.click();
  await expect(page.getByText('New memories will hang here.')).toBeVisible();
  await expect(page.locator('canvas')).toBeHidden();
  await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('button', { name: 'Back to the gallery' }).click();
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
  await expect(entrance).toBeFocused();
});
