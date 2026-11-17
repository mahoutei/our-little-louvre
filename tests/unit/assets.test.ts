import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../../src/exhibits/manifest';
import { hall } from '../../src/museum/layout';

describe('exported gallery', () => {
  it('preserves the second UV set for the baked architecture light map', async () => {
    const file = await readFile('public/models/gallery.glb');
    const chunkBytes = file.readUInt32LE(12);
    const content = JSON.parse(file.subarray(20, 20 + chunkBytes).toString('utf8')) as {
      meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[];
    };
    for (const surface of ['Parquet', 'Warm Plaster', 'Limestone', 'Trim', 'Deep Stone', 'Vault']) {
      const mesh = content.meshes.find(({ name }) => name === surface);
      expect(mesh?.primitives.length, surface).toBeGreaterThan(0);
      for (const primitive of mesh!.primitives) expect(primitive.attributes.TEXCOORD_1, surface).toBeTypeOf('number');
    }
    const atlas = await readFile('public/materials/gallery-light.webp');
    expect(atlas.toString('ascii', 8, 12)).toBe('WEBP');
  });

  it('has exactly one named anchor for every manifest exhibit', async () => {
    const file = await readFile('public/models/gallery.glb');
    const chunkBytes = file.readUInt32LE(12);
    const content = JSON.parse(file.subarray(20, 20 + chunkBytes).toString('utf8')) as { nodes: { name?: string; translation?: [number, number, number] }[] };
    const manifest = parseManifest(JSON.parse(await readFile('public/content/exhibits.json', 'utf8')));
    for (const exhibit of manifest.exhibits) {
      expect(content.nodes.filter(({ name }) => name === exhibit.anchor), exhibit.anchor).toHaveLength(1);
    }
    for (const wing of hall.wings) {
      for (const exhibit of wing.exhibits) {
        const position = content.nodes.find(({ name }) => name === exhibit.anchor)?.translation;
        expect(position?.[0] ?? 0, exhibit.anchor).toBeCloseTo(wing.side * (wing.outerX - 0.18));
        expect(position?.[2] ?? 0, exhibit.anchor).toBeCloseTo(exhibit.z);
      }
    }
  });
});
