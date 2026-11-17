import { describe, expect, it } from 'vitest';
import { parseCollection } from '../../src/exhibits/collection';

const original = (index: number) => ({
  id: `photo-${index}`,
  slug: `photo-${index}`,
  origin: 'ORIGINAL',
  anchor: `EXHIBIT_${index}`,
  title: 'A memory',
  caption: 'A short story about the day.',
  alt: 'Two coffee cups',
  thumbnailUrl: '/content/photo-small.webp',
  imageUrl: '/content/photo.webp',
  published: true,
});

const wingPhoto = (overrides: Record<string, unknown> = {}) => ({
  id: 'wing-1',
  slug: 'wing-1',
  origin: 'WING',
  title: 'A newer memory',
  caption: 'The evening we stayed longer.',
  alt: 'A lit café at dusk',
  thumbnailUrl: 'https://example.supabase.co/storage/thumb.webp',
  imageUrl: 'https://example.supabase.co/storage/full.webp',
  published: true,
  alleyIndex: 0,
  slotIndex: 2,
  ...overrides,
});

const collection = (overrides: Record<string, unknown> = {}) => ({
  museum: { name: 'Our Little Louvre' },
  member: { id: 'member-1', name: 'Curator', email: 'curator@example.com', role: 'OWNER' },
  manifest: {
    exhibits: Array.from({ length: 8 }, (_, index) => original(index)),
    finale: { exhibitId: 'photo-7', letterParagraphs: ['Dear you,', 'See you soon.'] },
  },
  wing: { capacity: 6, alleys: [{ index: 0, exhibits: [wingPhoto()] }], total: 1 },
  ...overrides,
});

describe('private collection', () => {
  it('accepts signed wing photographs and keeps their hanging slots', () => {
    const result = parseCollection(collection());
    expect(result.wing.total).toBe(1);
    expect(result.wing.alleys[0].exhibits[0]).toMatchObject({ alleyIndex: 0, slotIndex: 2, origin: 'WING' });
  });

  it('rejects a photograph filed under the wrong alley', () => {
    const data = collection();
    (data.wing.alleys[0].exhibits[0] as Record<string, unknown>).alleyIndex = 1;
    expect(() => parseCollection(data)).toThrow(/wrong alley/i);
  });

  it('rejects two photographs in the same frame', () => {
    const data = collection();
    data.wing.alleys[0].exhibits.push(wingPhoto({ id: 'wing-2', slug: 'wing-2', slotIndex: 2 }));
    data.wing.total = 2;
    expect(() => parseCollection(data)).toThrow(/share a frame/i);
  });

  it('rejects a wing count that disagrees with the frames', () => {
    const data = collection();
    data.wing.total = 4;
    expect(() => parseCollection(data)).toThrow(/does not match/i);
  });

  it('rejects a guest without a member role', () => {
    const data = collection();
    data.member.role = 'GUEST';
    expect(() => parseCollection(data)).toThrow(/role/i);
  });
});
