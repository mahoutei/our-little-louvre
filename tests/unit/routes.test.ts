import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  member: {
    id: 'member-1',
    authId: 'auth-1',
    email: 'owner@example.com',
    name: 'Owner',
    role: 'OWNER',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  paused: false,
  getUser: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  exhibitFindMany: vi.fn(),
  exhibitFindFirst: vi.fn(),
  exhibitCreate: vi.fn(),
  exhibitUpdate: vi.fn(),
  exhibitDelete: vi.fn(),
  letterFindFirst: vi.fn(),
  letterFindUnique: vi.fn(),
  letterUpdateMany: vi.fn(),
  letterUpdate: vi.fn(),
  letterCreate: vi.fn(),
  transaction: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  createSignedUrls: vi.fn(),
  createSignedUploadUrl: vi.fn(),
}));

vi.mock('../../server/env', () => ({
  env: {
    databaseUrl: 'postgres://test',
    directUrl: 'postgres://test',
    supabaseUrl: 'https://test.supabase.co',
    supabasePublishableKey: 'test',
    supabaseSecretKey: 'test',
    ownerEmail: 'owner@example.com',
    partnerEmail: 'partner@example.com',
    ownerName: 'Owner',
    partnerName: 'Partner',
    get partnerPaused() { return state.paused; },
    partnerPausedMessage: 'Dean is cooking something',
    museumName: 'Our Little Louvre',
    alleyCapacity: 6,
    maxAlleys: 24,
  },
  serverReady: () => true,
  guestListReady: () => true,
  isAllowedEmail: (email: string) => email === 'owner@example.com' || email === 'partner@example.com',
  roleFor: (email: string) => email === 'owner@example.com' ? 'OWNER' : 'PARTNER',
  nameFor: () => 'Member',
}));

vi.mock('../../server/prisma', () => ({
  prisma: {
    member: { findUnique: state.findUnique, upsert: state.upsert },
    exhibit: {
      findMany: state.exhibitFindMany,
      findFirst: state.exhibitFindFirst,
      create: state.exhibitCreate,
      update: state.exhibitUpdate,
      delete: state.exhibitDelete,
    },
    letter: {
      findFirst: state.letterFindFirst,
      findUnique: state.letterFindUnique,
      updateMany: state.letterUpdateMany,
      update: state.letterUpdate,
      create: state.letterCreate,
    },
    $transaction: state.transaction,
  },
}));

vi.mock('../../server/supabase', () => ({
  supabaseAdmin: () => ({
    auth: { getUser: state.getUser },
    storage: {
      from: () => ({
        list: state.list,
        remove: state.remove,
        createSignedUrls: state.createSignedUrls,
        createSignedUploadUrl: state.createSignedUploadUrl,
      }),
    },
  }),
}));

import { app } from '../../server/app';

const auth = { Authorization: 'Bearer test-token' };
const json = (body: unknown, method = 'POST') => ({
  method,
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const base = '00000000-0000-0000-0000-000000000000';
const imagePath = `auth-1/${base}-full.webp`;
const thumbPath = `auth-1/${base}-thumb.webp`;

describe('private routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.paused = false;
    state.getUser.mockResolvedValue({ data: { user: { id: 'auth-1', email: 'owner@example.com' } }, error: null });
    state.findUnique.mockResolvedValue(state.member);
    state.list.mockResolvedValue({ data: [], error: null });
    state.remove.mockResolvedValue({ data: [], error: null });
    state.createSignedUrls.mockResolvedValue({ data: [], error: null });
    state.letterFindFirst.mockResolvedValue(null);
  });

  it('tells the browser which pause message to show', async () => {
    state.paused = true;
    state.findUnique.mockResolvedValue({ ...state.member, role: 'PARTNER' });
    const response = await app.request('/api/me', { headers: auth });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pause: { message: 'Dean is cooking something' } });
  });

  it('keeps collection data away from a paused partner', async () => {
    state.paused = true;
    state.findUnique.mockResolvedValue({ ...state.member, role: 'PARTNER' });
    const response = await app.request('/api/collection', { headers: auth });
    expect(response.status).toBe(423);
  });

  it('rejects an upload path owned by another member', async () => {
    const response = await app.request('/api/exhibits', json({
      imagePath: `other-1/${base}-full.webp`,
      thumbPath: `other-1/${base}-thumb.webp`,
      title: 'A memory',
      caption: 'A day.',
      alt: 'Two cups',
    }));
    expect(response.status).toBe(400);
  });

  it('rejects a letter with too many paragraphs', async () => {
    const response = await app.request('/api/letter', json({
      title: 'A letter',
      paragraphs: Array.from({ length: 13 }, () => 'A line.'),
      updatedAt: new Date().toISOString(),
    }, 'PUT'));
    expect(response.status).toBe(400);
  });

  it('refuses to overwrite a letter saved by someone else', async () => {
    state.letterFindFirst.mockResolvedValue({
      id: 'letter-1',
      title: 'Old title',
      paragraphs: ['Old words.'],
      active: true,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    state.letterUpdateMany.mockResolvedValue({ count: 0 });
    const response = await app.request('/api/letter', json({
      title: 'New title',
      paragraphs: ['New words.'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, 'PUT'));
    expect(response.status).toBe(409);
    expect(state.letterUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'letter-1', updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    }));
  });

  it('asks an old client to reload before saving a letter', async () => {
    state.letterFindFirst.mockResolvedValue({
      id: 'letter-1',
      title: 'Old title',
      paragraphs: ['Old words.'],
      active: true,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const response = await app.request('/api/letter', json({
      title: 'New title',
      paragraphs: ['New words.'],
    }, 'PUT'));
    expect(response.status).toBe(400);
  });

  it('keeps uploaded files when the exhibit was actually created', async () => {
    state.list.mockResolvedValue({
      data: [{ name: `${base}-full.webp` }, { name: `${base}-thumb.webp` }],
      error: null,
    });
    state.transaction.mockRejectedValue(new Error('connection lost after commit'));
    state.exhibitFindFirst.mockResolvedValue({ id: 'exhibit-1' });
    const response = await app.request('/api/exhibits', json({
      imagePath, thumbPath, title: 'A memory', caption: 'A day.', alt: 'Two cups',
    }));
    expect(response.status).toBe(500);
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('removes uploaded files when no exhibit references them', async () => {
    state.list.mockResolvedValue({
      data: [{ name: `${base}-full.webp` }, { name: `${base}-thumb.webp` }],
      error: null,
    });
    state.transaction.mockRejectedValue(new Error('connection lost'));
    state.exhibitFindFirst.mockResolvedValue(null);
    const response = await app.request('/api/exhibits', json({
      imagePath, thumbPath, title: 'A memory', caption: 'A day.', alt: 'Two cups',
    }));
    expect(response.status).toBe(500);
    expect(state.remove).toHaveBeenCalledWith([imagePath, thumbPath]);
  });
});
