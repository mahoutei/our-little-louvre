import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const output = new URL('../.museum-tools/textures/', import.meta.url);
await mkdir(output, { recursive: true });
const edge = 512;
const fract = (n) => n - Math.floor(n);
const noise = (x, y) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
const cloud = (x, y) => 5 * Math.sin(x * 6.283 + Math.cos(y * 12.566)) + 2.3 * Math.cos(y * 31.416 + x * 12.566);

async function texture(name, sample) {
  const data = Buffer.alloc(edge * edge * 3);
  for (let y = 0; y < edge; y++) {
    for (let x = 0; x < edge; x++) {
      const color = sample(x / edge, y / edge, noise(x, y) - 0.5);
      const index = (y * edge + x) * 3;
      color.forEach((value, i) => { data[index + i] = Math.min(255, Math.max(0, Math.round(value))); });
    }
  }
  await sharp(data, { raw: { width: edge, height: edge, channels: 3 } }).png().toFile(fileURLToPath(new URL(`${name}.png`, output)));
}

await Promise.all([
  texture('limestone', (x, y, grain) => {
    const u = x * 3 + (Math.floor(y * 6) % 2) * 0.5;
    const v = y * 6;
    const joint = Math.min(fract(u), 1 - fract(u), fract(v), 1 - fract(v));
    const vein = 2.5 * Math.sin((x + y) * 62.83 + Math.sin(x * 18.85));
    const block = noise(Math.floor(u) % 3, Math.floor(v)) - 0.5;
    const tone = cloud(x, y) * 1.05 + vein + grain * 9 + block * 10 - Math.max(0, 0.014 - joint) * 490;
    return [183 + tone + block * 8, 170 + tone, 151 + tone - block * 6];
  }),
  texture('plaster', (x, y, grain) => {
    const tone = cloud(x, y) * 0.7 + grain * 6;
    return [188 + tone, 164 + tone, 143 + tone];
  }),
  texture('pavers', (x, y, grain) => {
    const u = x * 5 + (Math.floor(y * 8) % 2) * 0.5;
    const v = y * 8;
    const joint = Math.min(fract(u), 1 - fract(u), fract(v), 1 - fract(v));
    const tone = cloud(x, y) * 1.2 + grain * 16 + (noise(Math.floor(u) % 5, Math.floor(v)) - 0.5) * 15 - Math.max(0, 0.032 - joint) * 580;
    const warmth = (noise(Math.floor(v) + 4, Math.floor(u) % 5 + 7) - 0.5) * 9;
    return [123 + tone + warmth, 117 + tone, 109 + tone - warmth * 0.8];
  }),
  texture('parquet', (x, y, grain) => {
    const u = x * 8;
    const v = y * 8;
    const row = Math.floor(v);
    const column = Math.floor(u);
    const horizontal = ((row + column) % 2) === 0;
    const across = horizontal ? fract(v) : fract(u);
    const along = horizontal ? fract(u) : fract(v);
    const strip = Math.floor(across * 6);
    const variation = (noise(row * 7 + strip, column + 2) - 0.5) * 30;
    const seam = Math.min(fract(across * 6), 1 - fract(across * 6), along, 1 - along);
    const bands = 4 * Math.sin(across * 210 + Math.sin(along * 10) * 2) + 3 * Math.cos(across * 508 + along * 9);
    const tone = variation + bands + 4 * grain - Math.max(0, 0.047 - seam) * 445;
    return [134 + tone, 104 + tone * 0.82, 80 + tone * 0.65];
  }),
]);
