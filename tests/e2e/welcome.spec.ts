import { expect, test } from '@playwright/test';

test('the opening is a playable invitation with a keyboard-accessible key', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[1440, 900], [1024, 900], [768, 1024], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Take the brass key' })).toHaveCount(0);
    const envelope = page.getByRole('button', { name: 'Open the envelope' });
    await expect(envelope).toBeInViewport();
    const layout = await page.locator('.entry-scene').evaluate((section) => ({
      bottom: section.getBoundingClientRect().bottom,
      pageWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.bottom).toBeGreaterThanOrEqual(height - 1);
    expect(layout.pageWidth).toBe(width);
    const art = page.locator('.entry-background');
    await expect(art).toHaveJSProperty('complete', true);
    expect(await art.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(art).toHaveCSS('transform', 'none');
    await envelope.focus();
    await page.keyboard.press('Enter');
    const note = page.getByRole('heading', { name: 'My love,' });
    await expect(note).toBeFocused();
    await expect(page.getByRole('button', { name: 'Take the brass key' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Browse photos' })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Close the note' }).click();
    await expect(envelope).toBeFocused();
  }
  await page.getByRole('button', { name: 'Browse photos' }).click();
  await page.getByRole('button', { name: 'Read the letter' }).click();
  const letter = page.getByRole('dialog').getByRole('heading', { name: 'A Letter for You' });
  await expect(letter).toHaveCSS('opacity', '1');
  await expect(letter).toHaveCSS('transform', 'none');
});
