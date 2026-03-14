/**
 * PWA 설정 검증 테스트 (DLD-663)
 *
 * manifest.ts, Service Worker, next.config.ts 헤더 설정,
 * layout.tsx 메타데이터가 PWA 요구사항을 충족하는지 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

// ----------------------------------------------------------------
// app/manifest.ts
// ----------------------------------------------------------------
describe('app/manifest.ts', () => {
  const MANIFEST_PATH = path.join(ROOT, 'app', 'manifest.ts');
  let manifestContent: string;

  it('should exist at app/manifest.ts', () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
  });

  describe('manifest content', () => {
    beforeAll(() => {
      manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    });

    it('should not be empty', () => {
      expect(manifestContent.trim().length).toBeGreaterThan(0);
    });

    it('should export a default function (Next.js App Router manifest convention)', () => {
      // export default function 또는 export default () => 형태
      expect(manifestContent).toMatch(/export\s+default/);
    });

    it('should set name to "Gatekeeper"', () => {
      expect(manifestContent).toMatch(/name['":\s]+['"]Gatekeeper['"]/);
    });

    it('should set short_name to "Gatekeeper"', () => {
      expect(manifestContent).toContain('short_name');
      expect(manifestContent).toMatch(/short_name['":\s]+['"]Gatekeeper['"]/);
    });

    it('should set start_url to "/"', () => {
      expect(manifestContent).toContain('start_url');
      expect(manifestContent).toMatch(/start_url['":\s]+['"]\/['"]/);
    });

    it('should set display to "standalone"', () => {
      expect(manifestContent).toContain('display');
      expect(manifestContent).toMatch(/display['":\s]+['"]standalone['"]/);
    });

    it('should define icons array', () => {
      expect(manifestContent).toContain('icons');
    });

    it('should include 192x192 icon', () => {
      expect(manifestContent).toContain('192x192');
    });

    it('should include 512x512 icon', () => {
      expect(manifestContent).toContain('512x512');
    });

    it('should specify PNG type for icons', () => {
      expect(manifestContent).toMatch(/image\/png/);
    });

    it('should set theme_color', () => {
      expect(manifestContent).toContain('theme_color');
    });

    it('should set background_color', () => {
      expect(manifestContent).toContain('background_color');
    });
  });
});

// ----------------------------------------------------------------
// public/sw.js (Service Worker)
// ----------------------------------------------------------------
describe('public/sw.js', () => {
  const SW_PATH = path.join(ROOT, 'public', 'sw.js');
  let swContent: string;

  it('should exist at public/sw.js', () => {
    expect(fs.existsSync(SW_PATH)).toBe(true);
  });

  describe('service worker content', () => {
    beforeAll(() => {
      swContent = fs.readFileSync(SW_PATH, 'utf-8');
    });

    it('should not be empty', () => {
      expect(swContent.trim().length).toBeGreaterThan(0);
    });

    describe('install event', () => {
      it('should handle the install event', () => {
        expect(swContent).toMatch(/addEventListener\s*\(\s*['"]install['"]/);
      });

      it('should call waitUntil in install handler', () => {
        expect(swContent).toContain('waitUntil');
      });

      it('should open a cache for precaching static assets', () => {
        expect(swContent).toContain('caches.open');
      });

      it('should call addAll to precache assets', () => {
        expect(swContent).toContain('addAll');
      });
    });

    describe('fetch event', () => {
      it('should handle the fetch event', () => {
        expect(swContent).toMatch(/addEventListener\s*\(\s*['"]fetch['"]/);
      });

      it('should implement cache-first strategy by checking cache match', () => {
        expect(swContent).toContain('caches.match');
      });

      it('should fall back to network when cache misses', () => {
        expect(swContent).toContain('fetch');
      });

      it('should serve an offline fallback', () => {
        // offline fallback은 '/offline' 또는 오프라인 응답 처리
        expect(swContent).toMatch(/offline|fallback/i);
      });
    });

    describe('activate event', () => {
      it('should handle the activate event', () => {
        expect(swContent).toMatch(/addEventListener\s*\(\s*['"]activate['"]/);
      });

      it('should clean up old caches', () => {
        // 이전 캐시 정리: caches.keys()로 기존 캐시 목록을 가져와 삭제
        expect(swContent).toContain('caches.keys');
      });

      it('should delete outdated caches', () => {
        expect(swContent).toContain('caches.delete');
      });
    });
  });
});

// ----------------------------------------------------------------
// public/ 디렉토리의 PWA 아이콘
// ----------------------------------------------------------------
describe('PWA icon assets', () => {
  it('should have public/ directory', () => {
    const publicDir = path.join(ROOT, 'public');
    expect(fs.existsSync(publicDir)).toBe(true);
    expect(fs.statSync(publicDir).isDirectory()).toBe(true);
  });

  it('should have 192x192 PNG icon file', () => {
    const publicDir = path.join(ROOT, 'public');
    const files = fs.readdirSync(publicDir);
    const has192 = files.some((f) => f.includes('192') && f.endsWith('.png'));
    expect(has192).toBe(true);
  });

  it('should have 512x512 PNG icon file', () => {
    const publicDir = path.join(ROOT, 'public');
    const files = fs.readdirSync(publicDir);
    const has512 = files.some((f) => f.includes('512') && f.endsWith('.png'));
    expect(has512).toBe(true);
  });
});

// ----------------------------------------------------------------
// next.config.ts — Service-Worker-Allowed 헤더
// ----------------------------------------------------------------
describe('next.config.ts PWA headers', () => {
  const NEXT_CONFIG_PATH = path.join(ROOT, 'next.config.ts');
  let nextConfigContent: string;

  it('should have next.config.ts at project root', () => {
    expect(fs.existsSync(NEXT_CONFIG_PATH)).toBe(true);
  });

  describe('Service-Worker-Allowed header', () => {
    beforeAll(() => {
      nextConfigContent = fs.readFileSync(NEXT_CONFIG_PATH, 'utf-8');
    });

    it('should define a headers() function for custom HTTP headers', () => {
      expect(nextConfigContent).toContain('headers');
    });

    it('should set Service-Worker-Allowed header', () => {
      expect(nextConfigContent).toContain('Service-Worker-Allowed');
    });

    it('should set Service-Worker-Allowed header value to "/"', () => {
      // Service-Worker-Allowed 헤더의 값이 "/" 인지 확인 (key/value 구조)
      expect(nextConfigContent).toContain('Service-Worker-Allowed');
      expect(nextConfigContent).toMatch(/value['":\s]+['"]\/['"]/);
    });

    it('should apply the header to the sw.js path', () => {
      expect(nextConfigContent).toContain('sw.js');
    });
  });
});

// ----------------------------------------------------------------
// app/layout.tsx — PWA 메타데이터
// ----------------------------------------------------------------
describe('app/layout.tsx PWA metadata', () => {
  const LAYOUT_PATH = path.join(ROOT, 'app', 'layout.tsx');
  let layoutContent: string;

  it('should have app/layout.tsx', () => {
    expect(fs.existsSync(LAYOUT_PATH)).toBe(true);
  });

  describe('viewport configuration', () => {
    beforeAll(() => {
      layoutContent = fs.readFileSync(LAYOUT_PATH, 'utf-8');
    });

    it('should export viewport metadata (Next.js viewport export)', () => {
      // Next.js App Router에서는 viewport를 별도 export로 분리
      expect(layoutContent).toMatch(/export.*viewport|viewport.*export/);
    });

    it('should set width to device-width in viewport', () => {
      expect(layoutContent).toContain('width');
    });

    it('should set initial-scale in viewport', () => {
      expect(layoutContent).toContain('initialScale');
    });
  });

  describe('theme-color configuration', () => {
    it('should define theme-color in metadata or viewport', () => {
      expect(layoutContent).toContain('themeColor');
    });
  });

  describe('apple mobile web app configuration', () => {
    it('should configure apple-mobile-web-app capable', () => {
      // Next.js: appleWebApp 또는 apple-mobile-web-app 메타 태그
      expect(layoutContent).toMatch(/appleWebApp|apple-mobile-web-app/);
    });

    it('should set apple-mobile-web-app status bar style', () => {
      expect(layoutContent).toMatch(/statusBarStyle|status-bar-style/);
    });
  });

  describe('service worker registration', () => {
    it('should register the service worker (script or component)', () => {
      // layout.tsx에서 sw.js 등록을 직접 하거나 별도 컴포넌트를 import
      const hasSWRef =
        layoutContent.includes('sw.js') ||
        layoutContent.includes('serviceWorker') ||
        layoutContent.includes('ServiceWorker') ||
        layoutContent.includes('SwRegistration') ||
        layoutContent.includes('registerSW') ||
        layoutContent.includes('PwaRegister');
      expect(hasSWRef).toBe(true);
    });
  });
});
