import { expect, test } from '@playwright/test';

test('the gallery has one walkthrough and one photo browser even when the New Wing is empty', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () => {
      document.body.setAttribute('data-pointer-lock-requested', '');
      return Promise.resolve();
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip opening' }).click();
  await page.getByRole('button', { name: 'Take the brass key' }).click();
  await page.getByRole('button', { name: 'Go to pyramid door' }).click();
  await page.getByRole('button', { name: 'Use brass key' }).click();
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visit the New Wing' })).toHaveCount(0);
  const menu = page.getByRole('button', { name: 'Visit menu' });
  await expect(page.getByRole('button', { name: 'Browse photos' })).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
  await menu.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.mouse.move(400, 260);
  await page.mouse.down();
  await expect(menu).toHaveAttribute('aria-expanded', 'true', { timeout: 500 });
  await page.mouse.up();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(await page.locator('body').getAttribute('data-pointer-lock-requested')).toBeNull();
  await menu.click();
  await page.getByRole('button', { name: 'Browse photos' }).click();
  await expect(page.getByRole('button', { name: 'After the Rain' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to museum' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});
