import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const output = new URL('../.museum-tools/textures/', import.meta.url);
await mkdir(output, { recursive: true });
const edge = 512;
const fract = (n) => n - Math.floor(n);
const noise = (x, y) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
const cloud = (x, y) => 5 * Math.sin(x * 6.283 + Math.cos(y * 12.566)) + 2.3 * Math.cos(y * 31.416 + x * 12.566);
const tint = (color, tone) => color.map((channel) => channel + tone);

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
  texture('garnet', (x, y, grain) => tint([135, 59, 63], cloud(x, y) * 0.65 + grain * 5)),
  texture('gallery-stone', (x, y, grain) => tint([181, 165, 144], cloud(x, y) + grain * 5)),
  texture('pavers', (x, y, grain) => {
    const u = x * 5 + (Math.floor(y * 8) % 2) * 0.5;
    const v = y * 8;
    const joint = Math.min(fract(u), 1 - fract(u), fract(v), 1 - fract(v));
    const tone = cloud(x, y) * 1.2 + grain * 16 + (noise(Math.floor(u) % 5, Math.floor(v)) - 0.5) * 15 - Math.max(0, 0.032 - joint) * 580;
    const warmth = (noise(Math.floor(v) + 4, Math.floor(u) % 5 + 7) - 0.5) * 9;
    return [123 + tone + warmth, 117 + tone, 109 + tone - warmth * 0.8];
  }),
  texture('walnut', (x, y, grain) => {
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
    return [119 + tone, 82 + tone * 0.82, 57 + tone * 0.65];
  }),
  texture('floor-inlay', (x, y, grain) => {
    const u = Math.abs(x - 0.5);
    const v = Math.abs(y - 0.5);
    const lozenge = u * 3 + v * 2.55;
    const stone = u > 0.47 ? [107, 72, 62] : u > 0.395 ? [206, 186, 152]
      : u > 0.365 ? [83, 56, 52] : lozenge < 0.83 ? [76, 51, 50]
        : lozenge < 0.93 ? [158, 130, 96] : [188, 171, 142];
    const vein = Math.max(0, Math.sin((x * 1.6 + y) * 25 + Math.sin(y * 18) * 0.9) - 0.91) * 110;
    return tint(stone, cloud(x, y) * 0.75 + grain * 4 - vein);
  }),
  texture('intarsia', (x, y, grain) => {
    const u = Math.abs(x - 0.5);
    const v = Math.abs(y - 0.5);
    const lozenge = u * 2.35 + v * 2;
    const wood = u > 0.46 ? [70, 47, 37] : u > 0.43 ? [143, 108, 66]
      : lozenge < 0.4 ? [124, 87, 55] : lozenge < 0.51 ? [164, 125, 77]
        : lozenge < 0.92 ? [90, 58, 40] : [105, 71, 47];
    const bands = 4 * Math.sin(x * 72 + Math.sin(y * 18) * 3) + 2 * Math.cos(x * 174 + y * 9);
    return tint(wood, bands + grain * 4);
  }),
]);
