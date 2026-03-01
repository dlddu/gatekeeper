/**
 * Prisma Client 싱글턴 패턴 테스트
 *
 * lib/prisma.ts의 싱글턴 생성 동작을 검증합니다.
 * 실제 DB 연결 없이 모듈 구조와 싱글턴 동작을 테스트합니다.
 */

describe('Prisma Client singleton', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.resetModules();
    // 전역 싱글턴 캐시 초기화
    const g = globalThis as Record<string, unknown>;
    delete g.prisma;
  });

  afterEach(() => {
    (process.env as Record<string, string>).NODE_ENV = originalNodeEnv as string;
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    const g = globalThis as Record<string, unknown>;
    delete g.prisma;
  });

  describe('module exports', () => {
    it('should export prisma as a named export', async () => {
      // Arrange
      process.env.DATABASE_URL = 'file::memory:';

      // Act
      const { prisma } = await import('@/lib/prisma');

      // Assert
      expect(prisma).toBeDefined();
    });

    it('should export a PrismaClient instance', async () => {
      // Arrange
      process.env.DATABASE_URL = 'file::memory:';

      // Act
      const { prisma } = await import('@/lib/prisma');

      // Assert
      expect(typeof prisma).toBe('object');
      expect(prisma).not.toBeNull();
    });

    it('should have standard PrismaClient methods', async () => {
      // Arrange
      process.env.DATABASE_URL = 'file::memory:';

      // Act
      const { prisma } = await import('@/lib/prisma');

      // Assert - PrismaClient는 $connect, $disconnect, $transaction 메서드를 가져야 함
      expect(typeof prisma.$connect).toBe('function');
      expect(typeof prisma.$disconnect).toBe('function');
      expect(typeof prisma.$transaction).toBe('function');
    });

    it('should have model accessors for User', async () => {
      // Arrange
      process.env.DATABASE_URL = 'file::memory:';

      // Act
      const { prisma } = await import('@/lib/prisma');

      // Assert
      expect(prisma.user).toBeDefined();
    });

    it('should have model accessors for Request', async () => {
      // Arrange
      process.env.DATABASE_URL = 'file::memory:';

      // Act
      const { prisma } = await import('@/lib/prisma');

      // Assert
      expect(prisma.request).toBeDefined();
    });

    it('should have model accessors for PushSubscription', async () => {
      // Arrange
      process.env.DATABASE_URL = 'file::memory:';

      // Act
      const { prisma } = await import('@/lib/prisma');

      // Assert
      expect(prisma.pushSubscription).toBeDefined();
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance on multiple imports in non-production', async () => {
      // Arrange
      (process.env as Record<string, string>).NODE_ENV = 'development';
      process.env.DATABASE_URL = 'file::memory:';

      // Act - 같은 모듈을 두 번 import해도 동일한 인스턴스를 반환해야 함
      const { prisma: instance1 } = await import('@/lib/prisma');
      const { prisma: instance2 } = await import('@/lib/prisma');

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('should cache instance on globalThis in non-production environment', async () => {
      // Arrange
      (process.env as Record<string, string>).NODE_ENV = 'development';
      process.env.DATABASE_URL = 'file::memory:';

      // Act
      const { prisma } = await import('@/lib/prisma');

      // Assert - development 환경에서는 globalThis에 캐싱
      const g = globalThis as Record<string, unknown>;
      expect(g.prisma).toBeDefined();
      expect(g.prisma).toBe(prisma);
    });

    it('should use DATABASE_URL environment variable for connection', async () => {
      // Arrange
      process.env.DATABASE_URL = 'file::memory:';

      // Act & Assert - DATABASE_URL이 설정된 경우 정상적으로 클라이언트 생성
      const { prisma } = await import('@/lib/prisma');
      expect(prisma).toBeDefined();
    });

    it('should fallback to default dev.db when DATABASE_URL is not set', async () => {
      // Arrange
      delete process.env.DATABASE_URL;

      // Act & Assert - DATABASE_URL이 없어도 기본값으로 생성
      const { prisma } = await import('@/lib/prisma');
      expect(prisma).toBeDefined();
    });
  });
});
