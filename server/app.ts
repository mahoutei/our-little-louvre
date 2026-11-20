import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { Hono } from 'hono';
import { LIMITS, STORAGE_BUCKET, UPLOAD_IMAGE_TYPES } from '../shared/config.js';
import { nextWingSlot, WingFullError } from '../shared/slots.js';
import type { ExhibitPatch, NewExhibitInput, WingSlot } from '../shared/types.js';
import { fieldsFrom, tidyCaption, validateExhibitFields } from '../shared/validation.js';
import { allowedEmailResult, memberView, pauseMessageFor, requireMember, requireOpenMuseum, type AppBindings } from './auth.js';
import { env } from './env.js';
import { ApiError, readJson } from './http.js';
import { prisma } from './prisma.js';
import { buildCollection, buildStudioData, isPrivatePhotoPath, readLetter, removeStoragePaths } from './serialize.js';
import { supabaseAdmin } from './supabase.js';

const app = new Hono<AppBindings>().basePath('/api');

const IMAGE_EXTENSION: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const UPLOAD_TYPES = new Set<string>(UPLOAD_IMAGE_TYPES);
const EXHIBIT_LOCK = 771302;
const PATH_PATTERN = /^([a-zA-Z0-9_-]{6,64})\/([a-f0-9-]{36})-(full|thumb)\.(webp|jpg|jpeg|png)$/;

