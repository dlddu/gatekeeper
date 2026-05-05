/**
 * playwright.config.ts 설정 검증 테스트
 *
 * DLD-828: Forward Auth 방식으로 전환 후 playwright.config.ts 정리
 *
 * 검증 범위:
 * - webServer.env에서 OIDC 관련 환경변수가 제거되었는지 여부
 * - webServer.env에서 JWT_SECRET이 제거되었는지 여부
 * - globalSetup, globalTeardown 경로가 올바르게 설정되어 있는지 여부
 *
 * 참고:
 * - playwright.config.ts를 직접 import하여 설정값을 검증합니다
 * - @playwright/test의 defineConfig는 설정 객체를 그대로 반환하므로 안전하게 import 가능합니다
 */

// ----------------------------------------------------------------
// unused imports removed — path is not needed in this test file
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// @playwright/test mock
// Jest 환경에서 playwright 모듈을 import할 수 없으므로 mock 처리합니다.
// defineConfig는 설정 객체를 그대로 반환하는 pass-through 함수입니다.
// ----------------------------------------------------------------
jest.mock('@playwright/test', () => ({
  defineConfig: jest.fn((config: unknown) => config),
  devices: new Proxy({}, {
    get: () => ({}),
  }),
}));

// ----------------------------------------------------------------
// playwright.config.ts를 직접 import하여 설정값 검증
// defineConfig는 설정 객체를 그대로 반환합니다
// ----------------------------------------------------------------
import playwrightConfig from '../../playwright.config';

// ----------------------------------------------------------------
// 테스트 스위트
// ----------------------------------------------------------------

describe('playwright.config.ts', () => {
  // ----------------------------------------------------------------
  // Forward Auth 환경변수 설정
  // ----------------------------------------------------------------
  describe('webServer.env — Forward Auth 설정', () => {
    it('webServer.env가 정의되어 있어야 한다', () => {
      // Assert
      expect(playwrightConfig.webServer).toBeDefined();
      expect((playwrightConfig.webServer as { env?: Record<string, string> }).env).toBeDefined();
    });

    it('OIDC_ISSUER가 webServer.env에 없어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Assert
      expect(env).not.toHaveProperty('OIDC_ISSUER');
    });

    it('OIDC_CLIENT_ID가 webServer.env에 없어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Assert
      expect(env).not.toHaveProperty('OIDC_CLIENT_ID');
    });

    it('OIDC_CLIENT_SECRET가 webServer.env에 없어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Assert
      expect(env).not.toHaveProperty('OIDC_CLIENT_SECRET');
    });

    it('OIDC_REDIRECT_URI가 webServer.env에 없어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Assert
      expect(env).not.toHaveProperty('OIDC_REDIRECT_URI');
    });

    it('JWT_SECRET이 webServer.env에 없어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Assert
      expect(env).not.toHaveProperty('JWT_SECRET');
    });

  });

  // ----------------------------------------------------------------
  // globalSetup / globalTeardown 경로
  // ----------------------------------------------------------------
  describe('globalSetup / globalTeardown 경로', () => {
    it('globalSetup 경로가 설정되어 있어야 한다', () => {
      // Assert
      expect(playwrightConfig.globalSetup).toBeDefined();
    });

    it('globalTeardown 경로가 설정되어 있어야 한다', () => {
      // Assert
      expect(playwrightConfig.globalTeardown).toBeDefined();
    });

    it('globalSetup 경로가 global-setup 파일을 가리켜야 한다', () => {
      // Assert
      expect(playwrightConfig.globalSetup).toContain('global-setup');
    });

    it('globalTeardown 경로가 global-teardown 파일을 가리켜야 한다', () => {
      // Assert
      expect(playwrightConfig.globalTeardown).toContain('global-teardown');
    });
  });

  // ----------------------------------------------------------------
  // testDir 설정
  // ----------------------------------------------------------------
  describe('testDir 설정', () => {
    it('testDir이 e2e 디렉토리를 가리켜야 한다', () => {
      // Assert
      expect(playwrightConfig.testDir).toBeDefined();
      expect(playwrightConfig.testDir).toContain('e2e');
    });
  });
});
