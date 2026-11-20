import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const beats = [
  'When the last visitor left, I kept a key for you.',
  'I hung a few of my favorite photographs of us inside.',
  'I left something for you in the last room.',
];
const CLOCK_STEP = 20;

async function loadOpening(page: Page) {
  await page.goto('/');
  // React's lazy app can be waiting on its Suspense timer when the clock is frozen.
  await expect.poll(async () => {
    await page.clock.runFor(CLOCK_STEP);
    return page.locator('.entry-scene').count();
  }, { intervals: [0] }).toBe(1);
}

async function openWithClock(page: Page) {
  const start = new Date('2026-11-20T00:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await loadOpening(page);
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('the opening plays three four-second beats and reveals a keyboard-accessible key', async ({ page }) => {
  await openWithClock(page);
  const story = page.locator('main [aria-live="polite"]');
  const key = page.getByRole('button', { name: 'Take the brass key' });
  const skip = page.getByRole('button', { name: 'Skip opening' });
  await expect(page.getByRole('banner')).toHaveCount(0);
  await expect(skip).toBeVisible();
  await skip.focus();
  for (const beat of beats) {
    await expect(story).toHaveText(beat);
    await expect(key).toHaveCount(0);
    await page.clock.runFor(4000 - CLOCK_STEP - 1);
    await expect(story).toHaveText(beat);
    await page.clock.runFor(CLOCK_STEP + 1);
  }
  await expect(key).toBeFocused();
});

test('the opening preserves remaining time while paused or in a hidden tab', async ({ page }) => {
  await openWithClock(page);
  const story = page.locator('main [aria-live="polite"]');
  await expect(story).toHaveText(beats[0]);
  await page.clock.runFor(1500);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.runFor(8000);
  await expect(story).toHaveText(beats[0]);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(1000);
  await setHidden(page, true);
  await page.clock.runFor(8000);
  await expect(story).toHaveText(beats[0]);
  await setHidden(page, false);
  await page.clock.runFor(1500 - CLOCK_STEP - 1);
  await expect(story).toHaveText(beats[0]);
  await page.clock.runFor(CLOCK_STEP + 1);
  await expect(story).toHaveText(beats[1]);
  await page.getByRole('button', { name: 'Skip opening' }).click();
  await expect(page.getByRole('button', { name: 'Take the brass key' })).toBeFocused();
});

test('the reduced-motion opening advances manually and fits narrow and landscape screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithClock(page);
  const story = page.locator('main [aria-live="polite"]');
  const next = page.getByRole('button', { name: 'Continue' });
  const skip = page.getByRole('button', { name: 'Skip opening' });
  const browse = page.getByRole('button', { name: 'Browse photos' });
  const key = page.getByRole('button', { name: 'Take the brass key' });
  await page.clock.runFor(16_000);
  await expect(story).toHaveText(beats[0]);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);

  for (const [width, height] of [[1440, 900], [1024, 900], [768, 1024], [568, 320], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await loadOpening(page);
    const bounds = await page.locator('.entry-scene').evaluate((section) => ({
      bottom: section.getBoundingClientRect().bottom,
      pageWidth: document.documentElement.scrollWidth,
    }));
    expect(bounds.bottom).toBeGreaterThanOrEqual(height - 1);
    expect(bounds.pageWidth).toBe(width);
    const art = page.locator('.entry-background');
    await expect(art).toHaveJSProperty('complete', true);
    expect(await art.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(art).toHaveCSS('transform', 'none');
    await expect(next).toBeInViewport({ ratio: 1 });
    await expect(skip).toBeInViewport({ ratio: 1 });
    await expect(browse).toBeInViewport({ ratio: 1 });
    await next.focus();
    for (const beat of beats) {
      await expect(story).toHaveText(beat);
      await page.keyboard.press('Enter');
    }
    await expect(key).toBeFocused();
    await expect(key).toBeInViewport({ ratio: 1 });
    await expect(browse).toBeInViewport({ ratio: 1 });
  }
});

test('browsing photos leaves the opening and returns directly to the key', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByText(beats[0])).toBeVisible();
  await page.getByRole('button', { name: 'Browse photos' }).click();
  await page.getByRole('button', { name: 'Read the letter' }).click();
  const dialog = page.getByRole('dialog');
  const letter = dialog.getByRole('heading', { name: 'A Letter for You' });
  await expect(letter).toHaveCSS('opacity', '1');
  await expect(letter).toHaveCSS('transform', 'none');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to invitation' }).click();
  await expect(page.getByRole('button', { name: 'Take the brass key' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Skip opening' })).toHaveCount(0);
});
