import type { Collection, Role, WingAlley, WingExhibit } from '../../shared/types';
import { parseManifest } from './manifest';

const record = (value: unknown, field = 'record'): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected ${field}.`);
  return value as Record<string, unknown>;
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${field}.`);
  return value.trim();
};

const optionalText = (value: unknown, field: string): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return text(value, field);
};

const optionalDimension = (value: unknown, field: string): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 20_000) throw new Error(`Invalid ${field}.`);
  return number;
};

const displayUrl = (value: unknown, field: string): string => {
  const url = text(value, field);
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (!/^https:\/\//i.test(url)) throw new Error(`${field} must be a same-origin path or an https URL.`);
  return url;
};

function wingExhibit(value: unknown, alleyIndex: number, capacity: number, seen: Set<string>): WingExhibit {
  const item = record(value, 'wing exhibit');
  const id = text(item.id, 'exhibit ID');
  if (seen.has(id)) throw new Error('Duplicate exhibit ID.');
  seen.add(id);
  if (item.origin !== 'WING') throw new Error('The New Wing contains a non-wing exhibit.');
  if (typeof item.published !== 'boolean') throw new Error('Missing exhibit visibility.');
  const slotIndex = Number(item.slotIndex);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= capacity) throw new Error('Invalid frame slot.');
  if (Number(item.alleyIndex) !== alleyIndex) throw new Error('The exhibit is in the wrong alley.');
  return {
    id,
    slug: text(item.slug, 'slug'),
    origin: 'WING',
    title: text(item.title, 'title'),
    caption: text(item.caption, 'caption'),
    alt: text(item.alt, 'alt text'),
    thumbnailUrl: displayUrl(item.thumbnailUrl, 'thumbnail'),
    imageUrl: displayUrl(item.imageUrl, 'image URL'),
    published: item.published,
    alleyIndex,
    slotIndex,
    ...(optionalText(item.dateLabel, 'date') ? { dateLabel: optionalText(item.dateLabel, 'date') } : {}),
    ...(optionalDimension(item.width, 'width') ? { width: optionalDimension(item.width, 'width') } : {}),
    ...(optionalDimension(item.height, 'height') ? { height: optionalDimension(item.height, 'height') } : {}),
    ...(optionalText(item.authorName, 'author') ? { authorName: optionalText(item.authorName, 'author') } : {}),
  };
}

export function parseCollection(data: unknown): Collection {
  const root = record(data, 'collection');
  const museum = record(root.museum, 'museum');
  const member = record(root.member, 'member');
  const manifest = parseManifest(root.manifest);

  const role = member.role === 'OWNER' || member.role === 'PARTNER' ? (member.role as Role) : undefined;
  if (!role) throw new Error('Invalid member role.');

  const wing = record(root.wing, 'wing');
  const capacity = Number(wing.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 24) throw new Error('Invalid alley capacity.');
  if (!Array.isArray(wing.alleys)) throw new Error('Missing New Wing alleys.');

  const seen = new Set(manifest.exhibits.map(({ id }) => id));
  const indexes = new Set<number>();
  const alleys: WingAlley[] = [];
  for (const value of wing.alleys) {
    const alley = record(value, 'alley');
    const index = Number(alley.index);
    if (!Number.isInteger(index) || index < 0) throw new Error('Invalid alley number.');
    if (indexes.has(index)) throw new Error('Duplicate alley number.');
    indexes.add(index);
    if (!Array.isArray(alley.exhibits)) throw new Error('Missing alley exhibits.');
    const exhibits = alley.exhibits.map((exhibit) => wingExhibit(exhibit, index, capacity, seen));
    if (new Set(exhibits.map(({ slotIndex }) => slotIndex)).size !== exhibits.length) {
      throw new Error('Two exhibits share a frame.');
    }
    alleys.push({ index, exhibits });
  }
  alleys.sort((a, b) => a.index - b.index);

  const total = Number(wing.total);
  const counted = alleys.reduce((sum, alley) => sum + alley.exhibits.length, 0);
  if (!Number.isInteger(total) || total !== counted) throw new Error('The New Wing count does not match its frames.');

  return {
    museum: { name: text(museum.name, 'museum name') },
    member: {
      id: text(member.id, 'member ID'),
      name: text(member.name, 'member name'),
      email: text(member.email, 'member email'),
      role,
    },
    manifest,
    wing: { capacity, alleys, total },
  };
}
