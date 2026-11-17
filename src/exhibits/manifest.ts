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

const imagePath = (value: unknown, field: string) => {
  const path = requiredText(value, field);
  const base = 'https://museum.invalid';
  if (!path.startsWith('/') || path.startsWith('//') || new URL(path, base).origin !== base) {
    throw new Error(`${field} must use a same-origin path.`);
  }
  return path;
};

export function parseManifest(data: unknown): Manifest {
  const manifest = record(data);
  if (!Array.isArray(manifest.exhibits) || manifest.exhibits.length < 8 || manifest.exhibits.length > 12) {
    throw new Error('The collection must contain 8–12 exhibits.');
  }
  const exhibits = manifest.exhibits.map((item): Exhibit => {
    const { id, anchor, title, caption, alt, thumbnailUrl, imageUrl, dateLabel } = record(item);
    const exhibitId = requiredText(id, 'exhibit ID');
    return {
      id: exhibitId,
      slug: exhibitId,
      origin: 'ORIGINAL',
      anchor: requiredText(anchor, 'anchor'),
      title: requiredText(title, 'title'),
      caption: requiredText(caption, 'caption'),
      alt: requiredText(alt, 'alt text'),
      thumbnailUrl: imagePath(thumbnailUrl, 'thumbnail'),
      imageUrl: imagePath(imageUrl, 'close-up'),
      published: true,
      ...(dateLabel === undefined ? {} : { dateLabel: requiredText(dateLabel, 'date') }),
    };
  });
  if (new Set(exhibits.map(({ id }) => id)).size !== exhibits.length) throw new Error('Duplicate exhibit ID.');
  if (new Set(exhibits.map(({ anchor }) => anchor)).size !== exhibits.length) throw new Error('Duplicate exhibit anchor.');

  const finale = record(manifest.finale);
  const exhibitId = requiredText(finale.exhibitId, 'finale ID');
  if (!exhibits.some(({ id }) => id === exhibitId)) throw new Error('The finale exhibit does not exist.');
  if (!Array.isArray(finale.letterParagraphs) || !finale.letterParagraphs.length) throw new Error('The finale letter is empty.');
  const letterParagraphs = finale.letterParagraphs.map((value) => requiredText(value, 'letter paragraph'));
  return { exhibits, finale: { exhibitId, letterParagraphs } };
}

export async function loadManifest(): Promise<Manifest> {
  const response = await fetch('/content/exhibits.json');
  if (!response.ok) throw new Error('The collection could not be loaded.');
  return parseManifest(await response.json());
}
