import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E 테스트 설정
 *
 * Go 백엔드 단일 서버가 정적 산출물(`out/`)과 `/api/*` 를 모두 서빙합니다.
 * webServer 는 Go 바이너리 하나만 띄우고 globalSetup 이 SQLite DB 시드를 처리.
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const testDBPath = path.resolve(__dirname, 'e2e-test.db');
const goBinary = path.resolve(__dirname, 'backend', 'gatekeeper-e2e');
const staticDir = path.resolve(__dirname, 'out');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  testIgnore: ['**/kind/**'],

  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },

  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  use: {
    baseURL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    extraHTTPHeaders: {},
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: goBinary,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL: `file:${testDBPath}`,
      API_SECRET_KEY: 'e2e-test-api-key-valid',
      VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
      VAPID_PRIVATE_KEY: 'UUxI4O8-HoGs86_GBRhFxGMpHMTKJmEXAZMFnTa5YCc',
      VAPID_SUBJECT: 'mailto:e2e-test@example.com',
      PORT: '3001',
      HOSTNAME: '127.0.0.1',
      STATIC_DIR: staticDir,
    },
  },
});

export { testDBPath };
