/**
 * PWA Service Worker (public/sw.js) 파일 검증 테스트
 *
 * public/sw.js의 존재 여부와 핵심 SW 로직(install, fetch 이벤트,
 * 앱 셸 캐싱, 오프라인 폴백)을 정적 분석으로 검증합니다.
 *
 * 참고: 실제 SW 등록 및 브라우저 동작은 E2E 테스트(e2e/pwa.e2e.ts)에서 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SW_PATH = path.join(ROOT, 'public', 'sw.js');

describe('public/sw.js (Service Worker)', () => {
  // ----------------------------------------------------------------
  // 파일 존재 여부
  // ----------------------------------------------------------------
  describe('file existence', () => {
    it('should exist at public/sw.js', () => {
      expect(fs.existsSync(SW_PATH)).toBe(true);
    });

    it('should not be empty', () => {
      const content = fs.readFileSync(SW_PATH, 'utf-8');
      expect(content.trim().length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------
  // SW 이벤트 핸들러 포함 여부 (정적 분석)
  // ----------------------------------------------------------------
  describe('event handlers', () => {
    let swContent: string;

    beforeAll(() => {
      swContent = fs.readFileSync(SW_PATH, 'utf-8');
    });

    it('should register an install event listener', () => {
      // addEventListener('install', ...) 또는 oninstall = ... 형식 모두 허용
      expect(swContent).toMatch(/addEventListener\(['"]install['"]/);
    });

    it('should register a fetch event listener', () => {
      expect(swContent).toMatch(/addEventListener\(['"]fetch['"]/);
    });

    it('should register an activate event listener', () => {
      expect(swContent).toMatch(/addEventListener\(['"]activate['"]/);
    });
  });

  // ----------------------------------------------------------------
  // 캐시 전략 (앱 셸 캐싱)
  // ----------------------------------------------------------------
  describe('caching strategy', () => {
    let swContent: string;

    beforeAll(() => {
      swContent = fs.readFileSync(SW_PATH, 'utf-8');
    });

    it('should define a cache name constant', () => {
      // 캐시 버전 관리를 위한 상수가 있어야 함
      expect(swContent).toMatch(/CACHE_NAME|CACHE_VERSION|cacheName|cache_name/i);
    });

    it('should use caches.open() for cache storage', () => {
      expect(swContent).toContain('caches.open');
    });

    it('should use cache.addAll() or cache.put() for pre-caching', () => {
      expect(swContent).toMatch(/cache\.addAll|cache\.put/);
    });

    it('should define shell URLs to cache (APP_SHELL_URLS or similar)', () => {
      // "/" 또는 앱 셸 URL 배열이 정의되어 있어야 함
      expect(swContent).toMatch(/APP_SHELL|shellUrls|SHELL_URLS|urlsToCache|shell_urls/i);
    });

    it('should include "/" in the list of cached shell URLs', () => {
      // 루트 경로는 반드시 캐시해야 함
      expect(swContent).toContain("'/'");
    });
  });

  // ----------------------------------------------------------------
  // 오프라인 폴백
  // ----------------------------------------------------------------
  describe('offline fallback', () => {
    let swContent: string;

    beforeAll(() => {
      swContent = fs.readFileSync(SW_PATH, 'utf-8');
    });

    it('should use caches.match() to serve cached responses', () => {
      expect(swContent).toContain('caches.match');
    });

    it('should handle network failure with a fallback (try/catch or .catch)', () => {
      // try/catch 또는 Promise .catch()로 네트워크 실패 처리
      expect(swContent).toMatch(/try\s*\{|\.catch\s*\(/);
    });

    it('should use respondWith() to intercept fetch requests', () => {
      expect(swContent).toContain('respondWith');
    });

    it('should call event.waitUntil() in install handler', () => {
      expect(swContent).toContain('waitUntil');
    });
  });

  // ----------------------------------------------------------------
  // 캐시 정리 (activate 단계)
  // ----------------------------------------------------------------
  describe('cache cleanup on activate', () => {
    let swContent: string;

    beforeAll(() => {
      swContent = fs.readFileSync(SW_PATH, 'utf-8');
    });

    it('should delete old caches during activate event', () => {
      // 구 버전 캐시 삭제를 위해 caches.delete() 또는 caches.keys() 사용
      expect(swContent).toMatch(/caches\.delete|caches\.keys/);
    });

    it('should use clients.claim() to take control immediately', () => {
      expect(swContent).toContain('clients.claim');
    });
  });
});