function withExhibitLock<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock returns void, which Prisma cannot deserialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${EXHIBIT_LOCK})`;
    return run(tx);
  }, { isolationLevel: 'ReadCommitted' });
}

async function attachedUploadPaths(tx: Prisma.TransactionClient, paths: string[]) {
  const exhibits = await tx.exhibit.findMany({
    where: { OR: [{ imagePath: { in: paths } }, { thumbPath: { in: paths } }] },
    select: { imagePath: true, thumbPath: true },
  });
  return new Set(exhibits.flatMap(({ imagePath, thumbPath }) => [imagePath, thumbPath]));
}

async function retireUnattachedUploads(tx: Prisma.TransactionClient, paths: string[]): Promise<string[]> {
  const candidates = [...new Set(paths.filter(isPrivatePhotoPath))];
  if (!candidates.length) return [];
  const attached = await attachedUploadPaths(tx, candidates);
  const retired = candidates.filter((path) => !attached.has(path));
  if (retired.length) {
    await tx.discardedUpload.createMany({
      data: retired.map((path) => ({ path })),
      skipDuplicates: true,
    });
  }
  return retired;
}

async function removeRetiredUploads(paths: string[]): Promise<void> {
  await removeStoragePaths(paths).catch((error: unknown) => {
    console.error('Could not remove retired uploads.', error);
  });
}

async function discardUnattachedUploads(paths: string[]): Promise<void> {
  if (!paths.length) return;
  // Keep paths ineligible for new exhibits even if storage removal is slow or fails.
  const retired = await withExhibitLock((tx) => retireUnattachedUploads(tx, paths));
  await removeRetiredUploads(retired);
}

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

async function verifyNewUpload(tx: Prisma.TransactionClient, authId: string, imagePath: string, thumbPath: string) {
  const paths = [imagePath, thumbPath];
  const discarded = await tx.discardedUpload.findFirst({ where: { path: { in: paths } }, select: { path: true } });
  if (discarded) throw new ApiError(409, 'That upload was discarded. Upload the photograph again.');
  const attached = await attachedUploadPaths(tx, paths);
  if (paths.some((path) => attached.has(path))) throw new ApiError(409, 'That upload is already in another frame.');
  await verifyUploaded(authId, imagePath, thumbPath);
}

function fieldsOrThrow(input: Partial<NewExhibitInput>) {
  const fields = fieldsFrom(input);
  const errors = validateExhibitFields(fields);
  if (Object.keys(errors).length) throw new ApiError(400, 'Check the photograph details.', errors);
  return fields;
}

app.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  await next();
});

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
  await discardUnattachedUploads(valid);
  return c.json({ ok: true });
});

app.post('/exhibits', async (c) => {
  const member = c.get('member');
  const { authId } = member;
  if (!authId) throw new ApiError(409, 'Your account is still being prepared. Sign out and back in.');
  const body = await readJson<Record<string, unknown>>(c);

  // Validate the paths first so a rejected form can clean up after itself.
  const image = parseUploadPath(body.imagePath, authId);
  const thumb = parseUploadPath(body.thumbPath, authId);
  const paths = [image.path, thumb.path];

  let createdSlot: WingSlot;
  try {
    const fields = fieldsOrThrow(body as Partial<NewExhibitInput>);
    createdSlot = await withExhibitLock(async (tx) => {
      const existing = await tx.exhibit.findMany({
        where: { origin: 'WING' },
        select: { alleyIndex: true, slotIndex: true, imagePath: true, thumbPath: true },
      });
      const hung = existing.find((exhibit) => exhibit.imagePath === image.path && exhibit.thumbPath === thumb.path);
      const { alleyIndex, slotIndex } = hung ?? {};
      const retry = alleyIndex != null && slotIndex != null;
      if (!retry) await verifyNewUpload(tx, authId, image.path, thumb.path);
      const target = retry
        ? { alleyIndex, slotIndex, newAlley: false }
        : nextWingSlot(existing, env.alleyCapacity, env.maxAlleys);
      const takenInAlley = existing.filter((exhibit) =>
        exhibit.alleyIndex === target.alleyIndex
        && exhibit.slotIndex !== null
        && exhibit.slotIndex >= 0
        && exhibit.slotIndex < env.alleyCapacity
      ).length;
      if (!retry) {
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
      }
      return {
        ...target,
        remainingInAlley: Math.max(0, env.alleyCapacity - takenInAlley - (retry ? 0 : 1)),
      };
    });
  } catch (error) {
    // The exhibit may already exist after a retry or an ambiguous commit.
    await discardUnattachedUploads(paths).catch((cleanupError: unknown) => {
      console.error('Could not clean up exhibit files.', cleanupError);
    });
    throw error;
  }
  return c.json({ collection: await buildCollection(member, true), slot: createdSlot });
});

app.patch('/exhibits/:id', async (c) => {
  const member = c.get('member');
  const body = await readJson<ExhibitPatch & Record<string, unknown>>(c);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Expected photograph changes.');
  const { authId } = member;
  const replacement = body.replacement;
  let files: { imagePath: string; thumbPath: string; width: number | null; height: number | null } | undefined;
  if (replacement !== undefined) {
    if (!authId) throw new ApiError(409, 'Your account is still being prepared. Sign out and back in.');
    if (!replacement || typeof replacement !== 'object' || Array.isArray(replacement)) {
      throw new ApiError(400, 'Choose a replacement photograph.');
    }
    files = {
      imagePath: parseUploadPath(replacement.imagePath, authId).path,
      thumbPath: parseUploadPath(replacement.thumbPath, authId).path,
      width: validDimension(replacement.width) ?? null,
      height: validDimension(replacement.height) ?? null,
    };
  }

  let retired: string[];
  try {
    retired = await withExhibitLock(async (tx) => {
      const existing = await tx.exhibit.findUnique({ where: { id: c.req.param('id') } });
      if (!existing) throw new ApiError(404, 'That photograph is not in the collection.');
      const fields = fieldsOrThrow({
        title: body.title ?? existing.title,
        caption: body.caption ?? existing.caption,
        alt: body.alt ?? existing.alt,
        dateLabel: body.dateLabel ?? existing.dateLabel ?? '',
      });
      const newFiles = files && (files.imagePath !== existing.imagePath || files.thumbPath !== existing.thumbPath) ? files : undefined;
      if (newFiles && authId) await verifyNewUpload(tx, authId, newFiles.imagePath, newFiles.thumbPath);
      const published = existing.origin === 'ORIGINAL' && files ? true
        : existing.origin === 'WING' && typeof body.published === 'boolean' ? body.published : existing.published;
      await tx.exhibit.update({ where: { id: existing.id }, data: { ...fields, dateLabel: fields.dateLabel ?? null, ...files, published } });
      return newFiles ? retireUnattachedUploads(tx, [existing.imagePath, existing.thumbPath]) : [];
    });
  } catch (error) {
    if (files) await discardUnattachedUploads([files.imagePath, files.thumbPath]).catch((cleanupError: unknown) => {
      console.error('Could not clean up replacement files.', cleanupError);
    });
    throw error;
  }
  await removeRetiredUploads(retired);
  return c.json({ collection: await buildCollection(member, true) });
});

app.delete('/exhibits/:id', async (c) => {
  const member = c.get('member');
  const retired = await withExhibitLock(async (tx) => {
    const existing = await tx.exhibit.findUnique({ where: { id: c.req.param('id') } });
    if (!existing) throw new ApiError(404, 'That photograph is not in the collection.');
    if (existing.origin === 'ORIGINAL') {
      await tx.exhibit.update({ where: { id: existing.id }, data: {
        imagePath: '', thumbPath: '', width: null, height: null, published: false,
      } });
    } else {
      await tx.exhibit.delete({ where: { id: existing.id } });
    }
    return retireUnattachedUploads(tx, [existing.imagePath, existing.thumbPath]);
  });
  await removeRetiredUploads(retired);
  return c.json({ collection: await buildCollection(member, true) });
});

app.put('/letter', async (c) => {
  const member = c.get('member');
  const body = await readJson<{ title?: unknown; paragraphs?: unknown; updatedAt?: unknown }>(c);
  const paragraphs = Array.isArray(body.paragraphs)
    ? body.paragraphs.map((paragraph) => tidyCaption(paragraph)).filter(Boolean)
    : [];
  if (paragraphs.length < LIMITS.letterParagraphMin || paragraphs.length > LIMITS.letterParagraphsMax) {
    throw new ApiError(400, `Use between ${LIMITS.letterParagraphMin} and ${LIMITS.letterParagraphsMax} paragraphs.`);
  }
  if (paragraphs.some((paragraph) => paragraph.length > LIMITS.letterParagraphMax)) {
    throw new ApiError(400, `Keep each paragraph under ${LIMITS.letterParagraphMax} characters.`);
  }
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, LIMITS.letterTitleMax) : '';
  const current = await prisma.letter.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } });
  let saved;
  if (current) {
    const updatedAt = typeof body.updatedAt === 'string' ? new Date(body.updatedAt) : undefined;
    if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
      throw new ApiError(400, 'Reload the letter before saving so newer words are not lost.');
    }
    const result = await prisma.letter.updateMany({
      where: { id: current.id, updatedAt },
      data: { ...(title ? { title } : {}), paragraphs, authorId: member.id },
    });
    if (result.count === 0) {
      throw new ApiError(409, 'A newer letter was saved. Reload before saving.');
    }
    saved = await prisma.letter.findUniqueOrThrow({ where: { id: current.id } });
  } else {
    saved = await prisma.letter.create({
      data: { title: title || 'A Letter for You', paragraphs, authorId: member.id },
    });
  }
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
