import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local', override: false, quiet: true });

const prisma = new PrismaClient();
const root = resolve(import.meta.dirname, '..');

async function readLetter() {
  try {
    return JSON.parse(await readFile(resolve(root, 'prisma/letter.json'), 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return {
      title: 'A Letter for You',
      paragraphs: [
        'Dear you,',
        'This is the sample letter. In the private studio, you can write the words that belong here.',
        'With love',
      ],
    };
  }
}

async function main() {
  const showcase = JSON.parse(await readFile(resolve(root, 'public/content/exhibits.json'), 'utf8'));
  const letter = await readLetter();

  for (const [index, item] of showcase.exhibits.entries()) {
    const structural = {
      origin: 'ORIGINAL',
      anchor: item.anchor,
      sortOrder: index,
    };
    await prisma.exhibit.upsert({
      where: { slug: item.id },
      update: structural,
      create: {
        ...structural,
        imagePath: item.imageUrl,
        thumbPath: item.thumbnailUrl,
        published: true,
        slug: item.id,
        title: item.title,
        caption: item.caption,
        alt: item.alt,
        ...(item.dateLabel ? { dateLabel: item.dateLabel } : {}),
      },
    });
  }

  const existingLetter = await prisma.letter.findFirst({ where: { active: true } });
  if (!existingLetter) {
    await prisma.letter.create({
      data: {
        title: letter.title,
        paragraphs: letter.paragraphs,
        active: true,
      },
    });
  }

  const [originals, wing, letters] = await Promise.all([
    prisma.exhibit.count({ where: { origin: 'ORIGINAL' } }),
    prisma.exhibit.count({ where: { origin: 'WING' } }),
    prisma.letter.count({ where: { active: true } }),
  ]);
  console.log(`Seeded ${originals} original exhibits, ${wing} wing photographs, and ${letters} active letter.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
