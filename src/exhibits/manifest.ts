import type { ExhibitBase, Manifest } from '../../shared/types';

export type DisplayExhibit = ExhibitBase & { anchor?: string };
export type Exhibit = DisplayExhibit & { anchor: string };
export type { Manifest };

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an exhibit record.');
  return value as Record<string, unknown>;
};

const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${field}.`);
  return value.trim();
};

export const exhibitImageUrl = (value: unknown, field: string, allowSigned = false) => {
  const path = requiredText(value, field);
  const base = 'https://museum.invalid';
  if (path.startsWith('/') && !path.startsWith('//') && new URL(path, base).origin === base) return path;
  if (allowSigned && /^https:\/\//i.test(path) && new URL(path).protocol === 'https:') return path;
  throw new Error(`${field} must use ${allowSigned ? 'a same-origin path or an HTTPS URL' : 'a same-origin path'}.`);
};

export function parseManifest(data: unknown, source: 'sample' | 'private' = 'sample'): Manifest {
  const manifest = record(data);
  const minimum = source === 'private' ? 1 : 8;
  if (!Array.isArray(manifest.exhibits) || manifest.exhibits.length < minimum || manifest.exhibits.length > 12) {
    throw new Error(`The collection must contain ${minimum}–12 exhibits.`);
  }
  const exhibits = manifest.exhibits.map((item): Exhibit => {
    const { id, anchor, title, caption, alt, thumbnailUrl, imageUrl, dateLabel, published } = record(item);
    const exhibitId = requiredText(id, 'exhibit ID');
    return {
      id: exhibitId,
      slug: exhibitId,
      origin: 'ORIGINAL',
      anchor: requiredText(anchor, 'anchor'),
      title: requiredText(title, 'title'),
      caption: requiredText(caption, 'caption'),
      alt: requiredText(alt, 'alt text'),
      thumbnailUrl: exhibitImageUrl(thumbnailUrl, 'thumbnail', source === 'private'),
      imageUrl: exhibitImageUrl(imageUrl, 'close-up', source === 'private'),
      published: source === 'sample' || published !== false,
      ...(dateLabel === undefined ? {} : { dateLabel: requiredText(dateLabel, 'date') }),
    };
  });
  if (new Set(exhibits.map(({ id }) => id)).size !== exhibits.length) throw new Error('Duplicate exhibit ID.');
  if (new Set(exhibits.map(({ anchor }) => anchor)).size !== exhibits.length) throw new Error('Duplicate exhibit anchor.');

  const finale = record(manifest.finale);
  const exhibitId = requiredText(finale.exhibitId, 'finale ID');
  const letterTitle = finale.letterTitle === undefined ? 'A Letter for You' : requiredText(finale.letterTitle, 'letter title');
  if (!exhibits.some(({ id }) => id === exhibitId)) throw new Error('The finale exhibit does not exist.');
  if (!Array.isArray(finale.letterParagraphs) || !finale.letterParagraphs.length) throw new Error('The finale letter is empty.');
  const letterParagraphs = finale.letterParagraphs.map((value) => requiredText(value, 'letter paragraph'));
  return { exhibits, finale: { exhibitId, letterTitle, letterParagraphs } };
}

export async function loadManifest(): Promise<Manifest> {
  const response = await fetch('/content/exhibits.json');
  if (!response.ok) throw new Error('The collection could not be loaded.');
  return parseManifest(await response.json());
}
