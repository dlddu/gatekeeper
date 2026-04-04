/**
 * POST /api/me/push/subscribe 라우트 핸들러 테스트
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
    pushSubscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/me/push/subscribe/route';
import { prisma } from '@/lib/prisma';

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockPushSubscriptionCreate = prisma.pushSubscription.create as jest.Mock;
const mockPushSubscriptionFindUnique = prisma.pushSubscription.findUnique as jest.Mock;

function makeRequest(body: Record<string, unknown>, autheliaId?: string): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (autheliaId !== undefined) {
    headers['Remote-User'] = autheliaId;
  }
  return new NextRequest('http://localhost/api/me/push/subscribe', {
    method: 'POST',
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

const validBody = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
  keys: {
    p256dh: 'BNc...',
    auth: 'abc...',
  },
};

const mockUser = { id: 'user-admin', username: 'admin', autheliaId: 'uid-admin-001' };

describe('POST /api/me/push/subscribe', () => {
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
      const request = makeRequest(validBody);
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      const request = makeRequest(validBody);
      const response = await POST(request);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('인증 실패 시 pushSubscription.create를 호출하지 않아야 한다', async () => {
      const request = makeRequest(validBody);
      await POST(request);
      expect(mockPushSubscriptionCreate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 사용자를 찾지 못한 경우 → 401
  // ----------------------------------------------------------------
  describe('사용자를 찾지 못한 경우 (401 Unauthorized)', () => {
    it('DB에 사용자가 없으면 401을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      const request = makeRequest(validBody, 'unknown-uid');
      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  // ----------------------------------------------------------------
  // 필수 필드 누락 → 400
  // ----------------------------------------------------------------
  describe('필수 필드 누락 (400 Bad Request)', () => {
    it('endpoint가 없으면 400을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const request = makeRequest({ keys: { p256dh: 'BNc...', auth: 'abc...' } }, 'uid-admin-001');
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('keys.p256dh가 없으면 400을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const request = makeRequest({
        endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
        keys: { auth: 'abc...' },
      }, 'uid-admin-001');
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('keys.auth가 없으면 400을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const request = makeRequest({
        endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
        keys: { p256dh: 'BNc...' },
      }, 'uid-admin-001');
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('400 응답 body에 error 필드가 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const request = makeRequest({}, 'uid-admin-001');
      const response = await POST(request);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('필드 누락 시 pushSubscription.create를 호출하지 않아야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      const request = makeRequest({}, 'uid-admin-001');
      await POST(request);
      expect(mockPushSubscriptionCreate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 중복 endpoint → 200 (기존 구독 반환)
  // ----------------------------------------------------------------
  describe('중복 endpoint (200 OK - 기존 구독 반환)', () => {
    it('이미 존재하는 endpoint로 구독 시도 시 200을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPushSubscriptionFindUnique.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, 'uid-admin-001');
      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('중복 endpoint 시 pushSubscription.create를 호출하지 않아야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPushSubscriptionFindUnique.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, 'uid-admin-001');
      await POST(request);
      expect(mockPushSubscriptionCreate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 정상 구독 등록 → 201
  // ----------------------------------------------------------------
  describe('정상 구독 등록 (201 Created)', () => {
    it('유효한 데이터로 구독 시 201을 반환해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      mockPushSubscriptionCreate.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, 'uid-admin-001');
      const response = await POST(request);
      expect(response.status).toBe(201);
    });

    it('201 응답 body에 생성된 구독의 id가 포함되어야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      mockPushSubscriptionCreate.mockResolvedValue(makeMockSubscription({ id: 'new-sub-id' }));
      const request = makeRequest(validBody, 'uid-admin-001');
      const response = await POST(request);
      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body.id).toBe('new-sub-id');
    });

    it('endpoint, p256dh, auth를 포함하여 pushSubscription.create를 호출해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      mockPushSubscriptionCreate.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, 'uid-admin-001');
      await POST(request);
      expect(mockPushSubscriptionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endpoint: validBody.endpoint,
            p256dh: validBody.keys.p256dh,
            auth: validBody.keys.auth,
          }),
        })
      );
    });

    it('인증된 사용자의 userId로 pushSubscription.create를 호출해야 한다', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      mockPushSubscriptionCreate.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, 'uid-admin-001');
      await POST(request);
      expect(mockPushSubscriptionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
          }),
        })
      );
    });
  });
});
