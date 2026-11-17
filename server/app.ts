import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { STORAGE_BUCKET, UPLOAD_IMAGE_TYPES } from '../shared/config';
import { nextWingSlot, WingFullError } from '../shared/slots';
import type { ExhibitPatch, NewExhibitInput, WingSlot } from '../shared/types';
import { fieldsFrom, tidyCaption, validateExhibitFields } from '../shared/validation';
import { allowedEmailResult, memberView, pauseMessageFor, requireMember, requireOpenMuseum, type AppBindings } from './auth';
import { env, guestListReady, serverReady } from './env';
import { ApiError, readJson } from './http';
import { prisma } from './prisma';
import { buildCollection, buildStudioData, readLetter, removeStoragePaths } from './serialize';
import { supabaseAdmin } from './supabase';

const app = new Hono<AppBindings>().basePath('/api');

const IMAGE_EXTENSION: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const UPLOAD_TYPES = new Set<string>(UPLOAD_IMAGE_TYPES);
const WING_LOCK = 771302;
const PATH_PATTERN = /^([a-zA-Z0-9_-]{6,64})\/([a-f0-9-]{36})-(full|thumb)\.(webp|jpg|jpeg|png)$/;

function validDimension(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(number) && number > 0 && number <= 20_000 ? number : undefined;
}

function parseUploadPath(value: unknown, authId: string) {
  const path = typeof value === 'string' ? value : '';
  const match = PATH_PATTERN.exec(path);
  if (!match || match[1] !== authId) throw new ApiError(400, 'That photograph upload is not valid.');
  return { path, base: match[2], kind: match[3], extension: match[4] };
}

async function verifyUploaded(authId: string, imagePath: string, thumbPath: string) {
  const image = parseUploadPath(imagePath, authId);
  const thumb = parseUploadPath(thumbPath, authId);
  if (image.kind !== 'full' || thumb.kind !== 'thumb' || image.base !== thumb.base) {
    throw new ApiError(400, 'The photograph and its thumbnail do not belong together.');
  }
  const { data, error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKET)
    .list(authId, { search: image.base, limit: 20 });
  if (error) throw new ApiError(503, 'The photograph store is unavailable. Try again in a moment.');
  const names = new Set((data ?? []).map((entry) => entry.name));
  const missing = [imagePath, thumbPath].filter((path) => !names.has(path.slice(authId.length + 1)));
  if (missing.length) throw new ApiError(400, 'The photograph did not finish uploading. Try again.');
}

function fieldsOrThrow(input: Partial<NewExhibitInput>) {
  const fields = fieldsFrom(input);
  const errors = validateExhibitFields(fields);
  if (Object.keys(errors).length) throw new ApiError(400, 'Check the photograph details.', errors);
  return fields;
}

app.get('/health', (c) => c.json({ ok: true, configured: serverReady(), guestList: guestListReady() }));

app.get('/auth/allowed', (c) => c.json(allowedEmailResult(c.req.query('email') ?? '')));

app.use('/me', requireMember);
app.use('/collection', requireMember, requireOpenMuseum);
app.use('/studio', requireMember, requireOpenMuseum);
app.use('/uploads', requireMember, requireOpenMuseum);
app.use('/uploads/*', requireMember, requireOpenMuseum);
app.use('/exhibits', requireMember, requireOpenMuseum);
app.use('/exhibits/*', requireMember, requireOpenMuseum);
app.use('/letter', requireMember, requireOpenMuseum);

app.get('/me', (c) => {
  const member = c.get('member');
  const pause = pauseMessageFor(member);
  return c.json({
    member: memberView(member),
    museum: { name: env.museumName },
    ...(pause ? { pause: { message: pause } } : {}),
  });
});

app.patch('/me', requireOpenMuseum, async (c) => {
  const member = c.get('member');
  const body = await readJson<{ name?: unknown }>(c);
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 60) throw new ApiError(400, 'Use a name between 1 and 60 characters.');
  const updated = await prisma.member.update({ where: { id: member.id }, data: { name } });
  return c.json({ member: memberView(updated) });
});

