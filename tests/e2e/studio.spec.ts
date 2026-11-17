import { expect, test } from '@playwright/test';

test('the private studio preview renders the collection, the letter, and the empty New Wing', async ({ page }) => {
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'What should the museum hold?' })).toBeVisible();
  await expect(page.getByText('This is the public preview. The private studio is read-only until one of the two keys is used.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hang a memory' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The letter' })).toBeVisible();
  await expect(page.getByLabel('Paragraph 1')).toHaveValue('Dear you,');
  await expect(page.getByText('The New Wing', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your photographs' })).toBeVisible();
  await expect(page.getByText('The New Wing is waiting for its first photograph.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Gallery of Us' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'After the Rain' })).toBeVisible();
});
