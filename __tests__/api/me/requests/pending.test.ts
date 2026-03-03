/**
 * GET /api/me/requests/pending 라우트 핸들러 테스트
 *
 * app/api/me/requests/pending/route.ts의 GET 핸들러 동작을 검증합니다.
 * JWT 인증이 필요한 엔드포인트입니다.
 * 현재 사용자의 PENDING 상태 요청 목록을 반환합니다.
 * timeoutSeconds가 있는 요청은 expiresAt을 계산하고,
 * 이미 만료된 요청은 EXPIRED로 업데이트한 후 목록에서 제외합니다.
 * 실제 DB 연결 없이 prisma와 verifyToken을 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      findMany: jest.fn(),
      update: jest.fn(),
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
import { GET } from '@/app/api/me/requests/pending/route';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// 타입 캐스팅 헬퍼
const mockRequestFindMany = prisma.request.findMany as jest.Mock;
const mockRequestUpdate = prisma.request.update as jest.Mock;
const mockVerifyToken = verifyToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * Authorization 헤더를 포함한 GET NextRequest를 생성합니다.
 */
function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new NextRequest('http://localhost/api/me/requests/pending', {
    method: 'GET',
    headers,
  });
}

/**
 * 기본 mock Request 레코드를 생성합니다.
 */
function makeMockRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'req-uuid-0001',
    externalId: 'ext-001',
    context: '배포 승인 요청입니다.',
    requesterName: 'CI Bot',
    callbackUrl: 'https://example.com/callback',
    status: 'PENDING',
    timeoutSeconds: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    respondedAt: null,
    respondedBy: null,
    ...overrides,
  };
}

// 검증된 JWT 페이로드
const verifiedPayload = { userId: 'user-admin', username: 'admin', iat: 1000, exp: 9999999999 };

// --- 테스트 스위트 ---

