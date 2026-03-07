/**
 * PWA manifest.ts 유닛 테스트
 *
 * app/manifest.ts의 반환값 구조를 검증합니다.
 * Next.js의 MetadataRoute.Manifest 형식에 맞는지,
 * 필수 PWA 필드가 모두 포함되어 있는지 확인합니다.
 */

import path from 'path';
import fs from 'fs';

// manifest.ts 파일이 존재하는지 먼저 확인
const MANIFEST_PATH = path.join(process.cwd(), 'app', 'manifest.ts');
const ROOT = process.cwd();

// manifest 모듈 동적 로드 헬퍼
// ts-jest 환경에서 app/manifest.ts를 직접 require하기 위한 유틸리티
async function loadManifest() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/app/manifest');
  // default export 또는 named export 'manifest' 모두 지원
  return mod.default ?? mod.manifest;
}

describe('app/manifest.ts', () => {
  // ----------------------------------------------------------------
  // 파일 존재 확인
  // ----------------------------------------------------------------
  describe('파일 존재', () => {
    it('app/manifest.ts 파일이 존재해야 한다', () => {
      expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // manifest 함수 호출 및 반환값 구조 검증
  // ----------------------------------------------------------------
  describe('manifest() 반환값 구조', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let manifest: any;

    beforeAll(async () => {
      manifest = await loadManifest();
      // 함수라면 호출, 아니라면 그대로 사용
      if (typeof manifest === 'function') {
        manifest = manifest();
        // Promise 반환 가능성 고려
        if (manifest && typeof manifest.then === 'function') {
          manifest = await manifest;
        }
      }
    });

    it('manifest 함수(또는 객체)가 export되어야 한다', async () => {
      const mod = await loadManifest();
      expect(mod).toBeDefined();
    });

    it('반환값이 null이 아닌 객체여야 한다', () => {
      expect(manifest).toBeDefined();
      expect(manifest).not.toBeNull();
      expect(typeof manifest).toBe('object');
    });

    // ----------------------------------------------------------------
    // 필수 PWA 필드
    // ----------------------------------------------------------------
    describe('필수 필드', () => {
      it('name 필드가 존재해야 한다', () => {
        expect(manifest).toHaveProperty('name');
        expect(typeof manifest.name).toBe('string');
        expect(manifest.name.length).toBeGreaterThan(0);
      });

      it('name이 "Gatekeeper"여야 한다', () => {
        expect(manifest.name).toBe('Gatekeeper');
      });

      it('short_name 필드가 존재해야 한다', () => {
        expect(manifest).toHaveProperty('short_name');
        expect(typeof manifest.short_name).toBe('string');
        expect(manifest.short_name.length).toBeGreaterThan(0);
      });

      it('start_url 필드가 존재해야 한다', () => {
        expect(manifest).toHaveProperty('start_url');
      });

      it('start_url이 "/" 이어야 한다', () => {
        expect(manifest.start_url).toBe('/');
      });

      it('display 필드가 존재해야 한다', () => {
        expect(manifest).toHaveProperty('display');
      });

      it('display가 "standalone" 이어야 한다', () => {
        expect(manifest.display).toBe('standalone');
      });

      it('icons 배열이 존재해야 한다', () => {
        expect(manifest).toHaveProperty('icons');
        expect(Array.isArray(manifest.icons)).toBe(true);
      });

      it('icons 배열에 최소 1개 이상의 아이콘이 있어야 한다', () => {
        expect(manifest.icons.length).toBeGreaterThanOrEqual(1);
      });
    });

    // ----------------------------------------------------------------
    // 아이콘 필드 구조
    // ----------------------------------------------------------------
    describe('icons 배열 구조', () => {
      it('각 아이콘에 src 필드가 존재해야 한다', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        manifest.icons.forEach((icon: any) => {
          expect(icon).toHaveProperty('src');
          expect(typeof icon.src).toBe('string');
          expect(icon.src.length).toBeGreaterThan(0);
        });
      });

      it('각 아이콘에 sizes 필드가 존재해야 한다', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        manifest.icons.forEach((icon: any) => {
          expect(icon).toHaveProperty('sizes');
          expect(typeof icon.sizes).toBe('string');
          expect(icon.sizes.length).toBeGreaterThan(0);
        });
      });

      it('192x192 크기의 아이콘이 존재해야 한다', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const icon192 = manifest.icons.find((icon: any) =>
          icon.sizes === '192x192'
        );
        expect(icon192).toBeDefined();
      });

      it('512x512 크기의 아이콘이 존재해야 한다', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const icon512 = manifest.icons.find((icon: any) =>
          icon.sizes === '512x512'
        );
        expect(icon512).toBeDefined();
      });
    });

    // ----------------------------------------------------------------
    // 선택적 PWA 필드 (권장)
    // ----------------------------------------------------------------
    describe('권장 필드', () => {
      it('theme_color 필드가 존재해야 한다', () => {
        expect(manifest).toHaveProperty('theme_color');
        expect(typeof manifest.theme_color).toBe('string');
        expect(manifest.theme_color.length).toBeGreaterThan(0);
      });
    });
  });

  // ----------------------------------------------------------------
  // next.config.ts 설정 확인 (PWA 헤더)
  // ----------------------------------------------------------------
  describe('next.config.ts PWA 헤더 설정', () => {
    let nextConfigContent: string;

    beforeAll(() => {
      const configPath = path.join(ROOT, 'next.config.ts');
      nextConfigContent = fs.readFileSync(configPath, 'utf-8');
    });

    it('next.config.ts에 headers 설정이 포함되어야 한다', () => {
      expect(nextConfigContent).toMatch(/headers/);
    });

    it('next.config.ts에 Service-Worker-Allowed 헤더가 설정되어야 한다', () => {
      expect(nextConfigContent).toMatch(/Service-Worker-Allowed/);
    });

    it('next.config.ts에 sw.js 관련 Cache-Control 설정이 있어야 한다', () => {
      expect(nextConfigContent).toMatch(/sw\.js/);
      expect(nextConfigContent).toMatch(/Cache-Control/);
    });
  });
});
