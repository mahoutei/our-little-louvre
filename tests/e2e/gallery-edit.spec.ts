import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import exhibitFixture from '../../public/content/exhibits.json' with { type: 'json' };

const member = { id: 'curator', name: 'Test curator', email: 'curator@example.invalid', role: 'PARTNER' };
const museum = { name: 'Our Little Louvre' };
const origin = 'http://127.0.0.1:4174';
const galleryPhoto = exhibitFixture.exhibits[0];

async function mockGallery(page: Page, photo = galleryPhoto) {
  let exhibits = exhibitFixture.exhibits.map((exhibit) => ({ ...exhibit, published: true }));
  const changes = { saves: 0, removals: 0, uploads: 0 };
  const collection = () => ({ museum, member, manifest: { ...exhibitFixture, exhibits },
    wing: { capacity: 6, total: 0, alleys: [] } });
  await page.addInitScript((member) => localStorage.setItem('sb-gallery-fixture-auth-token', JSON.stringify({
    access_token: 'gallery-test-session', refresh_token: 'gallery-test-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600, user: member,
  })), member);
  await page.route('https://gallery-fixture.supabase.invalid/**', async (route) => {
    if (!new URL(route.request().url()).pathname.startsWith('/storage/v1/object/upload/sign/')) return route.abort();
    changes.uploads++;
    return route.fulfill({
      json: { Key: 'museum-photos/curator/replacement.webp' },
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.route(origin + '/api/**', async (route) => {
    const request = route.request();
    const address = new URL(request.url());
    expect(request.headers().authorization).toBe('Bearer gallery-test-session');
    if (address.pathname === '/api/me') return route.fulfill({ json: { member, museum } });
    if (address.pathname === '/api/collection') return route.fulfill({ json: { collection: collection() } });
    if (address.pathname === '/api/uploads') return route.fulfill({ json: { files: ['full', 'thumb'].map((kind) => ({
      kind, path: `curator/replacement-${kind}.webp`, token: 'test-upload', contentType: 'image/webp',
    })) } });
    expect(address.pathname).toBe('/api/exhibits/' + photo.id);
    expect(address.searchParams.get('view')).toBe('gallery');
    if (request.method() === 'PATCH') {
      changes.saves++;
      const { replacement, ...fields } = request.postDataJSON();
      if (replacement) {
        expect(replacement).toMatchObject({
          imagePath: 'curator/replacement-full.webp', thumbPath: 'curator/replacement-thumb.webp',
        });
      }
      exhibits = exhibits.map((exhibit) => exhibit.id === photo.id ? {
        ...exhibit, ...fields,
        ...(replacement && { imageUrl: '/content/photos/02.webp', thumbnailUrl: '/content/photos/02-small.webp' }),
      } : exhibit);
    } else {
      expect(request.method()).toBe('DELETE');
      changes.removals++;
      exhibits = exhibits.filter((exhibit) => exhibit.id !== photo.id);
    }
    return route.fulfill({ json: { collection: collection() } });
  });
  return changes;
}

test('both editing and removal are available directly in the gallery viewer', async ({ page }) => {
  const changes = await mockGallery(page);
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Browse photos', exact: true }).click();
  await page.getByRole('button', { name: galleryPhoto.title }).click();
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: 'Edit photo', exact: true }).click();
  await expect(panel.getByLabel('Title', { exact: true })).toHaveValue(galleryPhoto.title);
  await panel.getByLabel('Title', { exact: true }).fill('The café that evening');
  await panel.getByLabel('The story').fill('We stayed until the lights came on.');
  await panel.getByLabel('Date', { exact: true }).fill('Our first winter');
  await panel.getByLabel('Replace photograph').setInputFiles('public/content/photos/02-small.webp');
  await expect(panel.getByRole('img', { name: 'Replacement preview' })).toBeVisible();
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel.getByRole('heading', { name: 'The café that evening' })).toBeFocused();
  await expect(panel.getByText('We stayed until the lights came on.')).toBeVisible();
  await expect(panel.getByRole('img')).toHaveAttribute('src', '/content/photos/02.webp');
  expect(changes).toEqual({ saves: 1, removals: 0, uploads: 2 });
  await panel.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await panel.getByRole('button', { name: 'Keep photo', exact: true }).click();
  expect(changes.removals).toBe(0);
  await panel.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await panel.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'The café that evening' })).toHaveCount(0);
  expect(changes.removals).toBe(1);
  await expect(page).toHaveURL(origin + '/');
});

test('saving a photo in the walkthrough refreshes the same frame and its inspect action', async ({ page }) => {
  test.setTimeout(140_000);
  const photo = exhibitFixture.exhibits.find(({ id }) => id === exhibitFixture.finale.exhibitId)!;
  const changes = await mockGallery(page, photo);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin);
  for (const name of ['Skip opening', 'Take the brass key', 'Go to pyramid door', 'Use brass key']) {
    await page.getByRole('button', { name, exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
  const inspect = page.getByRole('button', { name: new RegExp(photo.title) });
  await page.keyboard.down('w');
  try { await expect(inspect).toBeVisible({ timeout: 95_000 }); }
  finally { await page.keyboard.up('w'); }
  await inspect.click();
  const panel = page.getByRole('dialog');
  const updated = 'The last light by the lake';
  await panel.getByRole('button', { name: 'Edit photo', exact: true }).click();
  await panel.getByLabel('Title', { exact: true }).fill(updated);
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel.getByRole('heading', { name: updated })).toBeVisible();
  await panel.getByRole('button', { name: 'Close exhibit' }).click();
  const updatedInspect = page.getByRole('button', { name: new RegExp(updated) });
  await expect(updatedInspect).toBeFocused();
  await updatedInspect.click();
  await expect(panel.getByRole('heading', { name: updated })).toBeVisible();
  await panel.getByRole('button', { name: 'Read the letter' }).click();
  await expect(panel.getByRole('heading', { name: 'A Letter for You' })).toBeVisible();
  expect(changes.saves).toBe(1);
});