app.get('/collection', async (c) => {
  return c.json({ collection: await buildCollection(c.get('member')) });
});

app.get('/studio', async (c) => {
  return c.json(await buildStudioData(c.get('member')));
});

app.post('/uploads', async (c) => {
  const member = c.get('member');
  if (!member.authId) throw new ApiError(409, 'Your account is still being prepared. Sign out and back in.');
  const body = await readJson<{ files?: { kind?: unknown; contentType?: unknown }[] }>(c);
  if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 2) {
    throw new ApiError(400, 'Ask for a full photograph and its thumbnail.');
  }
  const seen = new Set<string>();
  const files = body.files.map((file) => {
    const kind = file.kind === 'full' || file.kind === 'thumb' ? file.kind : '';
    const contentType = typeof file.contentType === 'string' ? file.contentType : '';
    if (!kind || seen.has(kind)) throw new ApiError(400, 'Ask for one full photograph and one thumbnail.');
    if (!UPLOAD_TYPES.has(contentType)) throw new ApiError(400, 'Use a JPEG, PNG, or WebP photograph.');
    seen.add(kind);
    const extension = IMAGE_EXTENSION[contentType];
    return { kind, contentType, extension };
  });
  if (!seen.has('full') || !seen.has('thumb')) throw new ApiError(400, 'Ask for a full photograph and its thumbnail.');

  const base = randomUUID();
  const issued: { kind: string; path: string; token: string; contentType: string }[] = [];
  for (const file of files) {
    const path = `${member.authId}/${base}-${file.kind}.${file.extension}`;
    const { data, error } = await supabaseAdmin().storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error('Could not create a signed upload URL.', error);
      throw new ApiError(503, 'The photograph store is not ready. Run npm run setup:supabase and try again.');
    }
    issued.push({ kind: file.kind, path, token: data.token, contentType: file.contentType });
  }
  return c.json({ files: issued });
});

app.post('/uploads/discard', async (c) => {
  const member = c.get('member');
  const body = await readJson<{ paths?: unknown }>(c);
  const paths = Array.isArray(body.paths) ? body.paths.filter((path): path is string => typeof path === 'string').slice(0, 4) : [];
  if (!member.authId) throw new ApiError(409, 'Your account is still being prepared.');
  const valid = paths.filter((path) => {
    const match = PATH_PATTERN.exec(path);
    return Boolean(match && match[1] === member.authId);
  });
  await removeStoragePaths(valid);
  return c.json({ ok: true });
});

