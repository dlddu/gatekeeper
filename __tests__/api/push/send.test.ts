/**
 * POST /api/push/send 라우트 핸들러 테스트
 *
 * app/api/push/send/route.ts의 POST 핸들러 동작을 검증합니다.
 * x-api-key 헤더를 통한 API Key 인증으로 내부 서버에서 호출됩니다.
 * 대상 사용자의 모든 PushSubscription에 lib/push.ts를 통해 알림을 발송합니다.
 * 실제 DB 연결 없이 prisma와 lib/push 모듈을 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// lib/push mock
jest.mock('@/lib/push', () => ({
  sendPushNotifications: jest.fn(),
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/push/send/route';
import { prisma } from '@/lib/prisma';
import { sendPushNotifications } from '@/lib/push';

// 타입 캐스팅 헬퍼
const mockFindMany = prisma.pushSubscription.findMany as jest.Mock;
const mockSendPushNotifications = sendPushNotifications as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * x-api-key 헤더와 JSON body를 포함한 POST NextRequest를 생성합니다.
 */
function makeRequest(
  body: Record<string, unknown>,
  apiKey?: string
): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey !== undefined) {
    headers['x-api-key'] = apiKey;
  }
  return new NextRequest('http://localhost/api/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// 기본 mock PushSubscription 레코드 생성 헬퍼
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

const VALID_API_KEY = 'test-api-secret-key';

const validBody = {
  userId: 'user-admin',
  title: '승인 요청이 도착했습니다',
  body: '배포 승인이 필요합니다.',
};

// --- 테스트 스위트 ---

describe('POST /api/push/send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_SECRET_KEY = VALID_API_KEY;
    process.env.VAPID_PUBLIC_KEY = 'test-vapid-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-vapid-private-key';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';

    // Default: sendPushNotifications resolves successfully
    mockSendPushNotifications.mockImplementation(async (options) => {
      // Simulate onSuccess callback for each subscription
      if (options.onSuccess) {
        for (let i = 0; i < (options.subscriptions?.length ?? 0); i++) {
          options.onSuccess();
        }
      }
    });
  });

  afterEach(() => {
    delete process.env.API_SECRET_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  // ----------------------------------------------------------------
  // API Key 인증 실패 → 401
  // ----------------------------------------------------------------
  describe('API Key 인증 실패 (401 Unauthorized)', () => {
    it('x-api-key 헤더가 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(validBody);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('잘못된 API Key로 요청하면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(validBody, 'invalid-api-key');

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('빈 문자열 API Key로 요청하면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(validBody, '');

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('API Key 인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest(validBody, 'wrong-key');

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('API Key 인증 실패 시 sendPushNotifications를 호출하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest(validBody, 'wrong-key');

      // Act
      await POST(request);

      // Assert
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 구독자 없음 → 발송 없이 성공
  // ----------------------------------------------------------------
  describe('구독자 없음 (발송 건너뜀)', () => {
    it('구독자가 없으면 sendPushNotifications를 호출하지 않아야 한다', async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);
      const request = makeRequest(validBody, VALID_API_KEY);

      // Act
      await POST(request);

      // Assert
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
    });

    it('구독자가 없어도 요청 자체는 성공해야 한다', async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);
      const request = makeRequest(validBody, VALID_API_KEY);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ----------------------------------------------------------------
  // 정상 발송 (happy path)
  // ----------------------------------------------------------------
  describe('정상 발송', () => {
    it('구독자가 있으면 sendPushNotifications를 호출해야 한다', async () => {
      // Arrange
      mockFindMany.mockResolvedValue([makeMockSubscription()]);
      const request = makeRequest(validBody, VALID_API_KEY);

      // Act
      await POST(request);

      // Assert
      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1);
    });

    it('sendPushNotifications에 구독 목록이 전달되어야 한다', async () => {
      // Arrange
      const subscriptions = [
        makeMockSubscription({ id: 'sub-1', endpoint: 'https://fcm.example.com/1' }),
        makeMockSubscription({ id: 'sub-2', endpoint: 'https://fcm.example.com/2' }),
        makeMockSubscription({ id: 'sub-3', endpoint: 'https://fcm.example.com/3' }),
      ];
      mockFindMany.mockResolvedValue(subscriptions);
      const request = makeRequest(validBody, VALID_API_KEY);

      // Act
      await POST(request);

      // Assert
      expect(mockSendPushNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptions,
        })
      );
    });

    it('sendPushNotifications에 알림 payload(title, body)가 포함되어야 한다', async () => {
      // Arrange
      mockFindMany.mockResolvedValue([makeMockSubscription()]);
      const request = makeRequest(
        { userId: 'user-admin', title: '알림 제목', body: '알림 내용' },
        VALID_API_KEY
      );

      // Act
      await POST(request);

      // Assert
      expect(mockSendPushNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '알림 제목',
          body: '알림 내용',
        })
      );
    });

    it('대상 userId로 pushSubscription.findMany를 호출해야 한다', async () => {
      // Arrange
      mockFindMany.mockResolvedValue([]);
      const request = makeRequest(validBody, VALID_API_KEY);

      // Act
      await POST(request);

      // Assert
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: validBody.userId,
          }),
        })
      );
    });

    it('발송에 성공하면 200을 반환해야 한다', async () => {
      // Arrange
      mockFindMany.mockResolvedValue([makeMockSubscription()]);
      const request = makeRequest(validBody, VALID_API_KEY);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ----------------------------------------------------------------
  // 발송 실패 처리
  // ----------------------------------------------------------------
  describe('발송 실패 처리', () => {
    it('sendPushNotifications가 onExpired 콜백을 지원해야 한다', async () => {
      // Arrange
      mockFindMany.mockResolvedValue([makeMockSubscription()]);
      const request = makeRequest(validBody, VALID_API_KEY);

      // Act
      await POST(request);

      // Assert
      expect(mockSendPushNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          onExpired: expect.any(Function),
        })
      );
    });

    it('onExpired 콜백이 호출되면 해당 구독을 DB에서 삭제해야 한다', async () => {
      // Arrange
      const mockDelete = prisma.pushSubscription.delete as jest.Mock;
      mockDelete.mockResolvedValue({});
      mockFindMany.mockResolvedValue([makeMockSubscription()]);
      mockSendPushNotifications.mockImplementation(async (options) => {
        if (options.onExpired) {
          await options.onExpired('https://fcm.example.com/expired');
        }
      });
      const request = makeRequest(validBody, VALID_API_KEY);

      // Act
      await POST(request);

      // Assert
      expect(mockDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            endpoint: 'https://fcm.example.com/expired',
          }),
        })
      );
    });
  });
});
