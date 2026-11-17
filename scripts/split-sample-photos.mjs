import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = process.argv[2];
if (!source) throw new Error('Pass the path to the sample 5-by-2 photography contact sheet.');
const directory = new URL('../public/content/photos/', import.meta.url);
await mkdir(directory, { recursive: true });
const { width, height } = await sharp(source).metadata();
for (let row = 0; row < 2; row++) {
  for (let column = 0; column < 5; column++) {
    const x = Math.round(width * column / 5);
    const y = Math.round(height * row / 2);
    const name = String(row * 5 + column + 1).padStart(2, '0');
    const photo = sharp(source).extract({
      left: x + 2, top: y + 2,
      width: Math.round(width * (column + 1) / 5) - x - 4,
      height: Math.round(height * (row + 1) / 2) - y - 4,
    });
    await photo.clone().resize({ width: 256, withoutEnlargement: true }).webp({ quality: 81 }).toFile(fileURLToPath(new URL(`${name}-small.webp`, directory)));
    await photo.webp({ quality: 93 }).toFile(fileURLToPath(new URL(`${name}.webp`, directory)));
  }
}
