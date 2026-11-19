import { Hono } from 'hono';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';
import { requireMember } from '../../server/auth';
import { ApiError } from '../../server/http';

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock('../../server/env', () => ({
  serverReady: () => true,
  guestListReady: () => true,
  isAllowedEmail: (email: string) => ['owner@example.com', 'partner@example.com'].includes(email),
}));

vi.mock('../../server/prisma', () => ({
  prisma: {
    member: {
      findUnique: async () => ({ email: 'owner@example.com' }),
    },
  },
}));

vi.mock('../../server/supabase', () => ({ supabaseAdmin: () => ({ auth: { getUser } }) }));

const app = new Hono();
app.get('/private', requireMember, (c) => c.text('Private collection'));
app.onError((error, c) => {
  if (error instanceof ApiError) return c.text(error.message, error.status);
  throw error;
});

it.each([
  [' OWNER@example.com ', 200],
  ['changed@example.com', 403],
  ['partner@example.com', 403],
])('checks stored membership against the authenticated email %s', async (email, status) => {
  getUser.mockResolvedValue({ data: { user: { id: 'auth-1', email } }, error: null });
  const response = await app.request('/private', { headers: { Authorization: 'Bearer test-token' } });
  expect(response.status).toBe(status);
});

it('reports a temporary Supabase outage without rejecting the member’s key', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('Unavailable', 503) });
  const response = await app.request('/private', { headers: { Authorization: 'Bearer test-token' } });
  expect(response.status).toBe(503);
});
