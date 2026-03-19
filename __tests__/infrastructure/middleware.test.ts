/**
 * middleware.ts 검증 테스트
 *
 * publicPaths 설정과 미들웨어 파일의 구조적 요구사항을 검증합니다.
 * 실제 미들웨어 동작(JWT 검증 등)은 별도 mock 없이 파일 소스를 직접 읽어 정적 분석합니다.
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
    it('should include /api/auth/login in publicPaths', () => {
      expect(middlewareContent).toContain('/api/auth/login');
    });

    it('should NOT include /api/auth/signup in publicPaths', () => {
      // signup 엔드포인트 제거에 따라 publicPaths에서도 제거되어야 한다
      expect(middlewareContent).not.toContain('/api/auth/signup');
    });

    it('should include /api/auth/oidc/authorize in publicPaths', () => {
      expect(middlewareContent).toContain('/api/auth/oidc/authorize');
    });

    it('should include /api/auth/oidc/callback in publicPaths', () => {
      expect(middlewareContent).toContain('/api/auth/oidc/callback');
    });

    it('should include /api/health in publicPaths', () => {
      expect(middlewareContent).toContain('/api/health');
    });

    it('should include /login in publicPaths', () => {
      expect(middlewareContent).toContain('/login');
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
