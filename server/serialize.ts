import type { Exhibit as DbExhibit, Letter } from '@prisma/client';
import { STORAGE_BUCKET } from '../shared/config.js';
import { groupWingRows } from '../shared/slots.js';
import type {
  Collection,
  Exhibit,
  ExhibitBase,
  LetterView,
  StudioData,
  WingAlley,
  WingExhibit,
} from '../shared/types.js';
import { memberView } from './auth.js';
import { env } from './env.js';
import { ApiError } from './http.js';
import { prisma } from './prisma.js';
import { supabaseAdmin } from './supabase.js';

type DbExhibitWithAuthor = DbExhibit & { author: { name: string } | null };

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;
const PLACEHOLDER = '/museum-placeholder.svg';

export const isPrivatePhotoPath = (path: string) => Boolean(path && !path.startsWith('/'));

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const urls = new Map<string, string>();
  for (let index = 0; index < unique.length; index += 50) {
    const chunk = unique.slice(index, index + 50);
    const { data, error } = await supabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .createSignedUrls(chunk, SIGNED_URL_TTL_SECONDS);
    if (error) {
      console.error('Could not sign exhibit photographs.', error);
      throw new ApiError(502, 'The photographs could not be opened.');
    }
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
  }
  return urls;
}

function baseView(exhibit: DbExhibitWithAuthor, urls: Map<string, string>): ExhibitBase {
  const display = (path: string) => isPrivatePhotoPath(path) ? urls.get(path) ?? PLACEHOLDER : path || PLACEHOLDER;
  return {
    id: exhibit.id,
    slug: exhibit.slug,
    origin: exhibit.origin,
    title: exhibit.title,
    caption: exhibit.caption,
    alt: exhibit.alt,
    ...(exhibit.dateLabel ? { dateLabel: exhibit.dateLabel } : {}),
    thumbnailUrl: display(exhibit.thumbPath),
    imageUrl: display(exhibit.imagePath),
    ...(exhibit.width ? { width: exhibit.width } : {}),
    ...(exhibit.height ? { height: exhibit.height } : {}),
    published: exhibit.published,
    ...(exhibit.author ? { authorName: exhibit.author.name } : {}),
  };
}

function originalView(exhibit: DbExhibitWithAuthor, urls: Map<string, string>): Exhibit {
  if (!exhibit.anchor) throw new Error(`Original exhibit ${exhibit.slug} has no model anchor.`);
  return { ...baseView(exhibit, urls), anchor: exhibit.anchor };
}

function wingView(exhibit: DbExhibitWithAuthor, urls: Map<string, string>): WingExhibit {
  if (exhibit.alleyIndex === null || exhibit.slotIndex === null) {
    throw new Error(`Wing exhibit ${exhibit.slug} has no hanging slot.`);
  }
  return { ...baseView(exhibit, urls), alleyIndex: exhibit.alleyIndex, slotIndex: exhibit.slotIndex };
}

function letterView(letter: Letter | null): LetterView {
  if (!letter) {
    return {
      title: 'A Letter for You',
      paragraphs: ['Dear you,', 'The last page is waiting for the next thing we want to say.'],
      updatedAt: new Date().toISOString(),
    };
  }
  return { title: letter.title, paragraphs: letter.paragraphs, updatedAt: letter.updatedAt.toISOString() };
}

export async function readLetter(): Promise<LetterView> {
  const letter = await prisma.letter.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } });
  return letterView(letter);
}

export async function buildCollection(
  member: Parameters<typeof memberView>[0],
  includeUnpublished = false,
  knownLetter?: LetterView,
): Promise<Collection> {
  const [originals, wing, letter] = await Promise.all([
    prisma.exhibit.findMany({
      where: { origin: 'ORIGINAL' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { author: { select: { name: true } } },
    }),
    prisma.exhibit.findMany({
      where: { origin: 'WING' },
      orderBy: [{ alleyIndex: 'asc' }, { slotIndex: 'asc' }],
      include: { author: { select: { name: true } } },
    }),
    knownLetter ? Promise.resolve(knownLetter) : readLetter(),
  ]);

  if (originals.length < 8) {
    throw new ApiError(503, 'The original collection has not been seeded yet. Run npm run db:seed.');
  }

  const finale = originals.find((exhibit) => exhibit.slug === 'the-story' || exhibit.anchor === 'EXHIBIT_FINALE') ?? originals.at(-1);
  if (!finale) throw new ApiError(503, 'The original finale is missing.');

  const visibleOriginals = includeUnpublished ? originals : originals.filter((exhibit) => exhibit.published || exhibit.id === finale.id);
  const visibleWing = includeUnpublished ? wing : wing.filter((exhibit) => exhibit.published);
  const originalsWithPhotos = includeUnpublished ? visibleOriginals : visibleOriginals.filter((exhibit) => exhibit.published);
  const urls = await signedUrls([...originalsWithPhotos, ...visibleWing]
    .flatMap((exhibit) => [exhibit.thumbPath, exhibit.imagePath]).filter(isPrivatePhotoPath));
  const alleys: WingAlley[] = groupWingRows(wing, env.alleyCapacity).map(({ index, rows, remaining }) => ({
    index,
    remaining,
    exhibits: rows.filter((exhibit) => includeUnpublished || exhibit.published).map((exhibit) => wingView(exhibit, urls)),
  }));
  const total = alleys.reduce((sum, alley) => sum + alley.exhibits.length, 0);

  return {
    museum: { name: env.museumName },
    member: memberView(member),
    manifest: {
      exhibits: visibleOriginals.map((exhibit) => originalView(!includeUnpublished && !exhibit.published ? {
        ...exhibit, title: letter.title, caption: 'Read the final letter.', alt: 'The final letter',
        imagePath: '', thumbPath: '', width: null, height: null, dateLabel: null, author: null,
      } : exhibit, urls)),
      finale: { exhibitId: finale.id, letterTitle: letter.title, letterParagraphs: letter.paragraphs },
    },
    wing: { capacity: env.alleyCapacity, alleys, total },
  };
}

export async function buildStudioData(member: Parameters<typeof memberView>[0]): Promise<Omit<StudioData, 'stats'>> {
  const letter = await readLetter();
  const collection = await buildCollection(member, true, letter);
  return { collection, letter };
}

export async function removeStoragePaths(paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  if (!clean.length) return;
  const { error } = await supabaseAdmin().storage.from(STORAGE_BUCKET).remove(clean);
  if (error) console.error('Could not remove exhibit files.', error);
}
