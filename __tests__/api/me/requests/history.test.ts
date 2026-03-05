/**
 * GET /api/me/requests/history 라우트 핸들러 테스트
 *
 * app/api/me/requests/history/route.ts의 GET 핸들러 동작을 검증합니다.
 * JWT 인증이 필요한 엔드포인트입니다.
 * APPROVED, REJECTED, EXPIRED 상태의 처리 완료된 요청 목록을 반환합니다.
 * 커서 기반 페이지네이션을 지원합니다 (cursor, limit 쿼리 파라미터).
 * 정렬은 processedAt DESC (최근 처리 순)으로 합니다.
 * 실제 DB 연결 없이 prisma와 verifyToken을 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      findMany: jest.fn(),
    },
  },
}));

// lib/auth mock — verifyToken mock
jest.mock('@/lib/auth', () => ({
  signToken: jest.fn(),
  verifyToken: jest.fn(),
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/me/requests/history/route';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// 타입 캐스팅 헬퍼
const mockRequestFindMany = prisma.request.findMany as jest.Mock;
const mockVerifyToken = verifyToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * 쿼리 파라미터와 Authorization 헤더를 포함한 GET NextRequest를 생성합니다.
 */
function makeRequest(
  params?: Record<string, string>,
  authHeader?: string
): NextRequest {
  const url = new URL('http://localhost/api/me/requests/history');
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (authHeader !== undefined) {
    headers.set('Authorization', authHeader);
  }
  return new NextRequest(url, { headers });
}

/**
 * 처리 완료된 기본 mock Request 레코드를 생성합니다.
 */
function makeMockRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'req-uuid-0001',
    externalId: 'ext-001',
    context: '배포 승인 요청입니다.',
    requesterName: 'CI Bot',
    status: 'APPROVED',
    timeoutSeconds: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T01:00:00.000Z'),
    processedAt: new Date('2024-01-01T01:00:00.000Z'),
    processedById: 'user-admin',
    ...overrides,
  };
}

// 검증된 JWT 페이로드
const verifiedPayload = { userId: 'user-admin', username: 'admin', iat: 1000, exp: 9999999999 };

// --- 테스트 스위트 ---

