/**
 * GET /api/requests/:id 라우트 핸들러 테스트
 *
 * app/api/requests/[id]/route.ts의 GET 핸들러 동작을 검증합니다.
 * x-api-key 헤더를 통한 API Key 인증 (환경변수 API_SECRET_KEY 비교)을 검증합니다.
 * PENDING 상태이고 expiresAt이 현재 시간보다 과거이면 EXPIRED로 응답 및 DB 업데이트합니다.
 * 존재하지 않는 ID 조회 시 404 응답을 검증합니다.
 * 실제 DB 연결 없이 prisma를 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/requests/[id]/route';
import { prisma } from '@/lib/prisma';

// 타입 캐스팅 헬퍼
const mockRequestFindUnique = prisma.request.findUnique as jest.Mock;
const mockRequestUpdate = prisma.request.update as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * NextRequest와 x-api-key 헤더를 생성합니다.
 */
function makeRequest(id: string, apiKey?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (apiKey !== undefined) {
    headers['x-api-key'] = apiKey;
  }
  return new NextRequest(`http://localhost/api/requests/${id}`, {
    method: 'GET',
    headers,
  });
}

/**
 * Next.js App Router의 동적 params 객체를 생성합니다.
 */
function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// 기본 mock Request 레코드 생성 헬퍼
function makeMockRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'clq1234567890',
    externalId: 'ext-001',
    context: '배포 승인 요청입니다.',
    requesterName: 'CI Bot',
    status: 'PENDING',
    timeoutSeconds: null,
    expiresAt: null,
    processedAt: null,
    processedById: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

// --- 테스트 스위트 ---

