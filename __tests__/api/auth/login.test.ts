/**
 * POST /api/auth/login 라우트 핸들러 테스트
 *
 * app/api/auth/login/route.ts의 동작을 검증합니다.
 * 실제 DB 연결 없이 prisma, bcryptjs를 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// bcryptjs mock
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

// lib/auth mock — signToken만 mock하고 실제 구현은 대체
jest.mock('@/lib/auth', () => ({
  signToken: jest.fn(),
  verifyToken: jest.fn(),
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/login/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

// 타입 캐스팅 헬퍼
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockSignToken = signToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * JSON body를 포함한 NextRequest를 생성합니다.
 */
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- 테스트 스위트 ---

describe('POST /api/auth/login', () => {
  const testSecret = 'test-secret-key-at-least-32-chars-long!!';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = testSecret;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ----------------------------------------------------------------
  // 필수 필드 누락 → 400
  // ----------------------------------------------------------------
  describe('필수 필드 누락 (400 Bad Request)', () => {
    it('username과 password가 모두 없으면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({});

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('username이 없으면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ password: 'secret' });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('password가 없으면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ username: 'alice' });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('username이 빈 문자열이면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ username: '', password: 'secret' });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('password가 빈 문자열이면 400을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ username: 'alice', password: '' });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('400 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest({});

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
    });
  });

  // ----------------------------------------------------------------
  // 존재하지 않는 사용자 → 401
  // ----------------------------------------------------------------
  describe('존재하지 않는 사용자 (401 Unauthorized)', () => {
    it('DB에 사용자가 없으면 401을 반환해야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(null);
      const request = makeRequest({ username: 'nonexistent', password: 'secret' });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('401 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(null);
      const request = makeRequest({ username: 'nonexistent', password: 'secret' });

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('username으로 DB 조회를 시도해야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(null);
      const request = makeRequest({ username: 'alice', password: 'secret' });

      // Act
      await POST(request);

      // Assert
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ username: 'alice' }),
        })
      );
    });
  });

  // ----------------------------------------------------------------
  // 잘못된 비밀번호 → 401
  // ----------------------------------------------------------------
  describe('잘못된 비밀번호 (401 Unauthorized)', () => {
    const existingUser = {
      id: 'user-1',
      username: 'alice',
      passwordHash: '$2b$10$hashedpassword',
      displayName: 'Alice',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('비밀번호가 틀리면 401을 반환해야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(false);
      const request = makeRequest({ username: 'alice', password: 'wrongpassword' });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('비밀번호 불일치 시 401 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(false);
      const request = makeRequest({ username: 'alice', password: 'wrongpassword' });

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('bcrypt.compare를 사용자의 passwordHash와 함께 호출해야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(false);
      const request = makeRequest({ username: 'alice', password: 'mypassword' });

      // Act
      await POST(request);

      // Assert
      expect(mockBcryptCompare).toHaveBeenCalledWith('mypassword', existingUser.passwordHash);
    });
  });

  // ----------------------------------------------------------------
  // 정상 자격증명 → 200 + JWT 반환
  // ----------------------------------------------------------------
  describe('정상 자격증명 (200 OK)', () => {
    const existingUser = {
      id: 'user-42',
      username: 'alice',
      passwordHash: '$2b$10$hashedpassword',
      displayName: 'Alice',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';

    it('올바른 자격증명으로 200을 반환해야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockSignToken.mockResolvedValue(fakeToken);
      const request = makeRequest({ username: 'alice', password: 'correctpassword' });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('응답 body에 token이 포함되어야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockSignToken.mockResolvedValue(fakeToken);
      const request = makeRequest({ username: 'alice', password: 'correctpassword' });

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('token');
      expect(body.token).toBe(fakeToken);
    });

    it('응답 body에 userId가 포함되어야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockSignToken.mockResolvedValue(fakeToken);
      const request = makeRequest({ username: 'alice', password: 'correctpassword' });

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('userId');
      expect(body.userId).toBe('user-42');
    });

    it('응답 body에 username이 포함되어야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockSignToken.mockResolvedValue(fakeToken);
      const request = makeRequest({ username: 'alice', password: 'correctpassword' });

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('username');
      expect(body.username).toBe('alice');
    });

    it('signToken을 userId와 username payload로 호출해야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockSignToken.mockResolvedValue(fakeToken);
      const request = makeRequest({ username: 'alice', password: 'correctpassword' });

      // Act
      await POST(request);

      // Assert
      expect(mockSignToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-42',
          username: 'alice',
        })
      );
    });

    it('응답 body의 userId는 문자열이어야 한다', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(existingUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockSignToken.mockResolvedValue(fakeToken);
      const request = makeRequest({ username: 'alice', password: 'correctpassword' });

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(typeof body.userId).toBe('string');
    });
  });
});