describe('GET /api/me/requests/pending', () => {
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
      const request = makeRequest('Basic dXNlcjpwYXNz');

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('유효하지 않은 JWT 토큰이면 401을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWTExpired'));
      const request = makeRequest('Bearer expired.jwt.token');

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
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('응답 body에 requests 배열이 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('requests');
      expect(Array.isArray(body.requests)).toBe(true);
    });

    it('응답 body에 count 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('count');
      expect(typeof body.count).toBe('number');
    });

    it('PENDING 요청이 없으면 빈 배열과 count 0을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.requests).toEqual([]);
      expect(body.count).toBe(0);
    });

    it('PENDING 요청이 있으면 목록을 반환하고 count가 일치해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const mockList = [
        makeMockRequest({ id: 'req-0001', externalId: 'ext-001' }),
        makeMockRequest({ id: 'req-0002', externalId: 'ext-002' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.requests).toHaveLength(2);
      expect(body.count).toBe(2);
    });

    it('verifyToken을 Authorization 헤더의 토큰으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockVerifyToken).toHaveBeenCalledWith(fakeToken);
    });

    it('findMany를 status=PENDING 조건으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });

    it('결과를 createdAt 기준 최신순(desc)으로 정렬해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({ createdAt: 'desc' }),
        })
      );
    });
  });

  // ----------------------------------------------------------------
  // expiresAt 계산
  // ----------------------------------------------------------------
  describe('expiresAt 계산', () => {
    it('timeoutSeconds가 null인 요청은 expiresAt이 null이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ timeoutSeconds: null }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.requests[0].expiresAt).toBeNull();
    });

    it('timeoutSeconds가 있는 요청은 expiresAt이 계산되어 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const timeoutSeconds = 3600; // 1시간
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ timeoutSeconds, createdAt }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      const expectedExpiresAt = new Date(createdAt.getTime() + timeoutSeconds * 1000);
      expect(body.requests[0].expiresAt).toBe(expectedExpiresAt.toISOString());
    });

    it('timeoutSeconds=60인 요청의 expiresAt은 createdAt + 60초이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const createdAt = new Date('2024-06-01T12:00:00.000Z');
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ timeoutSeconds: 60, createdAt }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      const expectedExpiresAt = new Date('2024-06-01T12:01:00.000Z');
      expect(body.requests[0].expiresAt).toBe(expectedExpiresAt.toISOString());
    });

    it('timeoutSeconds가 있는 요청과 없는 요청이 혼재할 때 각각 올바르게 처리해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const createdAt = new Date('2025-01-01T00:00:00.000Z');
      // 만료되지 않은 미래 시간 기준으로 생성
      const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간 후
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-with-timeout', timeoutSeconds: 300, createdAt: farFuture }),
        makeMockRequest({ id: 'req-no-timeout', timeoutSeconds: null, createdAt }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert — timeoutSeconds가 있는 요청만 필터에서 제외될 수 있으므로 null인 것만 검증
      const noTimeoutItem = body.requests.find(
        (r: { id: string }) => r.id === 'req-no-timeout'
      );
      if (noTimeoutItem) {
        expect(noTimeoutItem.expiresAt).toBeNull();
      }
      const withTimeoutItem = body.requests.find(
        (r: { id: string }) => r.id === 'req-with-timeout'
      );
      if (withTimeoutItem) {
        expect(withTimeoutItem.expiresAt).not.toBeNull();
      }
    });
  });

  // ----------------------------------------------------------------
  // 만료된 요청 처리
  // ----------------------------------------------------------------
  describe('만료된 요청 처리 (EXPIRED 업데이트 후 제외)', () => {
    it('expiresAt이 현재 시각보다 이전인 요청은 목록에서 제외되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      // createdAt이 2시간 전, timeoutSeconds=3600 → 이미 만료
      const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-expired', timeoutSeconds: 3600, createdAt }),
      ]);
      mockRequestUpdate.mockResolvedValue(
        makeMockRequest({ id: 'req-expired', status: 'EXPIRED' })
      );
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      const expiredItem = body.requests.find((r: { id: string }) => r.id === 'req-expired');
      expect(expiredItem).toBeUndefined();
    });

    it('만료된 요청은 status=EXPIRED로 업데이트해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const expiredReq = makeMockRequest({ id: 'req-expired', timeoutSeconds: 3600, createdAt });
      mockRequestFindMany.mockResolvedValue([expiredReq]);
      mockRequestUpdate.mockResolvedValue({ ...expiredReq, status: 'EXPIRED' });
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'req-expired' }),
          data: expect.objectContaining({ status: 'EXPIRED' }),
        })
      );
    });

    it('만료된 요청이 제외된 후 count가 올바르게 계산되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const expiredCreatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const validCreatedAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-expired', timeoutSeconds: 3600, createdAt: expiredCreatedAt }),
        makeMockRequest({ id: 'req-valid', timeoutSeconds: null }),
        makeMockRequest({ id: 'req-valid-timeout', timeoutSeconds: 3600, createdAt: validCreatedAt }),
      ]);
      mockRequestUpdate.mockResolvedValue(
        makeMockRequest({ id: 'req-expired', status: 'EXPIRED' })
      );
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert — 만료된 1건 제외, 나머지 2건
      expect(body.count).toBe(2);
      expect(body.requests).toHaveLength(2);
    });

    it('만료되지 않은 요청은 update를 호출하지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      // timeoutSeconds가 없으면 만료 없음
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-valid', timeoutSeconds: null }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });

    it('만료된 요청이 여러 개이면 각각 EXPIRED로 업데이트해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const expiredCreatedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-exp-1', timeoutSeconds: 3600, createdAt: expiredCreatedAt }),
        makeMockRequest({ id: 'req-exp-2', timeoutSeconds: 3600, createdAt: expiredCreatedAt }),
      ]);
      mockRequestUpdate.mockResolvedValue(makeMockRequest({ status: 'EXPIRED' }));
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      expect(mockRequestUpdate).toHaveBeenCalledTimes(2);
      expect(mockRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'req-exp-1' }) })
      );
      expect(mockRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'req-exp-2' }) })
      );
    });

    it('만료 경계값 — expiresAt이 현재 시각과 정확히 같으면 만료 처리해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      // timeoutSeconds=1, createdAt을 충분히 과거로 설정하여 확실히 만료
      const createdAt = new Date(Date.now() - 10000); // 10초 전
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-boundary', timeoutSeconds: 1, createdAt }),
      ]);
      mockRequestUpdate.mockResolvedValue(
        makeMockRequest({ id: 'req-boundary', status: 'EXPIRED' })
      );
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert — 만료됐으므로 목록에 없어야 함
      const found = body.requests.find((r: { id: string }) => r.id === 'req-boundary');
      expect(found).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // PENDING 외 상태 필터링 (단위 검증)
  // ----------------------------------------------------------------
  describe('PENDING 상태만 조회', () => {
    it('findMany 호출 시 PENDING 상태 필터가 적용되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      await GET(request);

      // Assert
      const callArg = mockRequestFindMany.mock.calls[0][0] as Record<string, unknown>;
      const where = callArg?.where as Record<string, unknown>;
      expect(where?.status).toBe('PENDING');
    });

    it('응답의 requests 배열에는 APPROVED 상태 항목이 포함되지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      // findMany는 PENDING만 반환하도록 mock되어 있으므로 PENDING만 반환
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-pending', status: 'PENDING' }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      const hasNonPending = body.requests.some(
        (r: { status: string }) => r.status !== 'PENDING'
      );
      expect(hasNonPending).toBe(false);
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
        makeMockRequest({ id: 'req-uuid-0001' }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.requests[0]).toHaveProperty('id', 'req-uuid-0001');
    });

    it('각 요청 항목에 externalId 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ externalId: 'ext-999' }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.requests[0]).toHaveProperty('externalId', 'ext-999');
    });

    it('각 요청 항목에 status 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ status: 'PENDING' }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.requests[0]).toHaveProperty('status', 'PENDING');
    });

    it('각 요청 항목에 expiresAt 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ timeoutSeconds: null }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.requests[0]).toHaveProperty('expiresAt');
    });

    it('각 요청 항목에 createdAt 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ createdAt: new Date('2024-03-01T10:00:00.000Z') }),
      ]);
      const request = makeRequest(`Bearer ${fakeToken}`);

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.requests[0]).toHaveProperty('createdAt');
    });
  });
});
