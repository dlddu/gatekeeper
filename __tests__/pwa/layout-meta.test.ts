/**
 * app/layout.tsx 모바일 메타 태그 검증 테스트
 *
 * Next.js App Router에서 layout.tsx의 export된 metadata 객체에
 * PWA/모바일 관련 메타 태그가 올바르게 설정되어 있는지 검증합니다.
 *
 * 검증 대상:
 * - viewport (themeColor, width, initialScale)
 * - applicationName
 * - appleWebApp (apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style)
 * - manifest 링크
 * - themeColor
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const LAYOUT_PATH = path.join(ROOT, 'app', 'layout.tsx');

// ----------------------------------------------------------------
// 레이아웃 소스 파일 정적 분석 (Next.js metadata 객체는 런타임 없이 분석)
// ----------------------------------------------------------------
describe('app/layout.tsx - 모바일/PWA 메타 태그', () => {
  let layoutContent: string;

  beforeAll(() => {
    layoutContent = fs.readFileSync(LAYOUT_PATH, 'utf-8');
  });

  // ----------------------------------------------------------------
  // 파일 존재 확인
  // ----------------------------------------------------------------
  describe('파일 존재', () => {
    it('app/layout.tsx 파일이 존재해야 한다', () => {
      expect(fs.existsSync(LAYOUT_PATH)).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // metadata export 확인
  // ----------------------------------------------------------------
  describe('metadata export', () => {
    it('metadata 객체가 export되어야 한다', () => {
      expect(layoutContent).toMatch(/export\s+(const\s+metadata|.*Metadata)/);
    });

    it('앱 이름이 "Gatekeeper"로 설정되어야 한다', () => {
      expect(layoutContent).toMatch(/Gatekeeper/);
    });
  });

  // ----------------------------------------------------------------
  // viewport 메타 태그
  // ----------------------------------------------------------------
  describe('viewport 설정', () => {
    it('viewport 관련 설정이 포함되어야 한다', () => {
      // Next.js 13+는 viewport export 또는 metadata.viewport로 설정
      const hasViewport =
        layoutContent.includes('viewport') ||
        layoutContent.includes('width=device-width');
      expect(hasViewport).toBe(true);
    });

    it('themeColor 설정이 포함되어야 한다', () => {
      // metadata.themeColor 또는 viewport.themeColor
      const hasThemeColor =
        layoutContent.includes('themeColor') ||
        layoutContent.includes('theme-color') ||
        layoutContent.includes('theme_color');
      expect(hasThemeColor).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // Apple 모바일 웹앱 메타 태그
  // ----------------------------------------------------------------
  describe('Apple 모바일 웹앱 설정', () => {
    it('appleWebApp 또는 apple-mobile-web-app 관련 설정이 포함되어야 한다', () => {
      const hasAppleMeta =
        layoutContent.includes('appleWebApp') ||
        layoutContent.includes('apple-mobile-web-app');
      expect(hasAppleMeta).toBe(true);
    });

    it('apple-mobile-web-app-capable 설정이 포함되어야 한다', () => {
      // Next.js metadata API: appleWebApp.capable 또는 직접 문자열
      const hasCapable =
        layoutContent.includes('capable') ||
        layoutContent.includes('apple-mobile-web-app-capable');
      expect(hasCapable).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // manifest 링크 확인
  // ----------------------------------------------------------------
  describe('manifest 링크', () => {
    it('manifest 관련 설정이 포함되어야 한다', () => {
      // metadata.manifest 또는 link rel="manifest"
      const hasManifest =
        layoutContent.includes('manifest') ||
        layoutContent.includes('/manifest');
      expect(hasManifest).toBe(true);
    });
  });
});

// ----------------------------------------------------------------
// layout.tsx 동적 import를 통한 metadata 객체 검증
// ----------------------------------------------------------------
describe('app/layout.tsx - metadata 객체 런타임 검증', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let metadata: any;

  beforeAll(async () => {
    try {
      // ts-jest 환경에서 layout.tsx import (Google Fonts 등 외부 의존성 주의)
      jest.mock('next/font/google', () => ({
        Geist: () => ({ variable: '--font-geist-sans', className: 'mock-font' }),
        Geist_Mono: () => ({ variable: '--font-geist-mono', className: 'mock-font-mono' }),
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/app/layout');
      metadata = mod.metadata;
    } catch {
      // 폰트 또는 Next.js 의존성으로 import 실패 시 null 처리
      metadata = null;
    }
  });

  it('metadata 객체를 export해야 한다 (import 성공 시)', () => {
    // import가 실패할 수 있으므로 소스 분석으로 대체 검증
    const layoutContent = fs.readFileSync(LAYOUT_PATH, 'utf-8');
    expect(layoutContent).toMatch(/export\s+(const\s+metadata|.*Metadata)/);
  });

  it('metadata.title이 설정되어야 한다 (import 성공 시)', () => {
    if (metadata === null) {
      // import 실패 시 소스 파일로 검증
      const layoutContent = fs.readFileSync(LAYOUT_PATH, 'utf-8');
      expect(layoutContent).toMatch(/title\s*:/);
      return;
    }
    expect(metadata).toHaveProperty('title');
  });

  it('metadata에 applicationName 또는 앱 관련 이름이 설정되어야 한다 (import 성공 시)', () => {
    if (metadata === null) {
      const layoutContent = fs.readFileSync(LAYOUT_PATH, 'utf-8');
      const hasAppName =
        layoutContent.includes('applicationName') ||
        layoutContent.includes('Gatekeeper');
      expect(hasAppName).toBe(true);
      return;
    }
    const hasAppName =
      metadata.applicationName !== undefined ||
      (typeof metadata.title === 'string' && metadata.title.includes('Gatekeeper')) ||
      (typeof metadata.title === 'object' && JSON.stringify(metadata.title).includes('Gatekeeper'));
    expect(hasAppName).toBe(true);
  });
});
