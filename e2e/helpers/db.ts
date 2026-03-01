import path from 'path';

/**
 * E2E 테스트용 DB 헬퍼
 *
 * DLD-647: e2e 테스트 환경 구성
 *
 * 개별 테스트 내에서 DB를 직접 조작해야 할 때 사용합니다.
 * global-setup에서 이미 기본 시드 데이터가 삽입되므로,
 * 이 헬퍼는 테스트별 추가 데이터 삽입/정리에 활용합니다.
 */

const testDBPath = path.resolve(__dirname, '..', '..', 'e2e-test.db');
const testDBUrl = `file:${testDBPath}`;

export interface TestUser {
  id: string;
  username: string;
  displayName: string;
}

export interface TestRequest {
  id: string;
  externalId: string;
  context: string;
  requesterName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  timeoutSeconds?: number | null;
}

/**
 * 테스트용 Prisma 클라이언트 생성
 * 사용 후 반드시 disconnect() 호출 필요
 */
export async function createTestPrismaClient() {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaLibSql } = await import('@prisma/adapter-libsql');

  const adapter = new PrismaLibSql({ url: testDBUrl });
  return new PrismaClient({ adapter });
}

/**
 * 테스트용 사용자 생성
 */
export async function createTestUser(params: {
  username: string;
  password: string;
  displayName: string;
}): Promise<TestUser> {
  const prisma = await createTestPrismaClient();
  const bcrypt = await import('bcryptjs');

  try {
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = await prisma.user.create({
      data: {
        username: params.username,
        passwordHash,
        displayName: params.displayName,
      },
      select: { id: true, username: true, displayName: true },
    });
    return user;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 테스트용 Request 생성
 */
export async function createTestRequest(params: {
  externalId: string;
  context: string;
  requesterName: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  timeoutSeconds?: number;
}): Promise<TestRequest> {
  const prisma = await createTestPrismaClient();

  try {
    const request = await prisma.request.create({
      data: {
        externalId: params.externalId,
        context: params.context,
        requesterName: params.requesterName,
        status: params.status ?? 'PENDING',
        timeoutSeconds: params.timeoutSeconds,
      },
    });
    return {
      ...request,
      status: request.status as TestRequest['status'],
      timeoutSeconds: request.timeoutSeconds ?? null,
    };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 특정 externalId로 Request 조회
 */
export async function findRequestByExternalId(externalId: string): Promise<TestRequest | null> {
  const prisma = await createTestPrismaClient();

  try {
    const request = await prisma.request.findUnique({ where: { externalId } });
    if (!request) return null;
    return {
      ...request,
      status: request.status as TestRequest['status'],
      timeoutSeconds: request.timeoutSeconds ?? null,
    };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 테스트 데이터 정리 (개별 테스트 후 cleanup)
 */
export async function cleanupTestData(externalIds: string[]): Promise<void> {
  const prisma = await createTestPrismaClient();

  try {
    await prisma.request.deleteMany({
      where: { externalId: { in: externalIds } },
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 테스트용 사용자 삭제
 */
export async function deleteTestUser(username: string): Promise<void> {
  const prisma = await createTestPrismaClient();

  try {
    await prisma.user.deleteMany({ where: { username } });
  } finally {
    await prisma.$disconnect();
  }
}

export { testDBUrl, testDBPath };
