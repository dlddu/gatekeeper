/**
 * POST /api/requests 라우트 핸들러 테스트
 *
 * app/api/requests/route.ts의 POST 핸들러 동작을 검증합니다.
 * x-api-key 헤더를 통한 API Key 인증 (환경변수 API_SECRET_KEY 비교)을 검증합니다.
 * 실제 DB 연결 없이 prisma를 mock 처리합니다.
 *
 * 관련 이슈: DLD-651
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
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/requests/route';
import { prisma } from '@/lib/prisma';

// 타입 캐스팅 헬퍼
const mockRequestCreate = prisma.request.create as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * JSON body와 x-api-key 헤더를 포함한 NextRequest를 생성합니다.
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
  return new NextRequest('http://localhost/api/requests', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// 기본 mock Request 레코드
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

describe('POST /api/requests', () => {
  const VALID_API_KEY = 'test-api-secret-key';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_SECRET_KEY = VALID_API_KEY;
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long!!';
  });

  afterEach(() => {
    delete process.env.API_SECRET_KEY;
    delete process.env.JWT_SECRET;
  });

  // ----------------------------------------------------------------
  // API Key 인증 실패 → 401
  // ----------------------------------------------------------------
  describe('API Key 인증 실패 (401 Unauthorized)', () => {
    it('x-api-key 헤더가 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({
        externalId: 'ext-001',
        context: '승인 요청',
        requesterName: 'Bot',
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('잘못된 API Key로 요청하면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: 'ext-001', context: '승인 요청', requesterName: 'Bot' },
        'invalid-api-key'
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('빈 문자열 API Key로 요청하면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: 'ext-001', context: '승인 요청', requesterName: 'Bot' },
        ''
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('API Key 인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: 'ext-001', context: '승인 요청', requesterName: 'Bot' },
        'wrong-key'
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('API Key 인증 실패 시 request.create를 호출하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: 'ext-001', context: '승인 요청', requesterName: 'Bot' },
        'wrong-key'
      );

      // Act
      await POST(request);

      // Assert
      expect(mockRequestCreate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 필수 필드 누락 → 400
  // ----------------------------------------------------------------
  describe('필수 필드 누락 (400 Bad Request)', () => {
    it('externalId가 없으면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { context: '승인 요청', requesterName: 'Bot' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('context가 없으면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: 'ext-001', requesterName: 'Bot' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('requesterName이 없으면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: 'ext-001', context: '승인 요청' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('externalId가 빈 문자열이면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: '', context: '승인 요청', requesterName: 'Bot' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('context가 빈 문자열이면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: 'ext-001', context: '', requesterName: 'Bot' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('requesterName이 빈 문자열이면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { externalId: 'ext-001', context: '승인 요청', requesterName: '' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('모든 필드가 없으면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({}, VALID_API_KEY);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('400 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest(
        { context: '승인 요청', requesterName: 'Bot' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
    });
  });

  // ----------------------------------------------------------------
  // externalId 중복 → 409
  // ----------------------------------------------------------------
  describe('externalId 중복 (409 Conflict)', () => {
    it('이미 존재하는 externalId로 생성 시도하면 409를 반환해야 한다', async () => {
      // Arrange — Prisma unique constraint 위반 에러 시뮬레이션
      const prismaError = Object.assign(new Error('Unique constraint failed on the fields: (`externalId`)'), {
        code: 'P2002',
      });
      mockRequestCreate.mockRejectedValue(prismaError);

      const request = makeRequest(
        { externalId: 'duplicate-ext-id', context: '두 번째 승인 요청', requesterName: 'Bot' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(409);
    });

    it('409 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const prismaError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      mockRequestCreate.mockRejectedValue(prismaError);

      const request = makeRequest(
        { externalId: 'dup-ext-id', context: '승인 요청', requesterName: 'Bot' },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });
  });

  // ----------------------------------------------------------------
  // 정상 생성 (happy path) → 201
  // ----------------------------------------------------------------
  describe('정상 생성 (201 Created)', () => {
    it('필수 필드로 생성하면 201을 반환해야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest();
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-001',
          context: '배포 승인 요청입니다.',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(201);
    });

    it('201 응답 body에 생성된 Request의 id가 포함되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ id: 'clq1234567890' });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-001',
          context: '배포 승인 요청입니다.',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('id');
      expect(body.id).toBe('clq1234567890');
    });

    it('응답 body의 externalId가 요청값과 일치해야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ externalId: 'my-external-id' });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'my-external-id',
          context: '배포 승인 요청입니다.',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body.externalId).toBe('my-external-id');
    });

    it('응답 body의 status가 PENDING이어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ status: 'PENDING' });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-001',
          context: '배포 승인 요청입니다.',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body.status).toBe('PENDING');
    });

    it('응답 body에 context가 포함되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ context: '배포 승인 요청입니다.' });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-001',
          context: '배포 승인 요청입니다.',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body.context).toBe('배포 승인 요청입니다.');
    });

    it('응답 body에 requesterName이 포함되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ requesterName: 'CI Bot' });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-001',
          context: '배포 승인 요청입니다.',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body.requesterName).toBe('CI Bot');
    });

    it('timeoutSeconds가 있으면 해당 값이 저장되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ timeoutSeconds: 600 });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-timeout',
          context: '타임아웃이 있는 승인 요청',
          requesterName: 'CI Bot',
          timeoutSeconds: 600,
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body.timeoutSeconds).toBe(600);
    });

    it('timeoutSeconds가 없으면 null로 저장되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ timeoutSeconds: null });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-no-timeout',
          context: '타임아웃이 없는 승인 요청',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body.timeoutSeconds).toBeNull();
    });

    it('timeoutSeconds를 포함해서 prisma.request.create를 호출해야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ timeoutSeconds: 300 });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-timeout-300',
          context: '맥락 정보',
          requesterName: 'Bot',
          timeoutSeconds: 300,
        },
        VALID_API_KEY
      );

      // Act
      await POST(request);

      // Assert
      expect(mockRequestCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timeoutSeconds: 300,
          }),
        })
      );
    });

    it('timeoutSeconds가 있으면 expiresAt를 계산하여 저장해야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ timeoutSeconds: 600, expiresAt: new Date('2024-01-01T00:10:00.000Z') });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-expires',
          context: '만료 시간이 있는 요청',
          requesterName: 'CI Bot',
          timeoutSeconds: 600,
        },
        VALID_API_KEY
      );

      // Act
      await POST(request);

      // Assert
      expect(mockRequestCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timeoutSeconds: 600,
            expiresAt: expect.any(Date),
          }),
        })
      );
    });

    it('timeoutSeconds가 없으면 expiresAt가 null로 저장되어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ timeoutSeconds: null, expiresAt: null });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-no-expires',
          context: '만료 시간이 없는 요청',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      await POST(request);

      // Assert
      expect(mockRequestCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timeoutSeconds: null,
            expiresAt: null,
          }),
        })
      );
    });

    it('응답 body에 expiresAt가 포함되어야 한다', async () => {
      // Arrange
      const expiresAtDate = new Date('2024-01-01T00:10:00.000Z');
      const mockRecord = makeMockRequest({ timeoutSeconds: 600, expiresAt: expiresAtDate });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-expires-resp',
          context: '만료 시간 응답 확인',
          requesterName: 'CI Bot',
          timeoutSeconds: 600,
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('expiresAt');
      expect(body.expiresAt).toBe(expiresAtDate.toISOString());
    });

    it('timeoutSeconds가 없으면 응답의 expiresAt가 null이어야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest({ timeoutSeconds: null, expiresAt: null });
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-no-expires-resp',
          context: '만료 시간 없음 응답 확인',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body.expiresAt).toBeNull();
    });

    it('필수 필드로 prisma.request.create를 호출해야 한다', async () => {
      // Arrange
      const mockRecord = makeMockRequest();
      mockRequestCreate.mockResolvedValue(mockRecord);

      const request = makeRequest(
        {
          externalId: 'ext-001',
          context: '배포 승인 요청입니다.',
          requesterName: 'CI Bot',
        },
        VALID_API_KEY
      );

      // Act
      await POST(request);

      // Assert
      expect(mockRequestCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalId: 'ext-001',
            context: '배포 승인 요청입니다.',
            requesterName: 'CI Bot',
          }),
        })
      );
    });
  });
});
