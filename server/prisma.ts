import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { museumPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.museumPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.museumPrisma = prisma;
