import { describe, expect, it } from 'vitest';
import { parseManifest } from '../../src/exhibits/manifest';

const example = () => ({
  exhibits: Array.from({ length: 8 }, (_, i) => ({
    id: `photo-${i}`, anchor: `EXHIBIT_${i}`, title: 'Memory', caption: 'A short story',
    alt: 'Two coffee cups', thumbnailUrl: '/content/photo-small.webp', imageUrl: '/content/photo.webp',
  })),
  finale: { exhibitId: 'photo-7', letterTitle: 'A Letter for You', letterParagraphs: ['Dear you,', 'See you soon.'] },
});

describe('exhibit manifest', () => {
  it('keeps the editorial order and resolves the finale by ID', () => {
    const data = example();
    data.exhibits.reverse();
    const result = parseManifest(data);
    expect(result.exhibits[0].id).toBe('photo-7');
    expect(result.finale.exhibitId).toBe('photo-7');
  });

  it('keeps the saved letter title', () => {
    const data = example();
    data.finale.letterTitle = 'The long way home';
    expect(parseManifest(data).finale.letterTitle).toBe('The long way home');
  });

  it('falls back to the default letter title for an older manifest', () => {
    const data = example();
    const { letterTitle, ...finale } = data.finale;
    expect(parseManifest({ ...data, finale }).finale.letterTitle).toBe('A Letter for You');
  });

  it('rejects a missing finale exhibit', () => {
    const data = example();
    data.finale.exhibitId = 'missing';
    expect(() => parseManifest(data)).toThrow(/finale/i);
  });

  it.each(['id', 'anchor'] as const)('rejects a duplicate %s', (key) => {
    const data = example();
    data.exhibits[1][key] = data.exhibits[0][key];
    expect(() => parseManifest(data)).toThrow(/duplicate/i);
  });

  it('rejects off-site display images', () => {
    const data = example();
    data.exhibits[0].imageUrl = '//example.org/photo.webp';
    expect(() => parseManifest(data)).toThrow(/same-origin/i);
  });
});
