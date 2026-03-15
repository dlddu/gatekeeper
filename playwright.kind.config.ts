import { defineConfig, devices } from '@playwright/test';

/**
 * Kind 클러스터 E2E 테스트용 Playwright 설정
 *
 * Kind 클러스터에 배포된 애플리케이션을 대상으로 테스트합니다.
 * 로컬 DB 접근 없이 API/브라우저를 통해서만 테스트합니다.
 *
 * 사용법: npx playwright test --config=playwright.kind.config.ts
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e/kind',
  testMatch: '**/*.e2e.ts',

  timeout: 30_000,

  expect: {
    timeout: 10_000,
  },

  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    baseURL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // webServer 없음 - Kind 클러스터의 포트포워딩된 서비스를 사용
});
