import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E 테스트 설정
 *
 * DLD-647: e2e 테스트 환경 구성
 *
 * 테스트 실행: npx playwright test 또는 npm run test:e2e
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const testDBPath = path.resolve(__dirname, 'e2e-test.db');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',

  // 각 테스트의 최대 실행 시간
  timeout: 30_000,

  // expect() 단언의 최대 대기 시간
  expect: {
    timeout: 10_000,
  },

  // 전체 테스트 실패 시 최대 재시도 횟수 (CI에서만)
  retries: process.env.CI ? 2 : 0,

  // 병렬 워커 수 (CI에서는 단일 워커로 DB 충돌 방지)
  workers: process.env.CI ? 1 : undefined,

  // 리포터 설정
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  // 글로벌 설정/정리 스크립트
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  // 모든 테스트에 공통으로 적용되는 설정
  use: {
    baseURL,

    // 테스트 실패 시 스크린샷 캡처
    screenshot: 'only-on-failure',

    // 테스트 실패 시 비디오 녹화
    video: 'retain-on-failure',

    // 테스트 실패 시 트레이스 수집
    trace: 'retain-on-failure',

    // 환경변수로 테스트 DB 경로 전달
    extraHTTPHeaders: {},
  },

  // 테스트할 브라우저 프로젝트
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 테스트 전에 Next.js 개발 서버 자동 기동
  webServer: {
    command: 'npm run start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // 테스트 전용 SQLite DB 사용
      DATABASE_URL: `file:${testDBPath}`,
      JWT_SECRET: 'e2e-test-secret-key-must-be-at-least-32-chars!!',
      API_SECRET_KEY: 'e2e-test-api-key-valid',
      VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
      VAPID_PRIVATE_KEY: 'UUxI4O8-HoGs86_GBRhFxGMpHMTKJmEXAZMFnTa5YCc',
      VAPID_SUBJECT: 'mailto:e2e-test@example.com',
      NODE_ENV: 'production',
      PORT: '3001',
    },
  },
});

export { testDBPath };
