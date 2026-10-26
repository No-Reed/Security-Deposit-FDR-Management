import { PrismaClient } from '@prisma/client';
import { config } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  });

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
