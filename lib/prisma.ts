import { createClient, type Client, type Config } from '@libsql/client';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

class PrismaLibSqlWithBusyTimeout extends PrismaLibSql {
  createClient(config: Config): Client {
    const client = createClient(config);
    client.execute('PRAGMA busy_timeout = 5000').catch(console.error);
    return client;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  const adapter = new PrismaLibSqlWithBusyTimeout({ url });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
