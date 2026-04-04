/**
 * GET /api/me/requests/history 라우트 핸들러 테스트
 *
 * DLD-827: Forward Auth 기반으로 변경
 * Remote-User 헤더로 사용자를 식별합니다.
 */

// --- Mock 설정 ---

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    request: {
      findMany: jest.fn(),
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/me/requests/history/route';
import { prisma } from '@/lib/prisma';

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockRequestFindMany = prisma.request.findMany as jest.Mock;

function makeRequest(params?: Record<string, string>, autheliaId?: string): NextRequest {
  const url = new URL('http://localhost/api/me/requests/history');
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  const headers: Record<string, string> = {};
  if (autheliaId !== undefined) {
    headers['Remote-User'] = autheliaId;
  }
  return new NextRequest(url, { headers });
}

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

const mockUser = { id: 'user-admin', username: 'admin', autheliaId: 'uid-admin-001' };

describe('GET /api/me/requests/history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserUpdate.mockImplementation(() => Promise.resolve(mockUserFindUnique.mock.results.slice(-1)[0]?.value ?? null));
    mockUserCreate.mockImplementation(() => Promise.resolve(mockUserFindUnique.mock.results.slice(-1)[0]?.value ?? null));
  });

  // ----------------------------------------------------------------
  // Forward Auth 인증 없음 → 401
  // ----------------------------------------------------------------
  describe('Remote-User 헤더 없음 (401 Unauthorized)', () => {
    it('Remote-User 헤더가 없으면 401을 반환해야 한다', async () => {
      const request = makeRequest();
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      const request = makeRequest();
      const response = await GET(request);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('인증 실패 시 findMany를 호출하지 않아야 한다', async () => {
      const request = makeRequest();
      await GET(request);
      expect(mockRequestFindMany).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 정상 목록 조회 → 200
  // ----------------------------------------------------------------
  describe('정상 목록 조회 (200 OK)', () => {
    it('유효한 Remote-User로 요청하면 200을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('응답 body에 items 배열이 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
    });

    it('응답 body에 hasMore 필드가 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body).toHaveProperty('hasMore');
      expect(typeof body.hasMore).toBe('boolean');
    });

    it('응답 body에 nextCursor 필드가 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body).toHaveProperty('nextCursor');
    });
  });

  // ----------------------------------------------------------------
  // 상태 필터링
  // ----------------------------------------------------------------
  describe('처리 완료 상태 필터링', () => {
    it('findMany를 status IN [APPROVED, REJECTED, EXPIRED] 조건으로 호출해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, 'uid-admin-001');
      await GET(request);
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

    it('APPROVED 상태 요청이 응답 items에 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ id: 'req-approved', status: 'APPROVED' })]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      const item = body.items.find((r: { id: string }) => r.id === 'req-approved');
      expect(item).toBeDefined();
      expect(item.status).toBe('APPROVED');
    });

    it('REJECTED 상태 요청이 응답 items에 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ id: 'req-rejected', status: 'REJECTED' })]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      const item = body.items.find((r: { id: string }) => r.id === 'req-rejected');
      expect(item).toBeDefined();
      expect(item.status).toBe('REJECTED');
    });

    it('EXPIRED 상태 요청이 응답 items에 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ id: 'req-expired', status: 'EXPIRED' })]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      const item = body.items.find((r: { id: string }) => r.id === 'req-expired');
      expect(item).toBeDefined();
      expect(item.status).toBe('EXPIRED');
    });
  });

  // ----------------------------------------------------------------
  // 빈 결과 처리
  // ----------------------------------------------------------------
  describe('빈 결과 처리', () => {
    it('빈 결과 시 { items: [], hasMore: false, nextCursor: null } 구조이어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body).toEqual({ items: [], hasMore: false, nextCursor: null });
    });
  });

  // ----------------------------------------------------------------
  // 정렬
  // ----------------------------------------------------------------
  describe('정렬 (processedAt DESC)', () => {
    it('findMany를 processedAt 기준 내림차순으로 호출해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest(undefined, 'uid-admin-001');
      await GET(request);
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
    it('결과가 limit보다 많으면 hasMore가 true이어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const mockList = [
        makeMockRequest({ id: 'req-0001' }),
        makeMockRequest({ id: 'req-0002' }),
        makeMockRequest({ id: 'req-0003' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest({ limit: '2' }, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.hasMore).toBe(true);
    });

    it('결과가 limit 이하이면 hasMore가 false이어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ id: 'req-0001' })]);
      const request = makeRequest({ limit: '5' }, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.hasMore).toBe(false);
    });

    it('응답 items 수는 limit을 초과하지 않아야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const mockList = [
        makeMockRequest({ id: 'req-0001' }),
        makeMockRequest({ id: 'req-0002' }),
        makeMockRequest({ id: 'req-0003' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest({ limit: '2' }, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.items.length).toBeLessThanOrEqual(2);
    });
  });

  // ----------------------------------------------------------------
  // 응답 필드 구조 검증
  // ----------------------------------------------------------------
  describe('응답 필드 구조', () => {
    it('각 요청 항목에 id 필드가 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ id: 'req-uuid-9999' })]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.items[0]).toHaveProperty('id', 'req-uuid-9999');
    });

    it('각 요청 항목에 status 필드가 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ status: 'APPROVED' })]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.items[0]).toHaveProperty('status', 'APPROVED');
    });

    it('각 요청 항목에 processedAt 필드가 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ processedAt: new Date('2024-06-01T12:00:00.000Z') })]);
      const request = makeRequest(undefined, 'uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.items[0]).toHaveProperty('processedAt');
    });
  });
});
