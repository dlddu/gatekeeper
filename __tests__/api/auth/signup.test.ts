/**
 * POST /api/auth/signup 라우트 핸들러 테스트
 *
 * app/api/auth/signup/route.ts의 동작을 검증합니다.
 * 실제 DB 연결 없이 prisma, bcryptjs를 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// bcryptjs mock
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

// lib/auth mock
jest.mock('@/lib/auth', () => ({
  signToken: jest.fn(),
  verifyToken: jest.fn(),
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/signup/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

// 타입 캐스팅 헬퍼
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockSignToken = signToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * JSON body를 포함한 NextRequest를 생성합니다.
 */
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- 테스트 스위트 ---

describe('POST /api/auth/signup', () => {
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
    it('모든 필드가 없으면 400을 반환해야 한다', async () => {
      const request = makeRequest({});
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('username이 없으면 400을 반환해야 한다', async () => {
      const request = makeRequest({ password: 'secret', displayName: 'Alice' });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('password가 없으면 400을 반환해야 한다', async () => {
      const request = makeRequest({ username: 'alice', displayName: 'Alice' });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('displayName이 없으면 400을 반환해야 한다', async () => {
      const request = makeRequest({ username: 'alice', password: 'secret' });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('username이 빈 문자열이면 400을 반환해야 한다', async () => {
      const request = makeRequest({ username: '', password: 'secret', displayName: 'Alice' });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('password가 빈 문자열이면 400을 반환해야 한다', async () => {
      const request = makeRequest({ username: 'alice', password: '', displayName: 'Alice' });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('displayName이 빈 문자열이면 400을 반환해야 한다', async () => {
      const request = makeRequest({ username: 'alice', password: 'secret', displayName: '' });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('400 응답 body에 error 필드가 포함되어야 한다', async () => {
      const request = makeRequest({});
      const response = await POST(request);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });
  });

  // ----------------------------------------------------------------
  // 중복 username → 409
  // ----------------------------------------------------------------
  describe('중복 username (409 Conflict)', () => {
    it('이미 존재하는 username이면 409를 반환해야 한다', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'existing-user',
        username: 'alice',
        passwordHash: '$2b$10$hash',
        displayName: 'Alice',
      });
      const request = makeRequest({ username: 'alice', password: 'secret', displayName: 'Alice' });
      const response = await POST(request);
      expect(response.status).toBe(409);
    });

    it('409 응답 body에 error 필드가 포함되어야 한다', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'existing-user',
        username: 'alice',
        passwordHash: '$2b$10$hash',
        displayName: 'Alice',
      });
      const request = makeRequest({ username: 'alice', password: 'secret', displayName: 'Alice' });
      const response = await POST(request);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });
  });

  // ----------------------------------------------------------------
  // 정상 회원가입 → 201
  // ----------------------------------------------------------------
  describe('정상 회원가입 (201 Created)', () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
    const createdUser = {
      id: 'new-user-1',
      username: 'bob',
      passwordHash: '$2b$10$newhash',
      displayName: 'Bob',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockFindUnique.mockResolvedValue(null);
      mockBcryptHash.mockResolvedValue('$2b$10$newhash');
      mockCreate.mockResolvedValue(createdUser);
      mockSignToken.mockResolvedValue(fakeToken);
    });

    it('올바른 데이터로 201을 반환해야 한다', async () => {
      const request = makeRequest({ username: 'bob', password: 'secret123', displayName: 'Bob' });
      const response = await POST(request);
      expect(response.status).toBe(201);
    });

    it('응답 body에 token이 포함되어야 한다', async () => {
      const request = makeRequest({ username: 'bob', password: 'secret123', displayName: 'Bob' });
      const response = await POST(request);
      const body = await response.json();
      expect(body).toHaveProperty('token');
      expect(body.token).toBe(fakeToken);
    });

    it('응답 body에 userId가 포함되어야 한다', async () => {
      const request = makeRequest({ username: 'bob', password: 'secret123', displayName: 'Bob' });
      const response = await POST(request);
      const body = await response.json();
      expect(body).toHaveProperty('userId');
      expect(body.userId).toBe('new-user-1');
    });

    it('응답 body에 username이 포함되어야 한다', async () => {
      const request = makeRequest({ username: 'bob', password: 'secret123', displayName: 'Bob' });
      const response = await POST(request);
      const body = await response.json();
      expect(body).toHaveProperty('username');
      expect(body.username).toBe('bob');
    });

    it('bcrypt.hash를 호출하여 비밀번호를 해싱해야 한다', async () => {
      const request = makeRequest({ username: 'bob', password: 'secret123', displayName: 'Bob' });
      await POST(request);
      expect(mockBcryptHash).toHaveBeenCalledWith('secret123', 10);
    });

    it('prisma.user.create를 올바른 데이터로 호출해야 한다', async () => {
      const request = makeRequest({ username: 'bob', password: 'secret123', displayName: 'Bob' });
      await POST(request);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          username: 'bob',
          passwordHash: '$2b$10$newhash',
          displayName: 'Bob',
        },
      });
    });

    it('signToken을 userId와 username payload로 호출해야 한다', async () => {
      const request = makeRequest({ username: 'bob', password: 'secret123', displayName: 'Bob' });
      await POST(request);
      expect(mockSignToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'new-user-1',
          username: 'bob',
        })
      );
    });
  });
});
