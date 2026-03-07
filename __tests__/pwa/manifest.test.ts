/**
 * PWA manifest.json 파일 검증 테스트
 *
 * public/manifest.json의 존재 여부 및 필수 필드를 검증합니다.
 * PWA 스펙상 최소 요건을 충족하는지 확인합니다.
 *
 * 참고: E2E 테스트(e2e/pwa.e2e.ts)는 실제 HTTP 서빙을 검증하므로
 * 여기서는 파일 구조와 내용만 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'public', 'manifest.json');

describe('public/manifest.json', () => {
  // ----------------------------------------------------------------
  // 파일 존재 여부
  // ----------------------------------------------------------------
  describe('file existence', () => {
    it('should exist at public/manifest.json', () => {
      expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    });

    it('should not be empty', () => {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      expect(content.trim().length).toBeGreaterThan(0);
    });

    it('should be valid JSON', () => {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  // ----------------------------------------------------------------
  // 필수 필드 검증 (PWA 스펙)
  // ----------------------------------------------------------------
  describe('required fields', () => {
    let manifest: Record<string, unknown>;

    beforeAll(() => {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      manifest = JSON.parse(content);
    });

    // --- name ---
    it('should have a name field', () => {
      expect(manifest).toHaveProperty('name');
    });

    it('name should be a non-empty string', () => {
      expect(typeof manifest.name).toBe('string');
      expect((manifest.name as string).length).toBeGreaterThan(0);
    });

    // --- short_name ---
    it('should have a short_name field', () => {
      expect(manifest).toHaveProperty('short_name');
    });

    it('short_name should be a non-empty string', () => {
      expect(typeof manifest.short_name).toBe('string');
      expect((manifest.short_name as string).length).toBeGreaterThan(0);
    });

    it('short_name should be 12 characters or fewer for display purposes', () => {
      // 대부분의 브라우저는 12자 이하를 권장
      expect((manifest.short_name as string).length).toBeLessThanOrEqual(12);
    });

    // --- start_url ---
    it('should have a start_url field', () => {
      expect(manifest).toHaveProperty('start_url');
    });

    it('start_url should be "/"', () => {
      expect(manifest.start_url).toBe('/');
    });

    // --- display ---
    it('should have a display field', () => {
      expect(manifest).toHaveProperty('display');
    });

    it('display should be "standalone"', () => {
      expect(manifest.display).toBe('standalone');
    });

    // --- theme_color ---
    it('should have a theme_color field', () => {
      expect(manifest).toHaveProperty('theme_color');
    });

    it('theme_color should be a valid hex color string', () => {
      const color = manifest.theme_color as string;
      expect(typeof color).toBe('string');
      // #RGB, #RRGGBB, #RRGGBBAA 형식 허용
      expect(color).toMatch(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
    });

    // --- background_color ---
    it('should have a background_color field', () => {
      expect(manifest).toHaveProperty('background_color');
    });

    it('background_color should be a valid hex color string', () => {
      const color = manifest.background_color as string;
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
    });

    // --- icons ---
    it('should have an icons field', () => {
      expect(manifest).toHaveProperty('icons');
    });

    it('icons should be an array', () => {
      expect(Array.isArray(manifest.icons)).toBe(true);
    });

    it('icons array should have at least one entry', () => {
      const icons = manifest.icons as unknown[];
      expect(icons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------------
  // icons 배열 내 개별 아이콘 구조 검증
  // ----------------------------------------------------------------
  describe('icons array structure', () => {
    let manifest: Record<string, unknown>;

    beforeAll(() => {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      manifest = JSON.parse(content);
    });

    it('each icon should have a src field', () => {
      const icons = manifest.icons as Array<Record<string, unknown>>;
      for (const icon of icons) {
        expect(icon).toHaveProperty('src');
        expect(typeof icon.src).toBe('string');
        expect((icon.src as string).length).toBeGreaterThan(0);
      }
    });

    it('each icon should have a sizes field', () => {
      const icons = manifest.icons as Array<Record<string, unknown>>;
      for (const icon of icons) {
        expect(icon).toHaveProperty('sizes');
        expect(typeof icon.sizes).toBe('string');
        expect((icon.sizes as string).length).toBeGreaterThan(0);
      }
    });

    it('each icon should have a type field', () => {
      const icons = manifest.icons as Array<Record<string, unknown>>;
      for (const icon of icons) {
        expect(icon).toHaveProperty('type');
        expect(typeof icon.type).toBe('string');
      }
    });

    it('each icon type should be a valid MIME type', () => {
      const icons = manifest.icons as Array<Record<string, unknown>>;
      for (const icon of icons) {
        // image/png, image/svg+xml, image/webp 등
        expect(icon.type as string).toMatch(/^image\//);
      }
    });

    it('each icon sizes field should match NNNxNNN or "any" format', () => {
      const icons = manifest.icons as Array<Record<string, unknown>>;
      for (const icon of icons) {
        const sizes = icon.sizes as string;
        // "192x192", "512x512", "any" 모두 허용
        expect(sizes).toMatch(/^\d+x\d+$|^any$/i);
      }
    });

    it('should include a 192x192 icon (minimum for Android)', () => {
      const icons = manifest.icons as Array<Record<string, unknown>>;
      const has192 = icons.some((icon) => icon.sizes === '192x192');
      expect(has192).toBe(true);
    });

    it('should include a 512x512 icon (required for installability)', () => {
      const icons = manifest.icons as Array<Record<string, unknown>>;
      const has512 = icons.some((icon) => icon.sizes === '512x512');
      expect(has512).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 선택적 권장 필드
  // ----------------------------------------------------------------
  describe('recommended optional fields', () => {
    let manifest: Record<string, unknown>;

    beforeAll(() => {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      manifest = JSON.parse(content);
    });

    it('should have a description field', () => {
      expect(manifest).toHaveProperty('description');
      expect(typeof manifest.description).toBe('string');
    });

    it('should have a lang field', () => {
      expect(manifest).toHaveProperty('lang');
      expect(typeof manifest.lang).toBe('string');
    });

    it('should have a scope field', () => {
      expect(manifest).toHaveProperty('scope');
      expect(typeof manifest.scope).toBe('string');
    });
  });
});
