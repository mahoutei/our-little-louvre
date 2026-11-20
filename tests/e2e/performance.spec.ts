import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  var museumDraws: number;
}

function drawCount(page: Page) {
  return page.evaluate(() => globalThis.museumDraws);
}

async function drawsWhileIdle(page: Page) {
  const before = await drawCount(page);
  // Sample the renderer over two seconds, independent of browser frame rate.
  await page.waitForTimeout(2000);
  return await drawCount(page) - before;
}

test('the phone walkthrough renders on input and goes idle in both rooms', async ({ page }) => {
  test.setTimeout(100_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    globalThis.museumDraws = 0;
    const prototype = WebGL2RenderingContext.prototype;
    const draw = prototype.drawElements;
    prototype.drawElements = function (...args) {
      globalThis.museumDraws++;
      return draw.apply(this, args);
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Skip opening' }).click();
  await page.getByRole('button', { name: 'Take the brass key' }).click();
  await expect(page.getByRole('heading', { name: 'The Courtyard' })).toBeVisible({ timeout: 30_000 });
  const modelDownloads = await page.evaluate(() => performance.getEntriesByName(new URL('/models/courtyard.glb', location.href).href)
    .filter((entry) => (entry as PerformanceResourceTiming).transferSize > 0).length);
  expect(modelDownloads).toBe(1);
  await expect.poll(() => drawCount(page)).toBeGreaterThan(0);
  await expect.poll(() => drawsWhileIdle(page), { timeout: 8000 }).toBe(0);

  let before = await drawCount(page);
  await page.keyboard.down('w');
  try { await expect.poll(() => drawCount(page)).toBeGreaterThan(before); }
  finally { await page.keyboard.up('w'); }
  await expect.poll(() => drawsWhileIdle(page), { timeout: 8000 }).toBe(0);

  await page.getByRole('button', { name: 'Go to pyramid door' }).click();
  await page.getByRole('button', { name: 'Use brass key' }).click();
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => drawsWhileIdle(page), { timeout: 8000 }).toBe(0);
  await page.getByRole('button', { name: 'Visit menu' }).click();
  await expect.poll(() => drawsWhileIdle(page), { timeout: 8000 }).toBe(0);
  before = await drawCount(page);
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect.poll(() => drawCount(page)).toBeGreaterThan(before);
});

test('the phone invitation uses the smaller desk image and defers 3D assets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const modelRequests: string[] = [];
  const deskRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/models\/|\/assets\/Museum-/.test(request.url())) modelRequests.push(request.url());
    if (request.url().includes('/invitation-desk')) deskRequests.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  const art = page.locator('.entry-background');
  await expect.poll(() => art.evaluate((img: HTMLImageElement) => new URL(img.currentSrc).pathname))
    .toBe('/media/invitation-desk-phone.webp');
  await expect(page.getByRole('button', { name: 'Skip opening' })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Browse photos' }).click();
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
  expect(deskRequests).toEqual(['/media/invitation-desk-phone.webp']);
  expect(modelRequests).toEqual([]);
});

test('a failed invitation chunk offers a working page reload', async ({ page }) => {
  const invitationChunk = '**/assets/App-*.js';
  await page.route(invitationChunk, (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The page couldn’t open' })).toBeVisible({ timeout: 5000 });
  await page.unroute(invitationChunk);
  await page.getByRole('button', { name: 'Reload page' }).click();
  await expect(page.getByRole('button', { name: 'Skip opening' })).toBeVisible();
});
