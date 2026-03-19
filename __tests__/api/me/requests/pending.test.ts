/**
 * GET /api/me/requests/pending 라우트 핸들러 테스트
 *
 * DLD-827: Forward Auth 기반으로 변경
 * x-authentik-uid 헤더로 사용자를 식별합니다.
 */

// --- Mock 설정 ---

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    request: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/me/requests/pending/route';
import { prisma } from '@/lib/prisma';

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockRequestFindMany = prisma.request.findMany as jest.Mock;
const mockRequestUpdate = prisma.request.update as jest.Mock;

function makeRequest(authentikUid?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authentikUid !== undefined) {
    headers['x-authentik-uid'] = authentikUid;
  }
  return new NextRequest('http://localhost/api/me/requests/pending', {
    method: 'GET',
    headers,
  });
}

function makeMockRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'req-uuid-0001',
    externalId: 'ext-001',
    context: '배포 승인 요청입니다.',
    requesterName: 'CI Bot',
    status: 'PENDING',
    timeoutSeconds: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    respondedAt: null,
    respondedBy: null,
    ...overrides,
  };
}

const mockUser = { id: 'user-admin', username: 'admin', authentikUid: 'uid-admin-001' };

describe('GET /api/me/requests/pending', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // Forward Auth 인증 없음 → 401
  // ----------------------------------------------------------------
  describe('x-authentik-uid 헤더 없음 (401 Unauthorized)', () => {
    it('x-authentik-uid 헤더가 없으면 401을 반환해야 한다', async () => {
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
  // 사용자를 찾지 못한 경우 → 401
  // ----------------------------------------------------------------
  describe('사용자를 찾지 못한 경우 (401 Unauthorized)', () => {
    it('DB에 사용자가 없으면 401을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      const request = makeRequest('unknown-uid');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  // ----------------------------------------------------------------
  // 정상 목록 조회 → 200
  // ----------------------------------------------------------------
  describe('정상 목록 조회 (200 OK)', () => {
    it('유효한 x-authentik-uid로 요청하면 200을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest('uid-admin-001');
      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('응답 body에 requests 배열이 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest('uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body).toHaveProperty('requests');
      expect(Array.isArray(body.requests)).toBe(true);
    });

    it('응답 body에 count 필드가 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest('uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body).toHaveProperty('count');
      expect(typeof body.count).toBe('number');
    });

    it('PENDING 요청이 없으면 빈 배열과 count 0을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest('uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.requests).toEqual([]);
      expect(body.count).toBe(0);
    });

    it('PENDING 요청이 있으면 목록을 반환하고 count가 일치해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const mockList = [
        makeMockRequest({ id: 'req-0001', externalId: 'ext-001' }),
        makeMockRequest({ id: 'req-0002', externalId: 'ext-002' }),
      ];
      mockRequestFindMany.mockResolvedValue(mockList);
      const request = makeRequest('uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.requests).toHaveLength(2);
      expect(body.count).toBe(2);
    });

    it('findMany를 status=PENDING 조건으로 호출해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest('uid-admin-001');
      await GET(request);
      expect(mockRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });

    it('결과를 createdAt 기준 최신순(desc)으로 정렬해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([]);
      const request = makeRequest('uid-admin-001');
      await GET(request);
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
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ timeoutSeconds: null })]);
      const request = makeRequest('uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      expect(body.requests[0].expiresAt).toBeNull();
    });

    it('timeoutSeconds가 있는 요청은 expiresAt이 계산되어 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const createdAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const timeoutSeconds = 3600;
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ timeoutSeconds, createdAt })]);
      const request = makeRequest('uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      const expectedExpiresAt = new Date(createdAt.getTime() + timeoutSeconds * 1000);
      expect(body.requests[0].expiresAt).toBe(expectedExpiresAt.toISOString());
    });
  });

  // ----------------------------------------------------------------
  // 만료된 요청 처리
  // ----------------------------------------------------------------
  describe('만료된 요청 처리 (EXPIRED 업데이트 후 제외)', () => {
    it('expiresAt이 현재 시각보다 이전인 요청은 목록에서 제외되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockRequestFindMany.mockResolvedValue([
        makeMockRequest({ id: 'req-expired', timeoutSeconds: 3600, createdAt }),
      ]);
      mockRequestUpdate.mockResolvedValue(makeMockRequest({ id: 'req-expired', status: 'EXPIRED' }));
      const request = makeRequest('uid-admin-001');
      const response = await GET(request);
      const body = await response.json();
      const expiredItem = body.requests.find((r: { id: string }) => r.id === 'req-expired');
      expect(expiredItem).toBeUndefined();
    });

    it('만료된 요청은 status=EXPIRED로 업데이트해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const expiredReq = makeMockRequest({ id: 'req-expired', timeoutSeconds: 3600, createdAt });
      mockRequestFindMany.mockResolvedValue([expiredReq]);
      mockRequestUpdate.mockResolvedValue({ ...expiredReq, status: 'EXPIRED' });
      const request = makeRequest('uid-admin-001');
      await GET(request);
      expect(mockRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'req-expired' }),
          data: expect.objectContaining({ status: 'EXPIRED' }),
        })
      );
    });

    it('만료되지 않은 요청은 update를 호출하지 않아야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindMany.mockResolvedValue([makeMockRequest({ id: 'req-valid', timeoutSeconds: null })]);
      const request = makeRequest('uid-admin-001');
      await GET(request);
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });
  });
});
