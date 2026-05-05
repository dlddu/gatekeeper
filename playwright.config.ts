import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E 테스트 설정
 *
 * Go 백엔드(`backend/`)를 직접 빌드한 뒤 webServer로 실행합니다.
 * globalSetup이 prisma db push로 테스트 DB 스키마를 생성하고 seed 데이터를
 * 삽입한 뒤, Go 바이너리는 같은 SQLite 파일을 그대로 사용합니다.
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const testDBPath = path.resolve(__dirname, 'e2e-test.db');
const goBinary = path.resolve(__dirname, 'backend', 'gatekeeper-e2e');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  testIgnore: ['**/kind/**'],

  // 각 테스트의 최대 실행 시간
  timeout: 30_000,

  // expect() 단언의 최대 대기 시간
  expect: {
    timeout: 10_000,
  },

  // 전체 테스트 실패 시 최대 재시도 횟수 (CI에서만)
  retries: process.env.CI ? 1 : 0,

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

  // Go 백엔드 자동 기동 (사전에 backend/gatekeeper-e2e 바이너리 빌드 필요)
  webServer: {
    command: `${goBinary}`,
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
    },
  },
});

export { testDBPath };
