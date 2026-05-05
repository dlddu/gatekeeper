import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E 테스트 설정
 *
 * 두 webServer를 띄웁니다:
 *  1. Go 백엔드(`backend/gatekeeper-e2e`): /api/* 처리, 포트 3002
 *  2. Next.js 프로덕션 서버(`npm run start`): 페이지 렌더링, 포트 3001
 *     (next.config.ts의 rewrite 규칙이 /api/*를 Go 백엔드로 프록시)
 *
 * globalSetup이 prisma db push로 테스트 DB 스키마를 만들고 시드 데이터를
 * 삽입하면, Go 백엔드는 같은 SQLite 파일을 그대로 사용합니다.
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const testDBPath = path.resolve(__dirname, 'e2e-test.db');
const goBinary = path.resolve(__dirname, 'backend', 'gatekeeper-e2e');

const goPort = '3002';
const nextPort = '3001';

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

  webServer: [
    {
      // Go 백엔드 (사전에 backend/gatekeeper-e2e 빌드 필요)
      command: goBinary,
      url: `http://127.0.0.1:${goPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        DATABASE_URL: `file:${testDBPath}`,
        API_SECRET_KEY: 'e2e-test-api-key-valid',
        VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        VAPID_PRIVATE_KEY: 'UUxI4O8-HoGs86_GBRhFxGMpHMTKJmEXAZMFnTa5YCc',
        VAPID_SUBJECT: 'mailto:e2e-test@example.com',
        PORT: goPort,
        HOSTNAME: '127.0.0.1',
      },
    },
    {
      // Next.js 프로덕션 서버 (사전 `npm run build` 필요)
      command: 'npm run start',
      url: `${baseURL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: nextPort,
        // /api/* 요청은 next.config.ts rewrite를 통해 Go 백엔드로 프록시.
        // (rewrite 대상은 빌드 시 결정되므로 build 단계에서도 동일 값을 줘야 함.)
        GO_BACKEND_URL: `http://127.0.0.1:${goPort}`,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        NODE_ENV: 'production',
      },
    },
  ],
});

export { testDBPath };
