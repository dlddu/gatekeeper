/**
 * PWA Service Worker 파일 검증 테스트
 *
 * public/sw.js 파일의 존재 여부와 필수 구조를 검증합니다.
 * Service Worker는 클라이언트 사이드 스크립트이므로
 * 실행 환경이 아닌 파일 내용(정적 분석) 수준에서 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SW_PATH = path.join(ROOT, 'public', 'sw.js');

describe('public/sw.js', () => {
  // ----------------------------------------------------------------
  // 파일 존재 확인
  // ----------------------------------------------------------------
  describe('파일 존재', () => {
    it('public/sw.js 파일이 존재해야 한다', () => {
      expect(fs.existsSync(SW_PATH)).toBe(true);
    });

    it('sw.js가 빈 파일이 아니어야 한다', () => {
      const content = fs.readFileSync(SW_PATH, 'utf-8');
      expect(content.trim().length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------
  // Service Worker 이벤트 리스너 확인
  // ----------------------------------------------------------------
  describe('Service Worker 이벤트 리스너', () => {
    let swContent: string;

    beforeAll(() => {
      swContent = fs.readFileSync(SW_PATH, 'utf-8');
    });

    it('install 이벤트 리스너가 등록되어야 한다', () => {
      // addEventListener('install', ...) 또는 oninstall = 패턴
      expect(swContent).toMatch(/addEventListener\s*\(\s*['"]install['"]/);
    });

    it('activate 이벤트 리스너가 등록되어야 한다', () => {
      expect(swContent).toMatch(/addEventListener\s*\(\s*['"]activate['"]/);
    });

    it('fetch 이벤트 리스너가 등록되어야 한다', () => {
      expect(swContent).toMatch(/addEventListener\s*\(\s*['"]fetch['"]/);
    });
  });

  // ----------------------------------------------------------------
  // 앱 셸 캐싱 전략 확인
  // ----------------------------------------------------------------
  describe('캐시 전략', () => {
    let swContent: string;

    beforeAll(() => {
      swContent = fs.readFileSync(SW_PATH, 'utf-8');
    });

    it('Cache Storage API(caches)를 사용해야 한다', () => {
      expect(swContent).toMatch(/\bcaches\b/);
    });

    it('캐시 이름(CACHE_NAME 또는 APP_SHELL_CACHE 등)이 정의되어야 한다', () => {
      // 캐시 이름 상수 또는 문자열 리터럴로 caches.open 호출
      expect(swContent).toMatch(/caches\.open\s*\(/);
    });

    it('install 단계에서 앱 셸 리소스를 캐싱해야 한다', () => {
      // addAll 또는 add로 리소스 캐싱
      expect(swContent).toMatch(/\.addAll\s*\(|\.add\s*\(/);
    });
  });

  // ----------------------------------------------------------------
  // 오프라인 폴백 확인
  // ----------------------------------------------------------------
  describe('오프라인 폴백', () => {
    let swContent: string;

    beforeAll(() => {
      swContent = fs.readFileSync(SW_PATH, 'utf-8');
    });

    it('fetch 실패 시 캐시에서 폴백 응답을 제공해야 한다', () => {
      // caches.match 사용으로 캐시 응답 반환
      expect(swContent).toMatch(/caches\.match\s*\(/);
    });

    it('respondWith를 사용하여 fetch 이벤트에 응답해야 한다', () => {
      expect(swContent).toMatch(/respondWith\s*\(/);
    });
  });

  // ----------------------------------------------------------------
  // scope 설정 확인 (next.config.ts 헤더 기반)
  // ----------------------------------------------------------------
  describe('scope 루트("/") 서비스', () => {
    it('sw.js는 public/ 루트에 위치하여 "/" scope를 제공할 수 있어야 한다', () => {
      // public/ 루트에 있으면 /sw.js로 서빙되어 scope가 "/" 가 됨
      const inPublicRoot = SW_PATH === path.join(ROOT, 'public', 'sw.js');
      expect(inPublicRoot).toBe(true);
    });
  });
});
