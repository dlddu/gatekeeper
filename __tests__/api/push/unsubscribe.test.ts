/**
 * DELETE /api/me/push/unsubscribe 라우트 핸들러 테스트
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
    pushSubscription: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/me/push/unsubscribe/route';
import { prisma } from '@/lib/prisma';

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockPushSubscriptionFindUnique = prisma.pushSubscription.findUnique as jest.Mock;
const mockPushSubscriptionDelete = prisma.pushSubscription.delete as jest.Mock;

function makeRequest(body: Record<string, unknown>, authentikUid?: string): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authentikUid !== undefined) {
    headers['x-authentik-uid'] = authentikUid;
  }
  return new NextRequest('http://localhost/api/me/push/unsubscribe', {
    method: 'DELETE',
    headers,
    body: JSON.stringify(body),
  });
}

function makeMockSubscription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'clpush1234567',
    userId: 'user-admin',
    endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
    p256dh: 'BNc...',
    auth: 'abc...',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const validEndpoint = 'https://fcm.googleapis.com/fcm/send/example-endpoint';
const mockUser = { id: 'user-admin', username: 'admin', authentikUid: 'uid-admin-001' };

describe('DELETE /api/me/push/unsubscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // Forward Auth 인증 없음 → 401
  // ----------------------------------------------------------------
  describe('x-authentik-uid 헤더 없음 (401 Unauthorized)', () => {
    it('x-authentik-uid 헤더가 없으면 401을 반환해야 한다', async () => {
      const request = makeRequest({ endpoint: validEndpoint });
      const response = await DELETE(request);
      expect(response.status).toBe(401);
    });

    it('인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      const request = makeRequest({ endpoint: validEndpoint });
      const response = await DELETE(request);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('인증 실패 시 pushSubscription.delete를 호출하지 않아야 한다', async () => {
      const request = makeRequest({ endpoint: validEndpoint });
      await DELETE(request);
      expect(mockPushSubscriptionDelete).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 사용자를 찾지 못한 경우 → 401
  // ----------------------------------------------------------------
  describe('사용자를 찾지 못한 경우 (401 Unauthorized)', () => {
    it('DB에 사용자가 없으면 401을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      const request = makeRequest({ endpoint: validEndpoint }, 'unknown-uid');
      const response = await DELETE(request);
      expect(response.status).toBe(401);
    });
  });

  // ----------------------------------------------------------------
  // 존재하지 않는 endpoint → 404
  // ----------------------------------------------------------------
  describe('존재하지 않는 endpoint (404 Not Found)', () => {
    it('DB에 없는 endpoint로 구독 해제 시 404를 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      const request = makeRequest(
        { endpoint: 'https://example.com/not-registered-endpoint' },
        'uid-admin-001'
      );
      const response = await DELETE(request);
      expect(response.status).toBe(404);
    });

    it('endpoint가 없을 때 pushSubscription.delete를 호출하지 않아야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      const request = makeRequest(
        { endpoint: 'https://example.com/not-registered-endpoint' },
        'uid-admin-001'
      );
      await DELETE(request);
      expect(mockPushSubscriptionDelete).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 소유자 검증 실패 → 403
  // ----------------------------------------------------------------
  describe('소유자 검증 실패 (403 Forbidden)', () => {
    it('다른 사용자의 구독을 삭제하려고 하면 403을 반환해야 한다', async () => {
      // other-user UID로 인증했지만, 구독은 user-admin 소유
      const otherUser = { id: 'other-user', username: 'other', authentikUid: 'uid-other-001' };
      mockUserFindUnique.mockResolvedValue(otherUser);
      const subscription = makeMockSubscription({ userId: 'user-admin' }); // 다른 사용자 소유
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, 'uid-other-001');
      const response = await DELETE(request);
      expect(response.status).toBe(403);
    });

    it('소유자 검증 실패 시 pushSubscription.delete를 호출하지 않아야 한다', async () => {
      const otherUser = { id: 'other-user', username: 'other', authentikUid: 'uid-other-001' };
      mockUserFindUnique.mockResolvedValue(otherUser);
      const subscription = makeMockSubscription({ userId: 'user-admin' });
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, 'uid-other-001');
      await DELETE(request);
      expect(mockPushSubscriptionDelete).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 정상 구독 해제 → 200
  // ----------------------------------------------------------------
  describe('정상 구독 해제 (200 OK)', () => {
    it('등록된 endpoint로 구독 해제 시 200을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const subscription = makeMockSubscription();
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      mockPushSubscriptionDelete.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, 'uid-admin-001');
      const response = await DELETE(request);
      expect(response.status).toBe(200);
    });

    it('해당 endpoint로 pushSubscription.delete를 호출해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const subscription = makeMockSubscription();
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      mockPushSubscriptionDelete.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, 'uid-admin-001');
      await DELETE(request);
      expect(mockPushSubscriptionDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ endpoint: validEndpoint }),
        })
      );
    });
  });
});
