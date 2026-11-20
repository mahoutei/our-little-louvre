import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

test('the phone visit menu and scene caption stay clear at each width and after rotation', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip opening' }).tap();
  await page.getByRole('button', { name: 'Take the brass key' }).tap();
  const caption = page.locator('.scene-caption');
  await expect(caption).toBeVisible();
  // Add the signed-in Studio action to the demo menu for the layout check.
  await page.locator('.visit-menu-panel').evaluate((nav) => {
    const link = document.createElement('a');
    link.className = 'masthead-link';
    link.href = '/studio';
    link.textContent = 'Private studio';
    nav.append(link);
  });
  const menu = page.getByRole('button', { name: 'Visit menu' });
  await menu.tap();
  await page.evaluate(() => document.fonts.ready);
  const cdp = await context.newCDPSession(page);
  for (const width of [320, 390, 430, 470, 667]) {
    const landscape = width === 667;
    await page.setViewportSize({ width, height: landscape ? 375 : 844 });
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: landscape
      ? { top: 0, right: 44, bottom: 21, left: 44 }
      : { top: 44, right: 0, bottom: 34, left: 0 } });
    await expect.poll(async () => {
      const header = (await page.locator('.masthead').boundingBox())!;
      return (await caption.boundingBox())!.y - (header.y + header.height);
    }, { message: `Scene caption clears the signed-in header at ${width}px` }).toBeGreaterThanOrEqual(0);
    const studio = (await page.getByRole('link', { name: 'Private studio' }).boundingBox())!;
    expect(studio.height).toBeGreaterThanOrEqual(44);
    expect(studio.width).toBeGreaterThanOrEqual(44);
    expect(studio.x + studio.width).toBeLessThanOrEqual(width - (landscape ? 44 : 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('phone controls clear the notch, stay reachable, and fit after rotation', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 44, right: 0, bottom: 34, left: 0 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip opening' }).tap();
  await page.getByRole('button', { name: 'Take the brass key' }).tap();
  await page.getByRole('button', { name: 'Go to pyramid door' }).tap();
  const useKey = page.getByRole('button', { name: 'Use brass key' });
  await expect(useKey).toBeVisible();

  const menu = page.getByRole('button', { name: 'Visit menu' });
  const hint = page.locator('.touch-hint');
  const actions = page.locator('.scene-actions');
  const joystick = page.getByTestId('joystick');
  expect((await menu.boundingBox())!.y).toBeGreaterThanOrEqual(44);
  const hintBox = (await hint.boundingBox())!;
  expect(hintBox.y + hintBox.height).toBeLessThan((await actions.boundingBox())!.y);
  const canvas = page.locator('canvas');
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.width / element.clientWidth)).toBeLessThanOrEqual(1.2);

  const stick = (await joystick.boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { x: stick.x + stick.width / 2, y: stick.y + stick.height / 4, id: 1 },
  ] });
  const knob = joystick.locator('.joystick-knob');
  await expect(knob).not.toHaveAttribute('style', 'transform: translate(0px, 0px);');
  await page.setViewportSize({ width: 667, height: 375 });
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, right: 44, bottom: 21, left: 44 } });
  await expect(knob).toHaveAttribute('style', 'transform: translate(0px, 0px);');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(useKey).toBeInViewport({ ratio: 1 });
  const access = (await useKey.boundingBox())!;
  expect(access.x + access.width).toBeLessThanOrEqual(667 - 44);
  expect(access.y + access.height).toBeLessThanOrEqual(375 - 21);
  expect((await joystick.boundingBox())!.x).toBeGreaterThanOrEqual(44);
});

test('the close control stays reachable while scrolling the letter on a small phone', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Browse photos' }).tap();
  const display = page.getByRole('button', { name: 'View photograph' });
  await display.tap();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Read the letter' }).tap();
  await expect(dialog).toHaveAccessibleName('A Letter for You');

  const scrolled = await dialog.evaluate((element) => {
    const region = element.querySelector<HTMLElement>('.dialog-content') ?? element;
    region.scrollTop = region.scrollHeight;
    return region.scrollTop;
  });
  expect(scrolled).toBeGreaterThan(0);
  const close = dialog.getByRole('button', { name: 'Close exhibit' });
  await expect(close).toBeInViewport({ ratio: 1 });
  await close.tap();
  await expect(dialog).toHaveCount(0);
  await expect(display).toBeFocused();
});
