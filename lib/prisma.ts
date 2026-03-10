import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  const adapter = new PrismaLibSql({ url });

  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  // SQLite busy_timeout: 다른 연결이 쓰기 잠금을 보유할 때 최대 5초 대기
  // $executeRawUnsafe는 비동기이지만, 첫 쿼리 전에 실행되도록 즉시 호출합니다.
  // Prisma는 내부적으로 큐잉하므로 후속 쿼리에도 PRAGMA가 적용됩니다.
  client.$executeRawUnsafe('PRAGMA busy_timeout = 5000').catch(() => {
    // PRAGMA 실행 실패 시 무시 (non-SQLite 환경 등)
  });

  return client;
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
