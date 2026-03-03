/**
 * GET /api/requests/:id 라우트 핸들러 테스트
 *
 * app/api/requests/[id]/route.ts의 GET 핸들러 동작을 검증합니다.
 * 인증 없이 공개 접근 가능한 단건 조회를 검증합니다.
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
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/requests/[id]/route';
import { prisma } from '@/lib/prisma';

// 타입 캐스팅 헬퍼
const mockRequestFindUnique = prisma.request.findUnique as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * NextRequest와 params를 생성합니다.
 */
function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/requests/${id}`, {
    method: 'GET',
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
    processedAt: null,
    processedById: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

// --- 테스트 스위트 ---

describe('GET /api/requests/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // 단건 조회 (happy path) → 200
  // ----------------------------------------------------------------
  describe('단건 조회 (200 OK)', () => {
    it('존재하는 ID로 조회하면 200을 반환해야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ id: 'clq-existing-id' });
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = makeRequest('clq-existing-id');
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
      const request = makeRequest('clq-test-id-001');
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
      const request = makeRequest('clq1234567890');
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
      const request = makeRequest('clq1234567890');
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
      const request = makeRequest('clq1234567890');
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
      const request = makeRequest('clq1234567890');
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
      const request = makeRequest(targetId);
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

    it('인증 없이도 단건 조회할 수 있어야 한다', async () => {
      // Arrange — Authorization 헤더 없는 요청
      const mockRecord = makeMockRequest();
      mockRequestFindUnique.mockResolvedValue(mockRecord);
      const request = new NextRequest('http://localhost/api/requests/clq1234567890', {
        method: 'GET',
        // Authorization 헤더 없음
      });
      const params = makeParams('clq1234567890');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ----------------------------------------------------------------
  // 존재하지 않는 ID → 404
  // ----------------------------------------------------------------
  describe('존재하지 않는 ID (404 Not Found)', () => {
    it('존재하지 않는 ID로 조회하면 404를 반환해야 한다', async () => {
      // Arrange
      mockRequestFindUnique.mockResolvedValue(null);
      const request = makeRequest('nonexistent-id-000');
      const params = makeParams('nonexistent-id-000');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(404);
    });

    it('404 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockRequestFindUnique.mockResolvedValue(null);
      const request = makeRequest('not-found-id');
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
      const request = makeRequest('some-random-nonexistent-id');
      const params = makeParams('some-random-nonexistent-id');

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(404);
    });
  });
});
