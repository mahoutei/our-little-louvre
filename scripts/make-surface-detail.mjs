import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

await MeshoptDecoder.ready;
const models = new URL('../public/models/', import.meta.url);
const destination = new URL('../public/materials/', import.meta.url);
await mkdir(destination, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const courtyard = await io.read(fileURLToPath(new URL('courtyard.glb', models)));
const gallery = await io.read(fileURLToPath(new URL('gallery.glb', models)));
const materials = [
  { document: courtyard, gltf: 'Pavers', name: 'paving', relief: 2.9, finish: 0.73 },
  { document: gallery, gltf: 'Limestone', name: 'limestone', relief: 2.55, finish: 0.81 },
  { document: gallery, gltf: 'Warm Plaster', name: 'plaster', relief: 1.7, finish: 0.87 },
  { document: gallery, gltf: 'Parquet', name: 'oak', relief: 1.9, finish: 0.43 },
];

const byte = (value) => Math.round(255 * Math.max(0, Math.min(1, value)));

for (const { document, gltf, name, relief, finish } of materials) {
  const material = document.getRoot().listMaterials().find((entry) => entry.getName() === gltf);
  const source = material?.getBaseColorTexture()?.getImage();
  if (!source) throw new Error(`No image for ${gltf}`);
  const image = await sharp(Buffer.from(source)).resize(384, 384).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = image.info;
  const surface = new Float32Array(width * height);
  const normals = Buffer.alloc(width * height * 3);
  const roughness = Buffer.alloc(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const texel = y * width + x;
      const color = texel * channels;
      const luma = (image.data[color] * 0.21 + image.data[color + 1] * 0.72 + image.data[color + 2] * 0.07) / 255;
      const pores = Math.sin(x * 2 * Math.PI * 91 / width) * Math.cos(y * 2 * Math.PI * 73 / height);
      surface[texel] = luma + pores * 0.009;
      roughness[texel] = byte(finish + (0.49 - luma) * 0.54 + pores * 0.026);
    }
  }

  const sample = (x, y) => surface[((y + height) % height) * width + (x + width) % width];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * relief;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * relief;
      const length = Math.hypot(dx, dy, 1);
      const texel = (y * width + x) * 3;
      normals[texel] = byte(0.5 + 0.5 * dx / length);
      normals[texel + 1] = byte(0.5 + 0.5 * dy / length);
      normals[texel + 2] = byte(0.5 + 0.5 / length);
    }
  }

  await sharp(normals, { raw: { width, height, channels: 3 } })
    .webp({ lossless: true }).toFile(fileURLToPath(new URL(`${name}-normal.webp`, destination)));
  await sharp(roughness, { raw: { width, height, channels: 1 } })
    .resize(192, 192).webp({ quality: 82 }).toFile(fileURLToPath(new URL(`${name}-roughness.webp`, destination)));
}
