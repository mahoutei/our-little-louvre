import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../../src/exhibits/manifest';
import { hall } from '../../src/museum/layout';

describe('exported gallery', () => {
  it('has a real open arch from the main hall into the New Wing', async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const model = await io.read('public/models/gallery.glb');
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const shells = model.getRoot().listNodes().flatMap((node) => (node.getMesh()?.listPrimitives() ?? []).map((primitive) => {
      const geometry = new BufferGeometry();
      const positions = primitive.getAttribute('POSITION')!;
      const decoded = new Float32Array(positions.getCount() * 3);
      const vertex: number[] = [];
      for (let index = 0; index < positions.getCount(); index++) decoded.set(positions.getElement(index, vertex), index * 3);
      geometry.setAttribute('position', new Float32BufferAttribute(decoded, 3));
      const indices = primitive.getIndices()?.getArray();
      if (indices) geometry.setIndex(Array.from(indices));
      const mesh = new Mesh(geometry, material);
      mesh.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
      mesh.updateMatrixWorld();
      return mesh;
    }));
    const sightline = (z: number) => new Raycaster(new Vector3(hall.halfWidth - 1.2, 1.6, z), new Vector3(1, 0, 0), 0, 2.2);
    try {
      expect(sightline(hall.salon.z).intersectObjects(shells)).toHaveLength(0);
      expect(sightline(hall.salon.z + hall.salon.halfWidth + 0.22).intersectObjects(shells).length).toBeGreaterThan(0);
    } finally {
      shells.forEach((mesh) => mesh.geometry.dispose());
      material.dispose();
    }
  });

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
