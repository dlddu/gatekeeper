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
    const status = params.status ?? 'PENDING';
    const isProcessed = ['APPROVED', 'REJECTED', 'EXPIRED'].includes(status);
    const request = await prisma.request.create({
      data: {
        externalId: params.externalId,
        context: params.context,
        requesterName: params.requesterName,
        status,
        timeoutSeconds: params.timeoutSeconds,
        processedAt: isProcessed ? new Date() : undefined,
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

/**
 * 모든 PENDING 요청의 상태를 일괄 변경
 * 빈 상태 UI 테스트 등에서 PENDING 요청을 임시로 비활성화할 때 사용
 * 반환값: 변경된 요청의 ID 목록 (복원 시 사용)
 */
export async function updateAllPendingRequestsStatus(
  newStatus: 'APPROVED' | 'REJECTED' | 'EXPIRED'
): Promise<string[]> {
  const prisma = await createTestPrismaClient();

  try {
    const pendingRequests = await prisma.request.findMany({
      where: { status: 'PENDING' },
      select: { id: true },
    });

    const ids = pendingRequests.map((r: { id: string }) => r.id);

    if (ids.length > 0) {
      await prisma.request.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus },
      });
    }

    return ids;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 지정된 요청들의 상태를 PENDING으로 복원
 */
export async function restoreRequestsToPending(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const prisma = await createTestPrismaClient();

  try {
    await prisma.request.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PENDING' },
    });
  } finally {
    await prisma.$disconnect();
  }
}

interface SavedProcessedRequest {
  id: string;
  status: string;
  processedAt: Date | null;
}

/**
 * 모든 처리된 요청(APPROVED/REJECTED/EXPIRED)을 임시로 PENDING으로 변경
 * 빈 상태 UI 테스트에서 처리 이력이 없는 상태를 만들 때 사용
 * 반환값: 원래 상태 복원에 필요한 데이터
 */
export async function hideAllProcessedRequests(): Promise<SavedProcessedRequest[]> {
  const prisma = await createTestPrismaClient();

  try {
    const processed = await prisma.request.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED', 'EXPIRED'] } },
      select: { id: true, status: true, processedAt: true },
    });

    if (processed.length > 0) {
      await prisma.request.updateMany({
        where: { id: { in: processed.map((r) => r.id) } },
        data: { status: 'PENDING', processedAt: null },
      });
    }

    return processed as SavedProcessedRequest[];
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * hideAllProcessedRequests()로 숨긴 요청들을 원래 상태로 복원
 */
export async function restoreProcessedRequests(saved: SavedProcessedRequest[]): Promise<void> {
  if (saved.length === 0) return;
  const prisma = await createTestPrismaClient();

  try {
    for (const req of saved) {
      await prisma.request.update({
        where: { id: req.id },
        data: {
          status: req.status as 'APPROVED' | 'REJECTED' | 'EXPIRED',
          processedAt: req.processedAt,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

export { testDBUrl, testDBPath };