describe('GET /api/requests/:id', () => {
  const VALID_API_KEY = 'test-api-secret-key';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_SECRET_KEY = VALID_API_KEY;
  });

  afterEach(() => {
    delete process.env.API_SECRET_KEY;
  });

  // ----------------------------------------------------------------
  // API Key 인증 실패 → 401
  // ----------------------------------------------------------------
  describe('API Key 인증 실패 (401 Unauthorized)', () => {
    it('x-api-key 헤더가 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest('clq1234567890');
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(401);
    });

    it('잘못된 API Key로 요청하면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest('clq1234567890', 'invalid-api-key');
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(401);
    });

    it('빈 문자열 API Key로 요청하면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest('clq1234567890', '');
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(401);
    });

    it('API Key 인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest('clq1234567890', 'wrong-key');
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('API Key 인증 실패 시 findUnique를 호출하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest('clq1234567890', 'wrong-key');
      const params = makeParams('clq1234567890');

      // Act
      await GET(request, params);

      // Assert
      expect(mockRequestFindUnique).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 단건 조회 (happy path) → 200
  // ----------------------------------------------------------------
  describe('단건 조회 (200 OK)', () => {
    it('존재하는 ID로 조회하면 200을 반환해야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ id: 'clq-existing-id' });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq-existing-id', VALID_API_KEY);
      const params = makeParams('clq-existing-id');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(200);
    });

    it('응답 body에 id 필드가 포함되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ id: 'clq-test-id-001' });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq-test-id-001', VALID_API_KEY);
      const params = makeParams('clq-test-id-001');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('id');
      expect(body.id).toBe('clq-test-id-001');
    });

    it('응답 body에 externalId 필드가 포함되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ externalId: 'ext-pending-001' });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('externalId');
      expect(body.externalId).toBe('ext-pending-001');
    });

    it('응답 body에 status 필드가 포함되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ status: 'PENDING' });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('status');
      expect(body.status).toBe('PENDING');
    });

    it('응답 body에 context 필드가 포함되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ context: '배포 승인 요청입니다.' });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body.context).toBe('배포 승인 요청입니다.');
    });

    it('응답 body에 requesterName 필드가 포함되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ requesterName: 'CI Bot' });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body.requesterName).toBe('CI Bot');
    });

    it('URL 경로의 id로 findUnique를 호출해야 한다', async () => {
      // Arrange
      const targetId = 'clq-specific-id-123';
      mockRequestFindUnique.mockResolvedValue(makeMockRequest({ id: targetId }));
      const request = makeRequest(targetId, VALID_API_KEY);
      const params = makeParams(targetId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockRequestFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: targetId }),
        })
      );
    });
  });

  // ----------------------------------------------------------------
  // 존재하지 않는 ID → 404
  // ----------------------------------------------------------------
  describe('존재하지 않는 ID (404 Not Found)', () => {
    it('존재하지 않는 ID로 조회하면 404를 반환해야 한다', async () => {
      // Arrange
      mockRequestFindUnique.mockResolvedValue(null);
      const request = makeRequest('nonexistent-id-000', VALID_API_KEY);
      const params = makeParams('nonexistent-id-000');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(404);
    });

    it('404 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockRequestFindUnique.mockResolvedValue(null);
      const request = makeRequest('not-found-id', VALID_API_KEY);
      const params = makeParams('not-found-id');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('임의의 문자열 ID로 조회하면 404를 반환해야 한다', async () => {
      // Arrange
      mockRequestFindUnique.mockResolvedValue(null);
      const request = makeRequest('some-random-nonexistent-id', VALID_API_KEY);
      const params = makeParams('some-random-nonexistent-id');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(404);
    });
  });

  // ----------------------------------------------------------------
  // 만료 계산 로직
  // ----------------------------------------------------------------
  describe('만료 계산 (EXPIRED 처리)', () => {
    it('PENDING 상태이고 expiresAt이 현재 시간보다 과거이면 응답 status가 EXPIRED이어야 한다', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 60 * 1000); // 1분 전
      const mockRecord = makeMockRequest({
        status: 'PENDING',
        expiresAt: pastDate,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      mockRequestUpdate.mockResolvedValue({ ...mockRecord, status: 'EXPIRED' });
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body.status).toBe('EXPIRED');
    });

    it('PENDING 상태이고 expiresAt이 현재 시간보다 과거이면 DB를 EXPIRED로 업데이트해야 한다', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 60 * 1000); // 1분 전
      const mockRecord = makeMockRequest({
        id: 'clq-expire-update',
        status: 'PENDING',
        expiresAt: pastDate,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      mockRequestUpdate.mockResolvedValue({ ...mockRecord, status: 'EXPIRED' });
      const request = makeRequest('clq-expire-update', VALID_API_KEY);
      const params = makeParams('clq-expire-update');

      // Act
      await GET(request, params);

      // Assert
      expect(mockRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'clq-expire-update' }),
          data: expect.objectContaining({ status: 'EXPIRED' }),
        })
      );
    });

    it('PENDING 상태이고 expiresAt이 현재 시간보다 과거이면 200을 반환해야 한다', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 30 * 1000); // 30초 전
      const mockRecord = makeMockRequest({
        status: 'PENDING',
        expiresAt: pastDate,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      mockRequestUpdate.mockResolvedValue({ ...mockRecord, status: 'EXPIRED' });
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(200);
    });

    it('PENDING 상태이고 expiresAt이 미래이면 PENDING 상태 그대로 반환해야 한다', async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 60 * 1000); // 1분 후
      const mockRecord = makeMockRequest({
        status: 'PENDING',
        expiresAt: futureDate,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body.status).toBe('PENDING');
    });

    it('PENDING 상태이고 expiresAt이 미래이면 update를 호출하지 않아야 한다', async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 60 * 1000); // 1분 후
      const mockRecord = makeMockRequest({
        status: 'PENDING',
        expiresAt: futureDate,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      await GET(request, params);

      // Assert
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });

    it('PENDING 상태이고 expiresAt이 null이면 PENDING 상태 그대로 반환해야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({
        status: 'PENDING',
        expiresAt: null,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body.status).toBe('PENDING');
    });

    it('PENDING 상태이고 expiresAt이 null이면 update를 호출하지 않아야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({
        status: 'PENDING',
        expiresAt: null,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      await GET(request, params);

      // Assert
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });

    it('APPROVED 상태이면 만료 계산 없이 APPROVED 상태 그대로 반환해야 한다', async () => {
      // Arrange — expiresAt이 과거여도 APPROVED면 만료 처리 안 함
      const pastDate = new Date(Date.now() - 60 * 1000);
      const mockRecord = makeMockRequest({
        status: 'APPROVED',
        expiresAt: pastDate,
        processedAt: new Date('2024-01-01T00:05:00.000Z'),
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body.status).toBe('APPROVED');
    });

    it('APPROVED 상태이면 update를 호출하지 않아야 한다', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 60 * 1000);
      const mockRecord = makeMockRequest({
        status: 'APPROVED',
        expiresAt: pastDate,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      await GET(request, params);

      // Assert
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });

    it('REJECTED 상태이면 만료 계산 없이 REJECTED 상태 그대로 반환해야 한다', async () => {
      // Arrange — expiresAt이 과거여도 REJECTED면 만료 처리 안 함
      const pastDate = new Date(Date.now() - 60 * 1000);
      const mockRecord = makeMockRequest({
        status: 'REJECTED',
        expiresAt: pastDate,
        processedAt: new Date('2024-01-01T00:05:00.000Z'),
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);
      const body = await response.json();

      // Assert
      expect(body.status).toBe('REJECTED');
    });

    it('REJECTED 상태이면 update를 호출하지 않아야 한다', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 60 * 1000);
      const mockRecord = makeMockRequest({
        status: 'REJECTED',
        expiresAt: pastDate,
      });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq1234567890', VALID_API_KEY);
      const params = makeParams('clq1234567890');

      // Act
      await GET(request, params);

      // Assert
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });
  });
});
