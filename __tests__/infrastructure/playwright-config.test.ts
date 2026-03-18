/**
 * playwright.config.ts 설정 검증 테스트
 *
 * DLD-795: e2e global-setup에 OIDC Mock 서버 통합
 *
 * 검증 범위:
 * - webServer.env.OIDC_ISSUER가 mock 서버 URL(http://localhost:9999)을 가리키는지 여부
 * - webServer.env.OIDC_CLIENT_ID, OIDC_CLIENT_SECRET이 설정되어 있는지 여부
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
  // OIDC 환경변수 설정
  // ----------------------------------------------------------------
  describe('webServer.env — OIDC 설정', () => {
    it('webServer.env가 정의되어 있어야 한다', () => {
      // Assert
      expect(playwrightConfig.webServer).toBeDefined();
      expect((playwrightConfig.webServer as { env?: Record<string, string> }).env).toBeDefined();
    });

    it('OIDC_ISSUER가 http://localhost:9999로 설정되어 있어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Assert
      expect(env.OIDC_ISSUER).toBe('http://localhost:9999');
    });

    it('OIDC_CLIENT_ID가 설정되어 있어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Assert
      expect(env.OIDC_CLIENT_ID).toBeDefined();
      expect(typeof env.OIDC_CLIENT_ID).toBe('string');
      expect(env.OIDC_CLIENT_ID.length).toBeGreaterThan(0);
    });

    it('OIDC_CLIENT_SECRET이 설정되어 있어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Assert
      expect(env.OIDC_CLIENT_SECRET).toBeDefined();
      expect(typeof env.OIDC_CLIENT_SECRET).toBe('string');
      expect(env.OIDC_CLIENT_SECRET.length).toBeGreaterThan(0);
    });

    it('OIDC_ISSUER URL이 유효한 localhost URL 형식이어야 한다', () => {
      // Arrange
      const env = (playwrightConfig.webServer as { env: Record<string, string> }).env;

      // Act — URL 파싱으로 유효성 확인
      const issuerUrl = new URL(env.OIDC_ISSUER);

      // Assert
      expect(issuerUrl.hostname).toBe('localhost');
      expect(issuerUrl.port).toBe('9999');
      expect(issuerUrl.protocol).toBe('http:');
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