describe('GET /api/me/requests/history', () => {
  const fakeToken = 'valid.jwt.token';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long!!';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ----------------------------------------------------------------
  // JWT 인증 없음 → 401
  // ----------------------------------------------------------------
  describe('JWT 인증 없음 (401 Unauthorized)', () => {
    it('Authorization 헤더가 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest();

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('Bearer 형식이 아닌 Authorization 헤더이면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(undefined, 'Basic dXNlcjpwYXNz');

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('유효하지 않은 JWT 토큰이면 401을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWTExpired'));
      const request = makeRequest(undefined, 'Bearer expired.jwt.token');

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('JWT 인증 실패 시 findMany를 호출하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest();

      // Act
      await GET(request);

      // Assert
      expect(mockRequestFindMany).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 정상 목록 조회 (happy path) → 200
  // ----------------------------------------------------------------
  describe('정상 목록 조회 (200 OK)', () => {
    it('유효한 JWT로 요청하면 200을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('응답 body에 items 배열이 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
    });

    it('응답 body에 hasMore 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('hasMore');
      expect(typeof body.hasMore).toBe('boolean');
    });

    it('응답 body에 nextCursor 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('nextCursor');
    });

    it('verifyToken을 Authorization 헤더의 토큰으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockVerifyToken).toHaveBeenCalledWith(fakeToken);
    });
  });

  // ----------------------------------------------------------------
  // 상태 필터링 — APPROVED/REJECTED/EXPIRED만 포함
  // ----------------------------------------------------------------
  describe('처리 완료 상태 필터링', () => {
    it('findMany를 status IN [APPROVED, REJECTED, EXPIRED] 조건으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.objectContaining({
              in: expect.arrayContaining(['APPROVED', 'REJECTED', 'EXPIRED']),
            }),
          }),
        })
      );
    });

    it('findMany 호출 시 PENDING은 status 조건에 포함되지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      const callArg = mockRequestFindMany.mock.calls[0][0] as Record<string, unknown>;
      const where = callArg?.where as Record<string, unknown>;
      const statusFilter = where?.status as Record<string, unknown>;
      const statusIn = statusFilter?.in as string[];
      expect(statusIn).not.toContain('PENDING');
    });

    it('APPROVED 상태 요청이 응답 items에 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-approved', status: 'APPROVED' }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      const item = body.items.find((r: { id: string }) => r.id === 'req-approved');
      expect(item).toBeDefined();
      expect(item.status).toBe('APPROVED');
    });

    it('REJECTED 상태 요청이 응답 items에 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-rejected', status: 'REJECTED' }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      const item = body.items.find((r: { id: string }) => r.id === 'req-rejected');
      expect(item).toBeDefined();
      expect(item.status).toBe('REJECTED');
    });

    it('EXPIRED 상태 요청이 응답 items에 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-expired', status: 'EXPIRED' }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      const item = body.items.find((r: { id: string }) => r.id === 'req-expired');
      expect(item).toBeDefined();
      expect(item.status).toBe('EXPIRED');
    });
  });

  // ----------------------------------------------------------------
  // 빈 결과 처리
  // ----------------------------------------------------------------
  describe('빈 결과 처리', () => {
    it('처리된 요청이 없으면 빈 배열을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items).toEqual([]);
    });

    it('처리된 요청이 없으면 hasMore는 false이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.hasMore).toBe(false);
    });

    it('처리된 요청이 없으면 nextCursor는 null이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.nextCursor).toBeNull();
    });

    it('빈 결과 시 { items: [], hasMore: false, nextCursor: null } 구조이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toEqual({ items: [], hasMore: false, nextCursor: null });
    });
  });

  // ----------------------------------------------------------------
  // 정렬 검증
  // ----------------------------------------------------------------
  describe('정렬 (processedAt DESC)', () => {
    it('findMany를 processedAt 기준 내림차순으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({ processedAt: 'desc' }),
        })
      );
    });
  });

  // ----------------------------------------------------------------
  // 커서 기반 페이지네이션
  // ----------------------------------------------------------------
  describe('커서 기반 페이지네이션', () => {
    it('limit 파라미터를 지정하면 해당 수만큼만 조회해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest({ limit: '5' }, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: expect.any(Number),
        })
      );
    });

    it('limit=5이면 findMany take가 5보다 크거나 같아야 한다 (hasMore 판별용 +1 허용)', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest({ limit: '5' }, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      const callArg = mockRequestFindMany.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.take).toBeGreaterThanOrEqual(5);
    });

    it('cursor 파라미터를 지정하면 커서 이후 항목을 조회해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const cursorId = 'req-cursor-id-001';
      const request = makeRequest({ cursor: cursorId }, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      const callArg = mockRequestFindMany.mock.calls[0][0] as Record<string, unknown>;
      // cursor 혹은 skip 중 하나로 페이지네이션 처리
      const hasCursor = JSON.stringify(callArg).includes(cursorId);
      expect(hasCursor).toBe(true);
    });

    it('결과가 limit보다 많으면 hasMore가 true이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      // limit=2일 때 3개 반환 → hasMore=true
      const mockList = [
        makeMockRequest({ id: 'req-0001' }),
        makeMockRequest({ id: 'req-0002' }),
        makeMockRequest({ id: 'req-0003' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest({ limit: '2' }, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.hasMore).toBe(true);
    });

    it('결과가 limit보다 많으면 nextCursor가 null이 아니어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const mockList = [
        makeMockRequest({ id: 'req-0001' }),
        makeMockRequest({ id: 'req-0002' }),
        makeMockRequest({ id: 'req-0003' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest({ limit: '2' }, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.nextCursor).not.toBeNull();
    });

    it('결과가 limit 이하이면 hasMore가 false이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const mockList = [
        makeMockRequest({ id: 'req-0001' }),
        makeMockRequest({ id: 'req-0002' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest({ limit: '5' }, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.hasMore).toBe(false);
    });

    it('결과가 limit 이하이면 nextCursor가 null이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const mockList = [
        makeMockRequest({ id: 'req-0001' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest({ limit: '5' }, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.nextCursor).toBeNull();
    });

    it('응답 items 수는 limit을 초과하지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      // limit=2인데 3개 반환 → items는 2개여야 함
      const mockList = [
        makeMockRequest({ id: 'req-0001' }),
        makeMockRequest({ id: 'req-0002' }),
        makeMockRequest({ id: 'req-0003' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest({ limit: '2' }, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items.length).toBeLessThanOrEqual(2);
    });

    it('limit 파라미터 없이 요청하면 기본 limit으로 처리해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert — take가 설정되어 있어야 함 (기본값 적용)
      const callArg = mockRequestFindMany.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.take).toBeDefined();
      expect(typeof callArg.take).toBe('number');
    });
  });

  // ----------------------------------------------------------------
  // 응답 필드 구조 검증
  // ----------------------------------------------------------------
  describe('응답 필드 구조', () => {
    it('각 요청 항목에 id 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-uuid-9999' }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items[0]).toHaveProperty('id', 'req-uuid-9999');
    });

    it('각 요청 항목에 externalId 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ externalId: 'ext-777' }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items[0]).toHaveProperty('externalId', 'ext-777');
    });

    it('각 요청 항목에 status 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ status: 'APPROVED' }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items[0]).toHaveProperty('status', 'APPROVED');
    });

    it('각 요청 항목에 processedAt 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ processedAt: new Date('2024-06-01T12:00:00.000Z') }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items[0]).toHaveProperty('processedAt');
    });

    it('각 요청 항목에 context 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ context: '프로덕션 배포 승인 요청' }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items[0]).toHaveProperty('context', '프로덕션 배포 승인 요청');
    });

    it('각 요청 항목에 requesterName 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ requesterName: 'Deploy Bot' }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items[0]).toHaveProperty('requesterName', 'Deploy Bot');
    });

    it('각 요청 항목에 createdAt 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ createdAt: new Date('2024-03-01T10:00:00.000Z') }),
      ]);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items[0]).toHaveProperty('createdAt');
    });
  });

  // ----------------------------------------------------------------
  // 여러 상태 혼재 시나리오
  // ----------------------------------------------------------------
  describe('복합 시나리오', () => {
    it('APPROVED, REJECTED, EXPIRED 항목이 혼재할 때 모두 반환되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const mockList = [
        makeMockRequest({ id: 'req-approved', status: 'APPROVED' }),
        makeMockRequest({ id: 'req-rejected', status: 'REJECTED' }),
        makeMockRequest({ id: 'req-expired', status: 'EXPIRED' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest(undefined, `Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.items).toHaveLength(3);
    });

    it('cursor와 limit을 함께 지정하면 두 파라미터가 모두 findMany에 반영되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const cursorId = 'req-cursor-abc';
      const request = makeRequest({ cursor: cursorId, limit: '10' }, `Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      const callArg = mockRequestFindMany.mock.calls[0][0] as Record<string, unknown>;
      const serialized = JSON.stringify(callArg);
      expect(serialized).toContain(cursorId);
      expect(callArg.take).toBeGreaterThanOrEqual(10);
    });
  });
});
