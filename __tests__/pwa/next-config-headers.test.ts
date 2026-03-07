/**
 * next.config.ts PWA HTTP 응답 헤더 설정 검증 테스트
 *
 * next.config.ts의 headers() 함수가 PWA에 필요한 헤더를
 * 올바르게 반환하는지 검증합니다.
 *
 * 검증 항목:
 * - Service Worker 응답에 Service-Worker-Allowed 헤더 포함
 * - manifest.json 응답에 Content-Type 헤더 포함
 * - sw.js 응답에 Cache-Control 헤더 포함 (no-cache로 항상 최신 SW 사용)
 */

import path from 'path';
import fs from 'fs';

const ROOT = process.cwd();
const NEXT_CONFIG_PATH = path.join(ROOT, 'next.config.ts');

describe('next.config.ts PWA headers configuration', () => {
  // ----------------------------------------------------------------
  // 파일 존재 및 기본 구조
  // ----------------------------------------------------------------
  describe('file structure', () => {
    let configContent: string;

    beforeAll(() => {
      configContent = fs.readFileSync(NEXT_CONFIG_PATH, 'utf-8');
    });

    it('should have a headers() function defined', () => {
      // async headers() { ... } 또는 headers: async () => { ... } 형식
      expect(configContent).toMatch(/headers\s*(?::\s*)?(?:async\s*)?\(\s*\)/);
    });

    it('should configure headers for /sw.js', () => {
      expect(configContent).toContain('/sw.js');
    });

    it('should configure headers for /manifest.json', () => {
      expect(configContent).toContain('/manifest.json');
    });
  });

  // ----------------------------------------------------------------
  // Service Worker 헤더 검증
  // ----------------------------------------------------------------
  describe('Service Worker headers (/sw.js)', () => {
    let configContent: string;

    beforeAll(() => {
      configContent = fs.readFileSync(NEXT_CONFIG_PATH, 'utf-8');
    });

    it('should set Cache-Control header for sw.js to prevent caching', () => {
      // SW는 항상 최신 버전을 사용하도록 캐시를 비활성화해야 함
      expect(configContent).toContain('Cache-Control');
    });

    it('should include no-cache or no-store directive for sw.js', () => {
      // no-cache, no-store, max-age=0 중 하나 이상 포함
      expect(configContent).toMatch(/no-cache|no-store|max-age=0/);
    });

    it('should set Service-Worker-Allowed header to "/" for sw.js', () => {
      // SW의 scope를 루트로 허용
      expect(configContent).toContain('Service-Worker-Allowed');
    });
  });

  // ----------------------------------------------------------------
  // manifest.json 헤더 검증
  // ----------------------------------------------------------------
  describe('manifest.json headers', () => {
    let configContent: string;

    beforeAll(() => {
      configContent = fs.readFileSync(NEXT_CONFIG_PATH, 'utf-8');
    });

    it('should set Content-Type header for manifest.json', () => {
      expect(configContent).toContain('Content-Type');
    });

    it('should set Content-Type to application/manifest+json or application/json', () => {
      expect(configContent).toMatch(/application\/manifest\+json|application\/json/);
    });
  });

  // ----------------------------------------------------------------
  // headers() 함수 반환값 구조 검증 (동적 import)
  // ----------------------------------------------------------------
  describe('headers() function return value structure', () => {
    type HeaderEntry = { key: string; value: string };
    type HeaderRule = { source: string; headers: HeaderEntry[] };

    let headers: HeaderRule[];

    beforeAll(async () => {
      // ts-jest 환경에서 next.config.ts를 직접 import
      const config = await import('@/next.config');
      const nextConfig = config.default;

      if (typeof nextConfig.headers !== 'function') {
        // headers()가 정의되지 않은 경우 빈 배열로 설정 (테스트 실패 유도)
        headers = [];
        return;
      }

      headers = (await nextConfig.headers()) as HeaderRule[];
    });

    it('should return an array from headers()', () => {
      expect(Array.isArray(headers)).toBe(true);
    });

    it('should have at least one header rule', () => {
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });

    it('each header rule should have a source property', () => {
      for (const rule of headers) {
        expect(rule).toHaveProperty('source');
        expect(typeof rule.source).toBe('string');
      }
    });

    it('each header rule should have a headers array', () => {
      for (const rule of headers) {
        expect(rule).toHaveProperty('headers');
        expect(Array.isArray(rule.headers)).toBe(true);
      }
    });

    it('each header entry should have key and value string properties', () => {
      for (const rule of headers) {
        for (const header of rule.headers) {
          expect(header).toHaveProperty('key');
          expect(header).toHaveProperty('value');
          expect(typeof header.key).toBe('string');
          expect(typeof header.value).toBe('string');
        }
      }
    });

    it('should have a rule targeting /sw.js', () => {
      const swRule = headers.find((rule) => rule.source === '/sw.js');
      expect(swRule).toBeDefined();
    });

    it('sw.js rule should include Cache-Control header', () => {
      const swRule = headers.find((rule) => rule.source === '/sw.js');
      expect(swRule).toBeDefined();
      const cacheHeader = swRule!.headers.find(
        (h) => h.key.toLowerCase() === 'cache-control'
      );
      expect(cacheHeader).toBeDefined();
    });

    it('sw.js Cache-Control header should prevent stale SW serving', () => {
      const swRule = headers.find((rule) => rule.source === '/sw.js');
      const cacheHeader = swRule!.headers.find(
        (h) => h.key.toLowerCase() === 'cache-control'
      );
      expect(cacheHeader!.value).toMatch(/no-cache|no-store|max-age=0/);
    });

    it('should have a rule targeting /manifest.json', () => {
      const manifestRule = headers.find((rule) => rule.source === '/manifest.json');
      expect(manifestRule).toBeDefined();
    });

    it('manifest.json rule should include Content-Type header', () => {
      const manifestRule = headers.find((rule) => rule.source === '/manifest.json');
      expect(manifestRule).toBeDefined();
      const contentTypeHeader = manifestRule!.headers.find(
        (h) => h.key.toLowerCase() === 'content-type'
      );
      expect(contentTypeHeader).toBeDefined();
    });

    it('manifest.json Content-Type should be application/manifest+json or application/json', () => {
      const manifestRule = headers.find((rule) => rule.source === '/manifest.json');
      const contentTypeHeader = manifestRule!.headers.find(
        (h) => h.key.toLowerCase() === 'content-type'
      );
      expect(contentTypeHeader!.value).toMatch(/application\/manifest\+json|application\/json/);
    });
  });
});
