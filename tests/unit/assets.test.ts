import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseManifest } from '../../src/exhibits/manifest';
import { hall } from '../../src/museum/layout';

it('keeps the first courtyard model small without dropping surfaces or triangles', async () => {
  const file = await readFile('public/models/courtyard.glb');
  expect(file.byteLength).toBeLessThanOrEqual(512 * 1024);

  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const model = await io.readBinary(file);
  const primitives = model.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
  const triangles = primitives.reduce((count, primitive) => (
    count + (primitive.getIndices() ?? primitive.getAttribute('POSITION')!).getCount() / 3
  ), 0);
  expect(triangles).toBe(37116);
  for (const surface of ['Pavers', 'Limestone']) {
    const primitive = primitives.find((item) => item.getMaterial()?.getName() === surface);
    expect(primitive?.getAttribute('TEXCOORD_0'), surface).toBeTruthy();
    expect(primitive?.getMaterial()?.getBaseColorTexture(), surface).toBeTruthy();
  }
});

describe('exported gallery', () => {
  const material = new MeshBasicMaterial({ side: DoubleSide });
  let shells: Mesh[] = [];

  beforeAll(async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const model = await io.read('public/models/gallery.glb');
    shells = model.getRoot().listNodes().flatMap((node) => (node.getMesh()?.listPrimitives() ?? []).map((primitive) => {
      const geometry = new BufferGeometry();
      const positions = primitive.getAttribute('POSITION')!;
      const decoded = new Float32Array(positions.getCount() * 3);
      const vertex: number[] = [];
      for (let index = 0; index < positions.getCount(); index++) decoded.set(positions.getElement(index, vertex), index * 3);
      geometry.setAttribute('position', new Float32BufferAttribute(decoded, 3));
      const indices = primitive.getIndices()?.getArray();
      if (indices) geometry.setIndex(Array.from(indices));
      const mesh = new Mesh(geometry, material);
      mesh.name = primitive.getMaterial()?.getName() ?? '';
      mesh.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
      mesh.updateMatrixWorld();
      return mesh;
    }));
  });

  afterAll(() => {
    shells.forEach((mesh) => mesh.geometry.dispose());
    material.dispose();
  });

  it('has a real open arch from the main hall into the New Wing', () => {
    const sightline = (z: number, y = 1.6) => new Raycaster(new Vector3(hall.halfWidth - 1.2, y, z), new Vector3(1, 0, 0), 0, 2.2);
    for (const offset of [-1, 0, 1]) {
      expect(sightline(hall.salon.z + offset * (hall.salon.halfWidth - 0.08)).intersectObjects(shells)).toHaveLength(0);
    }
    expect(sightline(hall.salon.z, hall.salon.springHeight + hall.salon.rise - 0.2).intersectObjects(shells)).toHaveLength(0);
    expect(sightline(hall.salon.z + hall.salon.halfWidth + 0.22).intersectObjects(shells).length).toBeGreaterThan(0);
  });

  it('joins the skylight glazing and coffers without gaps between the bays', () => {
    const roof = shells.filter(({ name }) => ['Skylight', 'Vault', 'Coffer', 'Trim'].includes(name));
    for (const side of [-1, 1]) {
      for (const z of [1, -7, -15]) {
        // This slope passes through the glazing edge on the elliptical vault.
        const ray = new Raycaster(new Vector3(0, hall.springHeight, z), new Vector3(side, 2.14, 0).normalize());
        expect(ray.intersectObjects(roof).length).toBeGreaterThan(0);
      }
    }
  });

  it('preserves the second UV set for the baked architecture light map', async () => {
    const file = await readFile('public/models/gallery.glb');
    const chunkBytes = file.readUInt32LE(12);
    const content = JSON.parse(file.subarray(20, 20 + chunkBytes).toString('utf8')) as {
      meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[];
    };
    for (const surface of ['Parquet', 'Warm Plaster', 'Limestone', 'Trim', 'Deep Stone', 'Vault',
      'Coffer', 'Gilding', 'Floor Inlay', 'Porphyry', 'Intarsia', 'Alcove Stone', 'Fluting']) {
      const mesh = content.meshes.find(({ name }) => name === surface);
      expect(mesh?.primitives.length ?? 0, surface).toBeGreaterThan(0);
      for (const primitive of mesh!.primitives) expect(primitive.attributes.TEXCOORD_1, surface).toBeTypeOf('number');
    }
    const atlas = await readFile('public/materials/gallery-light.webp');
    expect(atlas.toString('ascii', 8, 12)).toBe('WEBP');
  });

  it('ships the gallery shell and its light map within 1 MiB', async () => {
    const assets = await Promise.all(['public/models/gallery.glb', 'public/materials/gallery-light.webp'].map((file) => readFile(file)));
    expect(assets.reduce((bytes, asset) => bytes + asset.byteLength, 0)).toBeLessThanOrEqual(1024 * 1024);
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
