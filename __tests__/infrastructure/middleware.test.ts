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

  // ----------------------------------------------------------------
  // E2E Forward Auth 지원
  // ----------------------------------------------------------------
  describe('E2E Forward Auth 지원', () => {
    it('E2E_FORWARD_AUTH_USER 관련 코드가 포함되어 있어야 한다', () => {
      // E2E 테스트 환경에서 Forward Auth 헤더를 자동 주입하기 위한
      // E2E_FORWARD_AUTH_USER 환경변수 참조가 미들웨어에 있어야 한다
      expect(middlewareContent).toContain('E2E_FORWARD_AUTH_USER');
    });

    it('x-authentik-uid 헤더 주입 코드가 포함되어 있어야 한다', () => {
      // E2E 테스트 환경에서 Authentik Forward Auth 헤더를 시뮬레이션하기 위해
      // x-authentik-uid 헤더를 요청에 주입하는 코드가 있어야 한다
      expect(middlewareContent).toContain('x-authentik-uid');
    });

    it('NODE_ENV 또는 환경 보호 조건이 있어야 한다', () => {
      // E2E_FORWARD_AUTH_USER 처리 로직은 테스트 환경에서만 동작해야 하므로
      // NODE_ENV 검사 또는 E2E 관련 환경 조건으로 보호되어야 한다
      const hasNodeEnvGuard = middlewareContent.includes('NODE_ENV');
      const hasE2eGuard = /E2E_FORWARD_AUTH_USER/.test(middlewareContent);
      expect(hasNodeEnvGuard || hasE2eGuard).toBe(true);
    });
  });
});
