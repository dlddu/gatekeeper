/**
 * GET /api/requests 라우트 핸들러 테스트
 *
 * app/api/requests/route.ts의 GET 핸들러 동작을 검증합니다.
 * 인증 없이 공개 접근 가능한 목록 조회를 검증합니다.
 * status 쿼리 파라미터를 통한 필터링을 검증합니다.
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
import { GET } from '@/app/api/requests/route';
import { prisma } from '@/lib/prisma';

// 타입 캐스팅 헬퍼
const mockRequestFindMany = prisma.request.findMany as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * 선택적 쿼리 파라미터를 포함한 NextRequest를 생성합니다.
 */
function makeRequest(queryParams?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/requests');
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new NextRequest(url.toString(), { method: 'GET' });
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

describe('GET /api/requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // 목록 조회 (happy path) → 200
  // ----------------------------------------------------------------
  describe('목록 조회 (200 OK)', () => {
    it('인증 없이 요청 목록을 조회할 수 있어야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest();

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('응답 body가 배열이어야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(Array.isArray(body)).toBe(true);
    });

    it('데이터가 있으면 목록을 반환해야 한다', async () => {
      // Arrange
      const mockList = [
        makeMockRequest({ id: 'id-1', externalId: 'ext-001', status: 'PENDING' }),
        makeMockRequest({ id: 'id-2', externalId: 'ext-002', status: 'APPROVED' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveLength(2);
    });

    it('각 항목에 id 필드가 포함되어야 한다', async () => {
      // Arrange
      const mockList = [makeMockRequest({ id: 'clq-test-id' })];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body[0]).toHaveProperty('id');
    });

    it('각 항목에 externalId 필드가 포함되어야 한다', async () => {
      // Arrange
      const mockList = [makeMockRequest({ externalId: 'ext-999' })];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body[0]).toHaveProperty('externalId');
      expect(body[0].externalId).toBe('ext-999');
    });

    it('각 항목에 status 필드가 포함되어야 한다', async () => {
      // Arrange
      const mockList = [makeMockRequest({ status: 'PENDING' })];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body[0]).toHaveProperty('status');
    });

    it('결과가 없으면 빈 배열을 반환해야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // status 필터링 (happy path)
  // ----------------------------------------------------------------
  describe('status 필터링', () => {
    it('status=PENDING으로 필터링하면 200을 반환해야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ status: 'PENDING' }),
      ]);
      const request = makeRequest({ status: 'PENDING' });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('status=APPROVED로 필터링하면 200을 반환해야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ status: 'APPROVED' }),
      ]);
      const request = makeRequest({ status: 'APPROVED' });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('status=REJECTED로 필터링하면 200을 반환해야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ status: 'REJECTED' }),
      ]);
      const request = makeRequest({ status: 'REJECTED' });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('status=EXPIRED로 필터링하면 200을 반환해야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ status: 'EXPIRED' }),
      ]);
      const request = makeRequest({ status: 'EXPIRED' });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('status=PENDING 필터링 시 where 조건과 함께 findMany를 호출해야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest({ status: 'PENDING' });

      // Act
      await GET(request);

      // Assert
      expect(mockRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });

    it('status 파라미터 없이 호출 시 where 조건 없이 findMany를 호출해야 한다', async () => {
      // Arrange
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest();

      // Act
      await GET(request);

      // Assert — status 필터 없이 전체 조회
      expect(mockRequestFindMany).toHaveBeenCalled();
      const callArg = mockRequestFindMany.mock.calls[0][0] as Record<string, unknown> | undefined;
      // where.status가 설정되지 않았거나 undefined여야 함
      const whereClause = callArg?.where as Record<string, unknown> | undefined;
      expect(whereClause?.status).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // 잘못된 status 값 → 400
  // ----------------------------------------------------------------
  describe('잘못된 status 값 (400 Bad Request)', () => {
    it('유효하지 않은 status 값으로 필터링하면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ status: 'INVALID_STATUS' });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('소문자 status 값은 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ status: 'pending' });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('임의의 문자열 status 값은 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ status: 'UNKNOWN' });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('400 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest({ status: 'BAD_VALUE' });

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('잘못된 status 값일 때 findMany를 호출하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest({ status: 'NOT_A_STATUS' });

      // Act
      await GET(request);

      // Assert
      expect(mockRequestFindMany).not.toHaveBeenCalled();
    });
  });
});
