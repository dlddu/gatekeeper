/**
 * GET /api/me 라우트 핸들러 테스트
 *
 * getForwardAuthUser를 호출하여 사용자 정보를 반환하거나
 * 인증 실패 시 401을 반환하는 동작을 검증합니다.
 */

// --- Mock 설정 ---

jest.mock('@/lib/forward-auth', () => ({
  getForwardAuthUser: jest.fn(),
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/me/route';
import { getForwardAuthUser } from '@/lib/forward-auth';

const mockGetForwardAuthUser = getForwardAuthUser as jest.Mock;

function makeRequest(autheliaId?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (autheliaId !== undefined) {
    headers['Remote-User'] = autheliaId;
  }
  return new NextRequest('http://localhost/api/me', { headers });
}

function makeMockUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'user-cuid-001',
    username: 'testuser',
    email: 'test@example.com',
    autheliaId: 'uid-test-001',
    displayName: 'Test User',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('GET /api/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // 인증 없음 → 401
  // ----------------------------------------------------------------
  describe('인증 없음 (401 Unauthorized)', () => {
    it('getForwardAuthUser가 null을 반환하면 401을 반환해야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(null);
      const request = makeRequest();

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('401 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(null);
      const request = makeRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
    });

    it('인증 실패 시 getForwardAuthUser를 한 번 호출해야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(null);
      const request = makeRequest();

      // Act
      await GET(request);

      // Assert
      expect(mockGetForwardAuthUser).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------------
  // 정상 조회 → 200 + 사용자 정보
  // ----------------------------------------------------------------
  describe('정상 조회 (200 OK)', () => {
    it('인증된 사용자가 있으면 200을 반환해야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(makeMockUser());
      const request = makeRequest('uid-test-001');

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('응답 body에 id 필드가 포함되어야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(makeMockUser({ id: 'user-cuid-001' }));
      const request = makeRequest('uid-test-001');

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('id', 'user-cuid-001');
    });

    it('응답 body에 username 필드가 포함되어야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(makeMockUser({ username: 'testuser' }));
      const request = makeRequest('uid-test-001');

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('username', 'testuser');
    });

    it('응답 body에 email 필드가 포함되어야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(makeMockUser({ email: 'test@example.com' }));
      const request = makeRequest('uid-test-001');

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('email', 'test@example.com');
    });

    it('응답 body에 displayName 필드가 포함되어야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(makeMockUser({ displayName: 'Test User' }));
      const request = makeRequest('uid-test-001');

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('displayName', 'Test User');
    });

    it('getForwardAuthUser에 request 객체를 전달해야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(makeMockUser());
      const request = makeRequest('uid-test-001');

      // Act
      await GET(request);

      // Assert
      expect(mockGetForwardAuthUser).toHaveBeenCalledWith(request);
    });
  });

  // ----------------------------------------------------------------
  // email이 null인 사용자
  // ----------------------------------------------------------------
  describe('email이 null인 사용자', () => {
    it('email이 null인 사용자도 200을 반환해야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(makeMockUser({ email: null }));
      const request = makeRequest('uid-test-001');

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('email이 null이면 응답 body의 email도 null이어야 한다', async () => {
      // Arrange
      mockGetForwardAuthUser.mockResolvedValue(makeMockUser({ email: null }));
      const request = makeRequest('uid-test-001');

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert
      expect(body.email).toBeNull();
    });
  });
});
