import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const output = new URL('../public/models/', import.meta.url);
const raw = new URL('../.museum-tools/raw/', import.meta.url);
const lighting = new URL('../public/materials/', import.meta.url);
const models = process.argv.length > 2 ? process.argv.slice(2) : ['courtyard', 'gallery'];
if (models.some((model) => model !== 'courtyard' && model !== 'gallery')) throw new Error('Choose courtyard or gallery.');
await mkdir(output, { recursive: true });
for (const model of models) {
  const source = fileURLToPath(new URL(`${model}.glb`, raw));
  const document = await io.read(source);
  const anchors = () => document.getRoot().listNodes().map((node) => node.getName()).filter((name) => name.startsWith('EXHIBIT_')).sort().join(',');
  const lightmapMeshes = () => document.getRoot().listMeshes().filter((mesh) => (
    mesh.listPrimitives().every((primitive) => primitive.getAttribute('TEXCOORD_1'))
  )).map((mesh) => mesh.getName()).sort().join(',');
  const before = anchors();
  const mapped = lightmapMeshes();
  await document.transform(dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 86 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  if (anchors() !== before) throw new Error(`Optimization changed the ${model} exhibit anchors.`);
  if (lightmapMeshes() !== mapped) throw new Error(`Optimization changed the ${model} light map UVs.`);
  await io.write(fileURLToPath(new URL(`${model}.glb`, output)), document);
}

await mkdir(lighting, { recursive: true });
if (models.includes('gallery')) {
  await sharp(fileURLToPath(new URL('gallery-light.png', raw))).blur(0.8).webp({ quality: 87 })
    .toFile(fileURLToPath(new URL('gallery-light.webp', lighting)));
}

// Blender renders the actual palace and paving. Fill the transparent sky with blue-hour light.
if (!models.includes('courtyard')) process.exit(0);
const probe = fileURLToPath(new URL('courtyard-probe.png', raw));
const { width, height } = await sharp(probe).metadata();
const sky = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) {
  const latitude = Math.PI * (0.5 - (y + 0.5) / height);
  const zenith = Math.sqrt(Math.max(0, Math.sin(latitude)));
  for (let x = 0; x < width; x++) {
    const longitude = 2 * Math.PI * ((x + 0.5) / width - 0.5);
    const twilight = Math.max(0, Math.cos(longitude + 2.48)) ** 7 * (1 - zenith);
    const index = (y * width + x) * 3;
    sky[index] = 115 - zenith * 67 + twilight * 56;
    sky[index + 1] = 124 - zenith * 61 + twilight * 30;
    sky[index + 2] = 155 - zenith * 64 + twilight * 14;
  }
}
await sharp(sky, { raw: { width, height, channels: 3 } }).composite([{ input: probe }])
  .webp({ quality: 92 }).toFile(fileURLToPath(new URL('courtyard-reflection.webp', lighting)));
