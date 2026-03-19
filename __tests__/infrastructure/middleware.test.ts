/**
 * middleware.ts 검증 테스트
 *
 * publicPaths 설정과 미들웨어 파일의 구조적 요구사항을 검증합니다.
 * Forward Auth 기반으로 변경된 미들웨어를 정적 분석합니다.
 * (JWT 검증 로직이 제거되고 Authentik Forward Auth 헤더 기반 인증으로 대체)
 */

import fs from 'fs';
import path from 'path';

const MIDDLEWARE_PATH = path.join(process.cwd(), 'middleware.ts');

describe('middleware.ts', () => {
  let middlewareContent: string;

  beforeAll(() => {
    middlewareContent = fs.readFileSync(MIDDLEWARE_PATH, 'utf-8');
  });

  it('should exist', () => {
    expect(fs.existsSync(MIDDLEWARE_PATH)).toBe(true);
  });

  it('should not be empty', () => {
    expect(middlewareContent.trim().length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // publicPaths 내용 검증
  // ----------------------------------------------------------------
  describe('publicPaths', () => {
    it('should NOT import from lib/auth (deleted in Forward Auth migration)', () => {
      expect(middlewareContent).not.toMatch(/from ['"]@\/lib\/auth['"]/);
      expect(middlewareContent).not.toMatch(/from ['"]\.\.\/lib\/auth['"]/);
    });

    it('should NOT contain /api/auth/login in publicPaths (auth routes deleted)', () => {
      // Forward Auth 환경에서는 Authentik이 인증을 담당하므로
      // /api/auth/login 라우트 자체가 삭제되어 publicPaths에서도 제거된다
      expect(middlewareContent).not.toContain('/api/auth/login');
    });

    it('should NOT contain /api/auth/oidc/authorize in publicPaths (OIDC routes deleted)', () => {
      expect(middlewareContent).not.toContain('/api/auth/oidc/authorize');
    });

    it('should NOT contain /api/auth/oidc/callback in publicPaths (OIDC routes deleted)', () => {
      expect(middlewareContent).not.toContain('/api/auth/oidc/callback');
    });

    it('should NOT contain /login in publicPaths (login page deleted)', () => {
      // Forward Auth 환경에서는 Authentik이 로그인 페이지를 제공하므로
      // /login 경로가 삭제된다
      expect(middlewareContent).not.toContain('/login');
    });

    it('should include /api/health in publicPaths', () => {
      expect(middlewareContent).toContain('/api/health');
    });
  });

  // ----------------------------------------------------------------
  // Forward Auth 구조 검증
  // ----------------------------------------------------------------
  describe('Forward Auth structure', () => {
    it('should NOT use verifyToken (JWT auth removed)', () => {
      expect(middlewareContent).not.toContain('verifyToken');
    });

    it('should NOT reference JWT_SECRET (JWT auth removed)', () => {
      expect(middlewareContent).not.toContain('JWT_SECRET');
    });
  });

  // ----------------------------------------------------------------
  // 미들웨어 구조 검증
  // ----------------------------------------------------------------
  describe('middleware structure', () => {
    it('should export middleware function', () => {
      expect(middlewareContent).toMatch(/export async function middleware/);
    });

    it('should export config with matcher', () => {
      expect(middlewareContent).toContain('export const config');
      expect(middlewareContent).toContain('matcher');
    });
  });
});