app.post('/exhibits', async (c) => {
  const member = c.get('member');
  if (!member.authId) throw new ApiError(409, 'Your account is still being prepared. Sign out and back in.');
  const body = await readJson<Record<string, unknown>>(c);

  // Validate the paths first so a rejected form can clean up after itself.
  const image = parseUploadPath(body.imagePath, member.authId);
  const thumb = parseUploadPath(body.thumbPath, member.authId);
  let fields;
  try {
    fields = fieldsOrThrow(body as Partial<NewExhibitInput>);
  } catch (error) {
    await removeStoragePaths([image.path, thumb.path]);
    throw error;
  }

  await verifyUploaded(member.authId, image.path, thumb.path);

  let createdSlot: WingSlot;
  try {
    createdSlot = await prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock returns void, which Prisma cannot deserialize.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WING_LOCK})`;
      const existing = await tx.exhibit.findMany({
        where: { origin: 'WING' },
        select: { alleyIndex: true, slotIndex: true },
      });
      const target = nextWingSlot(existing, env.alleyCapacity, env.maxAlleys);
      const takenInAlley = existing.filter((exhibit) => exhibit.alleyIndex === target.alleyIndex).length;
      await tx.exhibit.create({
        data: {
          ...fields,
          slug: `wing-${randomUUID()}`,
          origin: 'WING',
          imagePath: image.path,
          thumbPath: thumb.path,
          width: validDimension(body.width) ?? null,
          height: validDimension(body.height) ?? null,
          alleyIndex: target.alleyIndex,
          slotIndex: target.slotIndex,
          authorId: member.id,
        },
      });
      return {
        ...target,
        remainingInAlley: Math.max(0, env.alleyCapacity - takenInAlley - 1),
      };
    });
  } catch (error) {
    await removeStoragePaths([image.path, thumb.path]);
    if (error instanceof WingFullError) throw new ApiError(409, error.message);
    throw error;
  }

  return c.json({ collection: await buildCollection(member, true), slot: createdSlot });
});

app.patch('/exhibits/:id', async (c) => {
  const member = c.get('member');
  const existing = await prisma.exhibit.findUnique({ where: { id: c.req.param('id') } });
  if (!existing) throw new ApiError(404, 'That photograph is not in the collection.');
  const body = await readJson<ExhibitPatch & Record<string, unknown>>(c);
  const fields = fieldsOrThrow({
    title: body.title ?? existing.title,
    caption: body.caption ?? existing.caption,
    alt: body.alt ?? existing.alt,
    dateLabel: body.dateLabel ?? existing.dateLabel ?? '',
  });
  const data = {
    title: fields.title,
    caption: fields.caption,
    alt: fields.alt,
    dateLabel: fields.dateLabel ?? null,
    ...(existing.origin === 'WING' && typeof body.published === 'boolean' ? { published: body.published } : {}),
  };
  await prisma.exhibit.update({ where: { id: existing.id }, data });
  return c.json({ collection: await buildCollection(member, true) });
});

app.delete('/exhibits/:id', async (c) => {
  const member = c.get('member');
  const existing = await prisma.exhibit.findUnique({ where: { id: c.req.param('id') } });
  if (!existing) throw new ApiError(404, 'That photograph is not in the collection.');
  if (existing.origin === 'ORIGINAL') {
    throw new ApiError(400, 'The original collection is part of the building and cannot be removed.');
  }
  await prisma.exhibit.delete({ where: { id: existing.id } });
  await removeStoragePaths([existing.imagePath, existing.thumbPath]);
  return c.json({ collection: await buildCollection(member, true) });
});

app.put('/letter', async (c) => {
  const member = c.get('member');
  const body = await readJson<{ title?: unknown; paragraphs?: unknown }>(c);
  const paragraphs = Array.isArray(body.paragraphs)
    ? body.paragraphs.map((paragraph) => tidyCaption(paragraph)).filter(Boolean)
    : [];
  if (paragraphs.length < 1 || paragraphs.length > 12) throw new ApiError(400, 'Use between 1 and 12 paragraphs.');
  if (paragraphs.some((paragraph) => paragraph.length > 4000)) throw new ApiError(400, 'Keep each paragraph under 4,000 characters.');
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
  const current = await prisma.letter.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } });
  const saved = current
    ? await prisma.letter.update({
        where: { id: current.id },
        data: { ...(title ? { title } : {}), paragraphs, authorId: member.id },
      })
    : await prisma.letter.create({
        data: { title: title || 'A Letter for You', paragraphs, authorId: member.id },
      });
  const letter = {
    title: saved.title,
    paragraphs: saved.paragraphs,
    updatedAt: saved.updatedAt.toISOString(),
  };
  return c.json({ letter, collection: await buildCollection(member, true, letter) });
});

app.notFound((c) => c.json({ error: 'That page is not part of the museum.' }, 404));

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.message, ...(error.fields ? { fields: error.fields } : {}) }, error.status);
  }
  if (error instanceof WingFullError) return c.json({ error: error.message }, 409);
  console.error('Museum API error', error);
  return c.json({ error: 'Something went wrong in the museum office. Try again.' }, 500);
});

export { app };
