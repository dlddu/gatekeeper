/**
 * lib/forward-auth.ts — getForwardAuthUser 함수 unit 테스트
 *
 * Forward Auth 헤더 기반으로 사용자를 조회하거나 auto-provision하는
 * getForwardAuthUser 함수의 동작을 검증합니다.
 * Prisma client는 mock하여 실제 DB 접근 없이 테스트합니다.
 */

// --- Mock 설정 ---

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { getForwardAuthUser } from '@/lib/forward-auth';
import { prisma } from '@/lib/prisma';

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/me', { headers });
}

function makeMockUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'user-cuid-001',
    username: 'testuser',
    email: 'test@example.com',
    authentikUid: 'uid-test-001',
    displayName: 'Test User',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const validHeaders = {
  'x-authentik-uid': 'uid-test-001',
  'x-authentik-username': 'testuser',
  'x-authentik-email': 'test@example.com',
  'x-authentik-name': 'Test User',
};

describe('getForwardAuthUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // X-authentik-uid 헤더 없음 → null 반환
  // ----------------------------------------------------------------
  describe('X-authentik-uid 헤더 없음 (null 반환)', () => {
    it('x-authentik-uid 헤더가 없으면 null을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({});

      // Act
      const result = await getForwardAuthUser(request);

      // Assert
      expect(result).toBeNull();
    });

    it('x-authentik-uid가 없으면 DB를 조회하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest({});

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('다른 authentik 헤더가 있어도 uid 헤더 없으면 null을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({
        'x-authentik-username': 'testuser',
        'x-authentik-email': 'test@example.com',
        'x-authentik-name': 'Test User',
      });

      // Act
      const result = await getForwardAuthUser(request);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // 기존 사용자 조회 → email/displayName 업데이트 후 반환
  // ----------------------------------------------------------------
  describe('기존 사용자 업데이트 (email/displayName)', () => {
    it('DB에 사용자가 있으면 해당 사용자를 반환해야 한다', async () => {
      // Arrange
      const existingUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(existingUser);
      mockUserUpdate.mockResolvedValue(existingUser);
      const request = makeRequest(validHeaders);

      // Act
      const result = await getForwardAuthUser(request);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.authentikUid).toBe('uid-test-001');
    });

    it('기존 사용자가 있으면 email을 업데이트해야 한다', async () => {
      // Arrange
      const existingUser = makeMockUser({ email: 'old@example.com' });
      const updatedUser = makeMockUser({ email: 'test@example.com' });
      mockUserFindUnique.mockResolvedValue(existingUser);
      mockUserUpdate.mockResolvedValue(updatedUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
    });

    it('기존 사용자가 있으면 displayName을 업데이트해야 한다', async () => {
      // Arrange
      const existingUser = makeMockUser({ displayName: 'Old Name' });
      const updatedUser = makeMockUser({ displayName: 'Test User' });
      mockUserFindUnique.mockResolvedValue(existingUser);
      mockUserUpdate.mockResolvedValue(updatedUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: 'Test User',
          }),
        })
      );
    });

    it('업데이트는 authentikUid를 기준으로 해야 한다', async () => {
      // Arrange
      const existingUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(existingUser);
      mockUserUpdate.mockResolvedValue(existingUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authentikUid: 'uid-test-001',
          }),
        })
      );
    });

    it('업데이트된 사용자를 반환해야 한다', async () => {
      // Arrange
      const existingUser = makeMockUser({ email: 'old@example.com' });
      const updatedUser = makeMockUser({ email: 'test@example.com' });
      mockUserFindUnique.mockResolvedValue(existingUser);
      mockUserUpdate.mockResolvedValue(updatedUser);
      const request = makeRequest(validHeaders);

      // Act
      const result = await getForwardAuthUser(request);

      // Assert
      expect(result?.email).toBe('test@example.com');
    });

    it('기존 사용자가 있으면 create를 호출하지 않아야 한다', async () => {
      // Arrange
      const existingUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(existingUser);
      mockUserUpdate.mockResolvedValue(existingUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserCreate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 새 사용자 auto-provisioning
  // ----------------------------------------------------------------
  describe('새 사용자 auto-provisioning', () => {
    it('DB에 사용자가 없으면 새 사용자를 생성해야 한다', async () => {
      // Arrange
      const newUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserCreate).toHaveBeenCalledTimes(1);
    });

    it('새 사용자 생성 시 authentikUid를 포함해야 한다', async () => {
      // Arrange
      const newUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authentikUid: 'uid-test-001',
          }),
        })
      );
    });

    it('새 사용자 생성 시 username을 포함해야 한다', async () => {
      // Arrange
      const newUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'testuser',
          }),
        })
      );
    });

    it('새 사용자 생성 시 email을 포함해야 한다', async () => {
      // Arrange
      const newUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
    });

    it('새 사용자 생성 시 displayName을 포함해야 한다', async () => {
      // Arrange
      const newUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: 'Test User',
          }),
        })
      );
    });

    it('새로 생성된 사용자를 반환해야 한다', async () => {
      // Arrange
      const newUser = makeMockUser({ id: 'new-user-cuid' });
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);
      const request = makeRequest(validHeaders);

      // Act
      const result = await getForwardAuthUser(request);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe('new-user-cuid');
    });

    it('새 사용자 생성 시 update를 호출하지 않아야 한다', async () => {
      // Arrange
      const newUser = makeMockUser();
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 헤더 추출 검증
  // ----------------------------------------------------------------
  describe('헤더 추출', () => {
    it('x-authentik-uid 헤더로 DB를 조회해야 한다', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(makeMockUser());
      const request = makeRequest(validHeaders);

      // Act
      await getForwardAuthUser(request);

      // Assert
      expect(mockUserFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authentikUid: 'uid-test-001',
          }),
        })
      );
    });

    it('email 헤더가 없어도 null 처리하여 사용자를 생성해야 한다', async () => {
      // Arrange
      const headersWithoutEmail = {
        'x-authentik-uid': 'uid-test-001',
        'x-authentik-username': 'testuser',
        'x-authentik-name': 'Test User',
      };
      const newUser = makeMockUser({ email: null });
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);
      const request = makeRequest(headersWithoutEmail);

      // Act
      const result = await getForwardAuthUser(request);

      // Assert
      expect(result).not.toBeNull();
      expect(mockUserCreate).toHaveBeenCalledTimes(1);
    });
  });
});
