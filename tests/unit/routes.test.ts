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
  exhibitFindUnique: vi.fn(),
  exhibitFindMany: vi.fn(),
  exhibitCreate: vi.fn(),
  exhibitUpdate: vi.fn(),
  exhibitDelete: vi.fn(),
  letterFindFirst: vi.fn(),
  letterFindUnique: vi.fn(),
  letterUpdateMany: vi.fn(),
  letterUpdate: vi.fn(),
  letterCreate: vi.fn(),
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  discardPaths: vi.fn(),
  findDiscardedPath: vi.fn(),
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
      findUnique: state.exhibitFindUnique,
      findMany: state.exhibitFindMany,
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
import vercelFunction from '../../api';

it('dispatches nested API requests through the Vercel Web handler', async () => {
  const response = await vercelFunction.fetch(
    new Request('https://museum.example/api/uploads/discard', { method: 'POST' }),
  );
  expect(response.status).toBe(401);
});

const auth = { Authorization: 'Bearer test-token' };
const json = (body: unknown, method = 'POST') => ({
  method,
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const base = '00000000-0000-0000-0000-000000000000';
const imagePath = `auth-1/${base}-full.webp`;
const thumbPath = `auth-1/${base}-thumb.webp`;
const newExhibit = { imagePath, thumbPath, title: 'A memory', caption: 'A day.', alt: 'Two cups' };
const hungExhibit = {
  ...newExhibit,
  id: 'exhibit-1',
  slug: 'wing-exhibit-1',
  origin: 'WING',
  anchor: null,
  dateLabel: null,
  width: null,
  height: null,
  published: true,
  sortOrder: 0,
  alleyIndex: 0,
  slotIndex: 2,
  authorId: state.member.id,
  author: { name: state.member.name },
  createdAt: state.member.createdAt,
  updatedAt: state.member.updatedAt,
};
const originals = Array.from({ length: 8 }, (_, index) => ({
  ...hungExhibit,
  id: `original-${index}`,
  slug: `original-${index}`,
  origin: 'ORIGINAL',
  anchor: `EXHIBIT_${index}`,
  imagePath: `/original-${index}.webp`,
  thumbPath: `/original-${index}-thumb.webp`,
}));
const transactionClient = {
  $executeRaw: state.executeRaw,
  exhibit: {
    findUnique: state.exhibitFindUnique,
    findMany: state.exhibitFindMany,
    create: state.exhibitCreate,
    update: state.exhibitUpdate,
    delete: state.exhibitDelete,
  },
  discardedUpload: { createMany: state.discardPaths, findFirst: state.findDiscardedPath },
};

describe('private routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.paused = false;
    state.getUser.mockResolvedValue({ data: { user: { id: 'auth-1', email: 'owner@example.com' } }, error: null });
    state.findUnique.mockResolvedValue(state.member);
    state.list.mockResolvedValue({ data: [], error: null });
    state.remove.mockResolvedValue({ data: [], error: null });
    state.exhibitFindMany.mockResolvedValue([]);
    state.transaction.mockImplementation(async (run) => run(transactionClient));
    state.discardPaths.mockResolvedValue({ count: 2 });
    state.findDiscardedPath.mockResolvedValue(null);
    state.createSignedUrls.mockResolvedValue({ data: [], error: null });
    state.letterFindFirst.mockResolvedValue(null);
  });

  it('tells the browser which pause message to show', async () => {
    state.paused = true;
    state.findUnique.mockResolvedValue({ ...state.member, role: 'PARTNER' });
    const response = await app.request('/api/me', { headers: auth });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ pause: { message: 'Dean is cooking something' } });
  });

  it('keeps collection data away from a paused partner', async () => {
    state.paused = true;
    state.findUnique.mockResolvedValue({ ...state.member, role: 'PARTNER' });
    const response = await app.request('/api/collection', { headers: auth });
    expect(response.status).toBe(423);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
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

  it('discards only files owned by the caller and unused by the collection', async () => {
    const orphan = `auth-1/${base}-full.jpg`;
    const other = `other-1/${base}-full.webp`;
    state.exhibitFindMany.mockResolvedValue([{ imagePath, thumbPath }]);
    const response = await app.request('/api/uploads/discard', json({ paths: [imagePath, thumbPath, orphan, other] }));
    expect(response.status).toBe(200);
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([orphan]);
  });

  it('keeps upload files when the reference check fails', async () => {
    state.exhibitFindMany.mockRejectedValue(new Error('database unavailable'));
    const response = await app.request('/api/uploads/discard', json({ paths: [imagePath, thumbPath] }));
    expect(response.status).toBe(500);
    expect(state.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['discarding an upload', '/api/uploads/discard', json({ paths: [imagePath] })],
    ['deleting an exhibit', '/api/exhibits/exhibit-1', { method: 'DELETE', headers: auth }],
  ])('rejects a create while storage removal is pending after %s', async (_operation, path, request) => {
    state.exhibitFindUnique.mockResolvedValue(hungExhibit);
    state.exhibitFindMany.mockImplementation(async ({ where }) =>
      where.origin === 'ORIGINAL' ? originals : []
    );
    state.list.mockResolvedValue({
      data: [{ name: `${base}-full.webp` }, { name: `${base}-thumb.webp` }],
      error: null,
    });
    const discarded = new Set<string>();
    let committed = false;
    state.discardPaths.mockImplementation(async ({ data }: { data: { path: string }[] }) => {
      for (const entry of data) discarded.add(entry.path);
      return { count: data.length };
    });
    state.findDiscardedPath.mockImplementation(async ({ where }: { where: { path: { in: string[] } } }) => {
      const found = where.path.in.find((candidate) => discarded.has(candidate));
      return found ? { path: found } : null;
    });
    state.transaction.mockImplementationOnce(async (run) => {
      const result = await run(transactionClient);
      committed = true;
      return result;
    });
    let createDuringRemoval: Response | undefined;
    let removalAfterCommit = false;
    state.remove.mockImplementationOnce(async () => {
      removalAfterCommit = committed;
      createDuringRemoval = await app.request('/api/exhibits', json(newExhibit));
      return { data: [], error: null };
    });
    const response = await app.request(path, request);
    expect(response.status).toBe(200);
    expect(createDuringRemoval?.status).toBe(409);
    expect(removalAfterCommit).toBe(true);
    expect(state.exhibitCreate).not.toHaveBeenCalled();
  });

  it('keeps a hung photograph when another create request has invalid details', async () => {
    state.exhibitFindMany.mockResolvedValue([{ imagePath, thumbPath }]);
    const response = await app.request('/api/exhibits', json({ ...newExhibit, title: '' }));
    expect(response.status).toBe(400);
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('returns the existing frame when exhibit creation is retried', async () => {
    state.list.mockResolvedValue({
      data: [{ name: `${base}-full.webp` }, { name: `${base}-thumb.webp` }],
      error: null,
    });
    state.exhibitFindMany.mockImplementation(async ({ where }) =>
      where.origin === 'ORIGINAL' ? originals : [hungExhibit]
    );
    const response = await app.request('/api/exhibits', json(newExhibit));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      slot: { alleyIndex: 0, slotIndex: 2, newAlley: false, remainingInAlley: 5 },
    });
    expect(state.exhibitCreate).not.toHaveBeenCalled();
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('keeps shared files when a duplicate exhibit is deleted', async () => {
    const survivor = { ...hungExhibit, id: 'exhibit-2', slug: 'wing-exhibit-2', slotIndex: 3 };
    state.exhibitFindUnique.mockResolvedValue(hungExhibit);
    state.exhibitFindMany.mockImplementation(async ({ where }) =>
      where.origin === 'ORIGINAL' ? originals : [survivor]
    );
    const response = await app.request('/api/exhibits/exhibit-1', { method: 'DELETE', headers: auth });
    expect(response.status).toBe(200);
    expect(state.exhibitDelete).toHaveBeenCalledWith({ where: { id: 'exhibit-1' } });
    expect(state.remove).not.toHaveBeenCalled();
  });

  it.each(['ORIGINAL', 'WING'])('replaces a %s photograph in place and signs the new files', async (origin) => {
    const previous = origin === 'ORIGINAL'
      ? { ...originals[0], imagePath: '', thumbPath: '', published: false }
      : { ...hungExhibit, imagePath: 'old-author/photo.webp', thumbPath: 'old-author/thumb.webp' };
    let saved = previous;
    state.exhibitFindUnique.mockResolvedValue(previous);
    state.exhibitUpdate.mockImplementation(async ({ data }) => { saved = { ...previous, ...data }; return saved; });
    state.exhibitFindMany.mockImplementation(async ({ where }) => where.origin === 'ORIGINAL'
      ? originals.map((item) => item.id === saved.id ? saved : item)
      : where.origin === 'WING' && origin === 'WING' ? [saved] : []);
    state.list.mockResolvedValue({ data: [{ name: `${base}-full.webp` }, { name: `${base}-thumb.webp` }], error: null });
    state.createSignedUrls.mockResolvedValue({ data: [imagePath, thumbPath].map((path) => ({
      path, signedUrl: `https://test.supabase.co/signed/${path}`,
    })), error: null });

    const response = await app.request(`/api/exhibits/${previous.id}`, json({
      caption: 'A different evening.', replacement: { imagePath, thumbPath, width: 1200, height: 800 },
    }, 'PATCH'));
    expect(response.status).toBe(200);
    expect(saved).toMatchObject({ id: previous.id, anchor: previous.anchor, slotIndex: previous.slotIndex,
      imagePath, thumbPath, caption: 'A different evening.', width: 1200, height: 800, published: true });
    const { collection } = await response.json();
    const result = origin === 'ORIGINAL' ? collection.manifest.exhibits[0] : collection.wing.alleys[0].exhibits[0];
    expect(result.imageUrl).toBe(`https://test.supabase.co/signed/${imagePath}`);
    if (origin === 'WING') expect(state.remove).toHaveBeenCalledWith([previous.imagePath, previous.thumbPath]);
    else expect(state.remove).not.toHaveBeenCalled();
  });

  it('rejects a replacement owned by someone else and keeps the original', async () => {
    state.exhibitFindUnique.mockResolvedValue(originals[0]);
    const response = await app.request('/api/exhibits/original-0', json({ replacement: {
      imagePath: `other-1/${base}-full.webp`, thumbPath: `other-1/${base}-thumb.webp`,
    } }, 'PATCH'));
    expect(response.status).toBe(400);
    expect(state.exhibitUpdate).not.toHaveBeenCalled();
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('keeps another frame intact when its upload is submitted as a replacement', async () => {
    state.exhibitFindUnique.mockResolvedValue(originals[0]);
    state.exhibitFindMany.mockResolvedValue([hungExhibit]);
    const response = await app.request('/api/exhibits/original-0', json({ replacement: { imagePath, thumbPath } }, 'PATCH'));
    expect(response.status).toBe(409);
    expect(state.exhibitUpdate).not.toHaveBeenCalled();
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('clears an original photograph and keeps its frame in the studio', async () => {
    let saved = originals[0];
    state.exhibitFindUnique.mockResolvedValue(saved);
    state.exhibitUpdate.mockImplementation(async ({ data }) => { saved = { ...saved, ...data }; return saved; });
    state.exhibitFindMany.mockImplementation(async ({ where }) => where.origin === 'ORIGINAL' ? [saved, ...originals.slice(1)] : []);

    const deleted = await app.request('/api/exhibits/original-0', { method: 'DELETE', headers: auth });
    expect(deleted.status).toBe(200);
    expect((await deleted.json()).collection.manifest.exhibits[0]).toMatchObject({ id: 'original-0', anchor: 'EXHIBIT_0', published: false });
    const visit = await app.request('/api/collection', { headers: auth });
    expect(visit.status).toBe(200);
    expect((await visit.json()).collection.manifest.exhibits.map(({ id }: { id: string }) => id)).not.toContain('original-0');
    expect(state.exhibitDelete).not.toHaveBeenCalled();
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('keeps the letter reachable when the finale photograph has been cleared', async () => {
    state.exhibitFindMany.mockImplementation(async ({ where }) => where.origin === 'ORIGINAL'
      ? originals.map((item) => ({ ...item, imagePath: '', thumbPath: '', published: false })) : []);
    const response = await app.request('/api/collection', { headers: auth });
    expect(response.status).toBe(200);
    const { collection } = await response.json();
    expect(collection.manifest.exhibits).toEqual([expect.objectContaining({ id: 'original-7', published: false, title: 'A Letter for You' })]);
    expect(collection.manifest.finale.letterParagraphs).not.toHaveLength(0);
    expect(state.createSignedUrls).not.toHaveBeenCalled();
  });

  it('reports a deleted exhibit when the subsequent storage removal fails', async () => {
    state.exhibitFindUnique.mockResolvedValue(hungExhibit);
    state.exhibitFindMany.mockImplementation(async ({ where }) =>
      where.origin === 'ORIGINAL' ? originals : []
    );
    state.remove.mockRejectedValue(new Error('storage unavailable'));
    const response = await app.request('/api/exhibits/exhibit-1', { method: 'DELETE', headers: auth });
    expect(response.status).toBe(200);
    expect(state.exhibitDelete).toHaveBeenCalledWith({ where: { id: 'exhibit-1' } });
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
    state.transaction.mockRejectedValueOnce(new Error('connection lost after commit'));
    state.exhibitFindMany.mockResolvedValue([{ imagePath, thumbPath }]);
    const response = await app.request('/api/exhibits', json(newExhibit));
    expect(response.status).toBe(500);
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('removes uploaded files when no exhibit references them', async () => {
    state.list.mockResolvedValue({
      data: [{ name: `${base}-full.webp` }, { name: `${base}-thumb.webp` }],
      error: null,
    });
    state.transaction.mockRejectedValueOnce(new Error('connection lost'));
    const response = await app.request('/api/exhibits', json(newExhibit));
    expect(response.status).toBe(500);
    expect(state.remove).toHaveBeenCalledWith([imagePath, thumbPath]);
  });
});
