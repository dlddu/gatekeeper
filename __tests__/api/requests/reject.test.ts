/**
 * PATCH /api/requests/:id/reject 라우트 핸들러 테스트
 *
 * DLD-827: Forward Auth 기반으로 변경
 * app/api/requests/[id]/reject/route.ts의 PATCH 핸들러 동작을 검증합니다.
 * Remote-User 헤더로 사용자를 식별합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    request: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/requests/[id]/reject/route';
import { prisma } from '@/lib/prisma';

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockRequestFindUnique = prisma.request.findUnique as jest.Mock;
const mockRequestUpdate = prisma.request.update as jest.Mock;

function makeRequest(id: string, autheliaId?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (autheliaId !== undefined) {
    headers['Remote-User'] = autheliaId;
  }
  return new NextRequest(`http://localhost/api/requests/${id}/reject`, {
    method: 'PATCH',
    headers,
  });
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

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

const mockUser = { id: 'user-admin', username: 'admin', autheliaId: 'uid-admin-001' };

describe('PATCH /api/requests/:id/reject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserUpdate.mockImplementation(() => Promise.resolve(mockUserFindUnique.mock.results.slice(-1)[0]?.value ?? null));
    mockUserCreate.mockImplementation(() => Promise.resolve(mockUserFindUnique.mock.results.slice(-1)[0]?.value ?? null));
  });

  describe('Remote-User 헤더 없음 (401 Unauthorized)', () => {
    it('Remote-User 헤더가 없으면 401을 반환해야 한다', async () => {
      const request = makeRequest('clq1234567890');
      const params = makeParams('clq1234567890');
      const response = await PATCH(request, params);
      expect(response.status).toBe(401);
    });

    it('인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      const request = makeRequest('clq1234567890');
      const params = makeParams('clq1234567890');
      const response = await PATCH(request, params);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('인증 실패 시 request.update를 호출하지 않아야 한다', async () => {
      const request = makeRequest('clq1234567890');
      const params = makeParams('clq1234567890');
      await PATCH(request, params);
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });
  });

  describe('사용자를 찾지 못한 경우 (401 Unauthorized)', () => {
    it('DB에 사용자가 없으면 401을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      const request = makeRequest('clq1234567890', 'unknown-uid');
      const params = makeParams('clq1234567890');
      const response = await PATCH(request, params);
      expect(response.status).toBe(401);
    });
  });

  describe('존재하지 않는 ID (404 Not Found)', () => {
    it('존재하지 않는 ID로 거절 시도하면 404를 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindUnique.mockResolvedValue(null);
      const request = makeRequest('nonexistent-id', 'uid-admin-001');
      const params = makeParams('nonexistent-id');
      const response = await PATCH(request, params);
      expect(response.status).toBe(404);
    });
  });

  describe('이미 처리된 상태 (409 Conflict)', () => {
    it('이미 REJECTED된 요청을 재거절하면 409를 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindUnique.mockResolvedValue(makeMockRequest({ status: 'REJECTED', processedAt: new Date() }));
      const request = makeRequest('clq1234567890', 'uid-admin-001');
      const params = makeParams('clq1234567890');
      const response = await PATCH(request, params);
      expect(response.status).toBe(409);
    });

    it('APPROVED 상태의 요청을 거절 시도하면 409를 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindUnique.mockResolvedValue(makeMockRequest({ status: 'APPROVED', processedAt: new Date() }));
      const request = makeRequest('clq1234567890', 'uid-admin-001');
      const params = makeParams('clq1234567890');
      const response = await PATCH(request, params);
      expect(response.status).toBe(409);
    });
  });

  describe('정상 거절 (200 OK)', () => {
    it('PENDING 요청을 거절하면 200을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindUnique.mockResolvedValue(makeMockRequest({ status: 'PENDING' }));
      mockRequestUpdate.mockResolvedValue(makeMockRequest({ status: 'REJECTED', processedAt: new Date(), processedById: 'user-admin' }));
      const request = makeRequest('clq1234567890', 'uid-admin-001');
      const params = makeParams('clq1234567890');
      const response = await PATCH(request, params);
      expect(response.status).toBe(200);
    });

    it('응답 body의 status가 REJECTED이어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindUnique.mockResolvedValue(makeMockRequest({ status: 'PENDING' }));
      mockRequestUpdate.mockResolvedValue(makeMockRequest({ status: 'REJECTED', processedAt: new Date(), processedById: 'user-admin' }));
      const request = makeRequest('clq1234567890', 'uid-admin-001');
      const params = makeParams('clq1234567890');
      const response = await PATCH(request, params);
      const body = await response.json();
      expect(body.status).toBe('REJECTED');
    });

    it('update를 REJECTED 상태로 호출해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRequestFindUnique.mockResolvedValue(makeMockRequest({ id: 'clq1234567890', status: 'PENDING' }));
      mockRequestUpdate.mockResolvedValue(makeMockRequest({ status: 'REJECTED', processedAt: new Date(), processedById: 'user-admin' }));
      const request = makeRequest('clq1234567890', 'uid-admin-001');
      const params = makeParams('clq1234567890');
      await PATCH(request, params);
      expect(mockRequestUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'clq1234567890' }),
        data: expect.objectContaining({ status: 'REJECTED', processedAt: expect.any(Date) }),
      }));
    });
  });
});
