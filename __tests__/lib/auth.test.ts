/**
 * JWT 유틸리티 테스트 (jose 기반)
 *
 * lib/auth.ts의 signToken / verifyToken 함수를 검증합니다.
 */

import { signToken, verifyToken } from '@/lib/auth';

describe('JWT utilities (lib/auth.ts)', () => {
  const testSecret = 'test-secret-key-at-least-32-chars-long!!';

  beforeEach(() => {
    process.env.JWT_SECRET = testSecret;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ----------------------------------------------------------------
  // signToken
  // ----------------------------------------------------------------
  describe('signToken', () => {
    it('should return a string token', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'alice' };

      // Act
      const token = await signToken(payload);

      // Assert
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should return a valid JWT format (three dot-separated parts)', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'alice' };

      // Act
      const token = await signToken(payload);

      // Assert - JWT는 header.payload.signature 형식
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should embed userId in the token payload', async () => {
      // Arrange
      const payload = { userId: 'user-42', username: 'bob' };

      // Act
      const token = await signToken(payload);
      const verified = await verifyToken(token);

      // Assert
      expect(verified.userId).toBe('user-42');
    });

    it('should embed username in the token payload', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'charlie' };

      // Act
      const token = await signToken(payload);
      const verified = await verifyToken(token);

      // Assert
      expect(verified.username).toBe('charlie');
    });

    it('should include iat (issued at) claim', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'alice' };

      // Act
      const token = await signToken(payload);
      const verified = await verifyToken(token);

      // Assert
      expect(verified.iat).toBeDefined();
      expect(typeof verified.iat).toBe('number');
    });

    it('should include exp (expiration) claim', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'alice' };

      // Act
      const token = await signToken(payload);
      const verified = await verifyToken(token);

      // Assert
      expect(verified.exp).toBeDefined();
      expect(typeof verified.exp).toBe('number');
    });

    it('should set expiration to approximately 24 hours from now', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'alice' };
      const beforeSign = Math.floor(Date.now() / 1000);

      // Act
      const token = await signToken(payload);
      const verified = await verifyToken(token);

      // Assert - exp는 현재 시각 + 24시간(86400초) 근처여야 함
      const expectedExp = beforeSign + 86400;
      expect(verified.exp).toBeGreaterThanOrEqual(expectedExp - 5);
      expect(verified.exp).toBeLessThanOrEqual(expectedExp + 5);
    });

    it('should use HS256 algorithm', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'alice' };

      // Act
      const token = await signToken(payload);

      // Assert - JWT header를 base64 decode하여 alg 확인
      const headerBase64 = token.split('.')[0];
      const headerJson = Buffer.from(headerBase64, 'base64url').toString('utf-8');
      const header = JSON.parse(headerJson);
      expect(header.alg).toBe('HS256');
    });

    it('should throw an error when JWT_SECRET is not set', async () => {
      // Arrange
      delete process.env.JWT_SECRET;
      const payload = { userId: 'user-1', username: 'alice' };

      // Act & Assert
      await expect(signToken(payload)).rejects.toThrow('JWT_SECRET environment variable is not set');
    });

    it('should produce different tokens for the same payload (due to iat difference)', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'alice' };

      // Act - 짧은 간격으로 두 토큰 생성
      const token1 = await signToken(payload);
      await new Promise((resolve) => setTimeout(resolve, 1100)); // 1초 이상 대기
      const token2 = await signToken(payload);

      // Assert - iat가 다르므로 토큰이 달라야 함
      expect(token1).not.toBe(token2);
    });
  });

  // ----------------------------------------------------------------
  // verifyToken
  // ----------------------------------------------------------------
  describe('verifyToken', () => {
    it('should return the original payload for a valid token', async () => {
      // Arrange
      const payload = { userId: 'user-99', username: 'dave' };
      const token = await signToken(payload);

      // Act
      const result = await verifyToken(token);

      // Assert
      expect(result.userId).toBe('user-99');
      expect(result.username).toBe('dave');
    });

    it('should throw for an invalid token string', async () => {
      // Arrange
      const invalidToken = 'not.a.valid.jwt.token';

      // Act & Assert
      await expect(verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should throw for a token signed with a different secret', async () => {
      // Arrange
      process.env.JWT_SECRET = 'original-secret-key-32-chars-long!!';
      const token = await signToken({ userId: 'user-1', username: 'alice' });

      // 다른 시크릿으로 검증 시도
      process.env.JWT_SECRET = 'different-secret-key-32chars-long!!';

      // Act & Assert
      await expect(verifyToken(token)).rejects.toThrow();
    });

    it('should throw for a malformed token', async () => {
      // Arrange
      const malformedToken = 'eyJhbGciOiJIUzI1NiJ9.invalid-payload.bad-sig';

      // Act & Assert
      await expect(verifyToken(malformedToken)).rejects.toThrow();
    });

    it('should throw for an empty string token', async () => {
      // Act & Assert
      await expect(verifyToken('')).rejects.toThrow();
    });

    it('should throw when JWT_SECRET is not set during verification', async () => {
      // Arrange
      const token = await signToken({ userId: 'user-1', username: 'alice' });
      delete process.env.JWT_SECRET;

      // Act & Assert
      await expect(verifyToken(token)).rejects.toThrow('JWT_SECRET environment variable is not set');
    });

    it('should throw for an expired token', async () => {
      // Arrange - jose를 직접 사용해 이미 만료된 토큰 생성
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(testSecret);
      const expiredToken = await new SignJWT({ userId: 'user-1', username: 'alice' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2시간 전 발행
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // 1시간 전 만료
        .sign(secret);

      // Act & Assert
      await expect(verifyToken(expiredToken)).rejects.toThrow();
    });

    it('should return a payload with expected shape', async () => {
      // Arrange
      const payload = { userId: 'user-1', username: 'alice' };
      const token = await signToken(payload);

      // Act
      const result = await verifyToken(token);

      // Assert - 반환된 payload는 userId, username, iat, exp를 포함해야 함
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('iat');
      expect(result).toHaveProperty('exp');
    });
  });
});
