/**
 * PATCH /api/requests/:id/reject 라우트 핸들러 테스트
 *
 * app/api/requests/[id]/reject/route.ts의 PATCH 핸들러 동작을 검증합니다.
 * JWT 인증이 필요한 엔드포인트입니다.
 * PENDING 상태의 Request를 REJECTED로 변경하는 동작을 검증합니다.
 * 실제 DB 연결 없이 prisma와 verifyToken을 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      findUnique: jest.fn(),
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
import { PATCH } from '@/app/api/requests/[id]/reject/route';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// 타입 캐스팅 헬퍼
const mockRequestFindUnique = prisma.request.findUnique as jest.Mock;
const mockRequestUpdate = prisma.request.update as jest.Mock;
const mockVerifyToken = verifyToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * Authorization 헤더를 포함한 PATCH NextRequest를 생성합니다.
 */
function makeRequest(id: string, authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new NextRequest(`http://localhost/api/requests/${id}/reject`, {
    method: 'PATCH',
    headers,
  });
}

/**
 * Next.js App Router의 동적 params 객체를 생성합니다.
 */
function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// mock Request 레코드 생성 헬퍼
function makeMockRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'clq1234567890',
    externalId: 'ext-001',
    context: '배포 승인 요청입니다.',
    requesterName: 'CI Bot',
    status: 'PENDING',
    timeoutSeconds: null,
    processedAt: null,
    processedById: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

// 검증된 JWT 페이로드
const verifiedPayload = { userId: 'user-admin', username: 'admin', iat: 1000, exp: 9999999999 };

// --- 테스트 스위트 ---

describe('PATCH /api/requests/:id/reject', () => {
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
      const request = makeRequest('clq1234567890');
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);

      // Assert
      expect(response.status).toBe(401);
    });

    it('Bearer 형식이 아닌 Authorization 헤더이면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest('clq1234567890', 'Basic dXNlcjpwYXNz');
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);

      // Assert
      expect(response.status).toBe(401);
    });

    it('유효하지 않은 JWT 토큰이면 401을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWTExpired'));
      const request = makeRequest('clq1234567890', 'Bearer expired.jwt.token');
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);

      // Assert
      expect(response.status).toBe(401);
    });

    it('인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest('clq1234567890');
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('JWT 인증 실패 시 request.update를 호출하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest('clq1234567890');
      const params = makeParams('clq1234567890');

      // Act
      await PATCH(request, params);

      // Assert
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 존재하지 않는 ID → 404
  // ----------------------------------------------------------------
  describe('존재하지 않는 ID (404 Not Found)', () => {
    it('존재하지 않는 ID로 거절 시도하면 404를 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(null);
      const request = makeRequest('nonexistent-id', `Bearer ${fakeToken}`);
      const params = makeParams('nonexistent-id');

      // Act
      const response = await PATCH(request, params);

      // Assert
      expect(response.status).toBe(404);
    });

    it('404 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(null);
      const request = makeRequest('not-found-id', `Bearer ${fakeToken}`);
      const params = makeParams('not-found-id');

      // Act
      const response = await PATCH(request, params);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });
  });

  // ----------------------------------------------------------------
  // 이미 REJECTED된 요청 → 409
  // ----------------------------------------------------------------
  describe('이미 REJECTED 상태 (409 Conflict)', () => {
    it('이미 REJECTED된 요청을 재거절하면 409를 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(
        makeMockRequest({ status: 'REJECTED', processedAt: new Date() })
      );
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);

      // Assert
      expect(response.status).toBe(409);
    });

    it('409 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(
        makeMockRequest({ status: 'REJECTED', processedAt: new Date() })
      );
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
    });

    it('이미 REJECTED 상태일 때 request.update를 호출하지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(
        makeMockRequest({ status: 'REJECTED' })
      );
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      await PATCH(request, params);

      // Assert
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });

    it('APPROVED 상태의 요청을 거절 시도하면 409를 반환해야 한다', async () => {
      // Arrange — 이미 처리된(APPROVED) 요청도 거절 불가
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(
        makeMockRequest({ status: 'APPROVED', processedAt: new Date() })
      );
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);

      // Assert
      expect(response.status).toBe(409);
    });
  });

  // ----------------------------------------------------------------
  // 정상 거절 (happy path) → 200
  // ----------------------------------------------------------------
  describe('정상 거절 (200 OK)', () => {
    it('PENDING 요청을 거절하면 200을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(
        makeMockRequest({ status: 'PENDING' })
      );
      mockRequestUpdate.mockResolvedValue(
        makeMockRequest({
          status: 'REJECTED',
          processedAt: new Date('2024-01-02T00:00:00.000Z'),
          processedById: 'user-admin',
        })
      );
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);

      // Assert
      expect(response.status).toBe(200);
    });

    it('응답 body의 status가 REJECTED이어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(
        makeMockRequest({ status: 'PENDING' })
      );
      mockRequestUpdate.mockResolvedValue(
        makeMockRequest({
          status: 'REJECTED',
          processedAt: new Date('2024-01-02T00:00:00.000Z'),
          processedById: 'user-admin',
        })
      );
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);
      const body = await response.json();

      // Assert
      expect(body.status).toBe('REJECTED');
    });

    it('응답 body에 processedAt이 설정되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(
        makeMockRequest({ status: 'PENDING' })
      );
      mockRequestUpdate.mockResolvedValue(
        makeMockRequest({
          status: 'REJECTED',
          processedAt: new Date('2024-01-02T00:00:00.000Z'),
          processedById: 'user-admin',
        })
      );
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      const response = await PATCH(request, params);
      const body = await response.json();

      // Assert
      expect(body.processedAt).toBeDefined();
      expect(body.processedAt).not.toBeNull();
    });

    it('REJECTED 상태와 processedAt을 포함해서 update를 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(
        makeMockRequest({ id: 'clq1234567890', status: 'PENDING' })
      );
      mockRequestUpdate.mockResolvedValue(
        makeMockRequest({ status: 'REJECTED', processedAt: new Date(), processedById: 'user-admin' })
      );
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      await PATCH(request, params);

      // Assert
      expect(mockRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'clq1234567890' }),
          data: expect.objectContaining({
            status: 'REJECTED',
            processedAt: expect.any(Date),
          }),
        })
      );
    });

    it('verifyToken을 Authorization 헤더의 토큰으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockRequestFindUnique.mockResolvedValue(makeMockRequest({ status: 'PENDING' }));
      mockRequestUpdate.mockResolvedValue(makeMockRequest({ status: 'REJECTED' }));
      const request = makeRequest('clq1234567890', `Bearer ${fakeToken}`);
      const params = makeParams('clq1234567890');

      // Act
      await PATCH(request, params);

      // Assert
      expect(mockVerifyToken).toHaveBeenCalledWith(fakeToken);
    });
  });
});
