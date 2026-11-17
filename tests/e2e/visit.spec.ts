import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function takeBrassKey(page: Page) {
  await page.getByRole('button', { name: 'Open the envelope' }).click();
  await page.getByRole('button', { name: 'Take the brass key' }).click();
}

test('the photo-only visit supports the keyboard, focus return, and the letter', async ({ page }) => {
  await page.goto('/');
  const browse = page.getByRole('button', { name: 'Browse photos' });
  await browse.focus();
  await page.keyboard.press('Enter');
  const photograph = page.getByRole('button', { name: 'After the Rain' });
  await photograph.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('After the Rain');
  await expect(dialog).toContainText('The sidewalks were still shining');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(photograph).toBeFocused();
  await page.getByRole('button', { name: 'Read the letter' }).click();
  await expect(dialog).toHaveAccessibleName('A Letter for You');
  await expect(dialog).toContainText('Dear you,');
  await dialog.getByRole('button', { name: 'Back to photograph' }).click();
  await expect(dialog).toHaveAccessibleName('The Story Is Still Being Written');
});

test('a failed close-up still opens the exhibit with its small image and caption', async ({ page }) => {
  await page.route('**/content/photos/01.webp', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Browse photos' }).click();
  await page.getByRole('button', { name: 'After the Rain' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('img')).toHaveAttribute('src', '/content/photos/01-small.webp');
  await expect(dialog).toContainText('We walked the long way back.');
  await dialog.getByRole('button', { name: 'Close exhibit' }).click();
  await expect(dialog).toHaveCount(0);
});

test('if WebGL is unavailable, the photo-only visit still opens the letter', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function (this: HTMLCanvasElement, type: string, ...options: unknown[]) {
      return type.includes('webgl') ? null : Reflect.apply(original, this, [type, ...options]);
    } });
  });
  await page.goto('/');
  await takeBrassKey(page);
  await expect(page.getByRole('heading', { name: 'The walkthrough is unavailable' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Browse photos' }).click();
  await page.getByRole('button', { name: 'Read the letter' }).click();
  await expect(page.getByRole('dialog')).toContainText('Dear you,');
});

test('a missing gallery model leaves the collection available', async ({ page }) => {
  await page.route('**/models/gallery.glb', (route) => route.fulfill({ status: 404, body: 'Missing model' }));
  await page.goto('/');
  await takeBrassKey(page);
  await page.getByRole('button', { name: 'Go to pyramid door' }).click();
  await page.getByRole('button', { name: 'Use brass key' }).click();
  await expect(page.getByRole('heading', { name: 'The walkthrough is unavailable' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Browse photos' }).click();
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
});

test('a failed courtyard load can be retried without reopening the invitation', async ({ page }) => {
  await page.route('**/models/courtyard.glb', (route) => route.fulfill({ status: 503, body: 'Temporarily unavailable' }));
  await page.goto('/');
  await takeBrassKey(page);
  await expect(page.getByRole('heading', { name: 'The walkthrough is unavailable' })).toBeVisible();
  await page.unroute('**/models/courtyard.glb');
  await page.getByRole('button', { name: 'Retry walkthrough' }).click();
  await expect(page.getByRole('heading', { name: 'The Courtyard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to pyramid door' })).toBeVisible();
});

test('the rendered gallery is walkable and the finale opens in place', async ({ page }) => {
  // Software WebGL renders at a low frame rate; the finale is roughly 30 m from the entrance.
  test.setTimeout(120_000);
  await page.goto('/');
  await takeBrassKey(page);
  const goToDoor = page.getByRole('button', { name: 'Go to pyramid door' });
  await expect(goToDoor).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use brass key' })).toHaveCount(0);
  await goToDoor.click();
  await expect(page.getByRole('button', { name: 'Use brass key' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Courtyard' })).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
  await page.mouse.click(400, 260);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.keyboard.down('w');
  const inspect = page.getByRole('button', { name: 'The Story Is Still Being Written' });
  try { await expect(inspect).toBeVisible({ timeout: 75_000 }); }
  finally { await page.keyboard.up('w'); }
  const box = (await inspect.boundingBox())!;
  const touch = { pointerType: 'touch', pointerId: 1, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  await inspect.focus();
  // Keep the finale reachable even if a browser omits the synthetic click after a tap.
  await inspect.dispatchEvent('pointerdown', touch);
  await inspect.dispatchEvent('pointerup', touch);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Read the letter' }).click();
  await expect(dialog).toHaveAccessibleName('A Letter for You');
  await page.keyboard.press('Escape');
  await expect(inspect).toBeFocused();
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(inspect).toHaveCount(0);
});

test.describe('phone controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('two thumbs can move and look, and lifting both stops the view', async ({ page, context }) => {
    await page.goto('/');
    await takeBrassKey(page);
    const joystick = page.getByTestId('joystick');
    await expect(joystick).toBeVisible();
    await expect(page.locator('.room-reveal')).toHaveCSS('opacity', '0');
    const bounds = (await joystick.boundingBox())!;
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const clip = { x: 104, y: 315, width: 180, height: 220 };
    const before = await page.screenshot({ clip });
    const input = await context.newCDPSession(page);
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { ...center, id: 1 }, { x: 240, y: 445, id: 2 },
    ] });
    await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
      { x: center.x, y: center.y - 24, id: 1 }, { x: 308, y: 454, id: 2 },
    ] });
    await expect(joystick.locator('.joystick-knob')).not.toHaveAttribute('style', 'transform: translate(0px, 0px);');
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(joystick.locator('.joystick-knob')).toHaveAttribute('style', 'transform: translate(0px, 0px);');
    await expect.poll(async () => (await page.screenshot({ clip })).equals(before)).toBe(false);
    const released = await page.screenshot({ clip });
    await page.waitForTimeout(400);
    expect((await page.screenshot({ clip })).equals(released)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Go to pyramid door' }).tap();
    await page.getByRole('button', { name: 'Use brass key' }).tap();
    await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
  });
});
